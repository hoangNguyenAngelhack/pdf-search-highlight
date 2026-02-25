import type { SearchOptions, SpanData } from '../types';

export interface CharMapEntry {
  spanIdx: number;
  charIdx: number;
}

export interface MatchRange {
  spanIdx: number;
  start: number;
  end: number;
}

export interface SearchResult {
  /** Array of span ranges for each match */
  matchRanges: MatchRange[][];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a flexible regex from query.
 *
 * For queries < 200 chars (after removing whitespace):
 * - Strip all whitespace from query
 * - Insert \s* between every character
 * → "and expensive" becomes a\s*n\s*d\s*e\s*x\s*p\s*e\s*n\s*s\s*i\s*v\s*e
 * → Matches regardless of whitespace differences in PDF text
 *
 * For queries >= 200 chars:
 * - Split by whitespace, join with \s+
 */
function buildFlexibleRegex(
  query: string,
  options: SearchOptions
): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const isCaseSensitive = options.caseSensitive ?? false;
  const flexibleWhitespace = options.flexibleWhitespace ?? true;

  if (!flexibleWhitespace) {
    // Simple literal search
    const pattern = escapeRegex(trimmed);
    return new RegExp(pattern, isCaseSensitive ? 'g' : 'gi');
  }

  // Remove all whitespace chars from query
  const chars = [...trimmed].filter((c) => !/\s/.test(c));
  if (chars.length === 0) return null;

  if (chars.length > 200) {
    // Fallback: flexible between tokens only
    const tokens = trimmed.split(/\s+/);
    const pattern = tokens.map((t) => escapeRegex(t)).join('\\s+');
    return new RegExp(pattern, isCaseSensitive ? 'g' : 'gi');
  }

  // Insert \s* between every character
  const pattern = chars.map((c) => escapeRegex(c)).join('\\s*');
  return new RegExp(pattern, isCaseSensitive ? 'g' : 'gi');
}

interface FuzzyMatch {
  start: number;
  end: number;
  distance: number;
}

/**
 * Semi-global Levenshtein alignment for approximate substring matching.
 *
 * Finds all positions in `text` where a substring has edit distance ≤ maxErrors
 * from `query`. Uses O(m) space with single-column DP.
 *
 * Semi-global: first DP column = 0 (match can start anywhere in text),
 * but the full query must be covered.
 */
function fuzzySearchText(
  text: string,
  query: string,
  maxErrors: number
): FuzzyMatch[] {
  const n = text.length;
  const m = query.length;
  if (m === 0) return [];
  if (n === 0) return [];

  // DP: prev[j] = min edit distance to match query[0..j-1] ending at current text pos
  // Semi-global: prev[0] = 0 for all text positions (free start)
  let prev = new Uint32Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  // Store full DP matrix columns for traceback
  const columns: Uint32Array[] = [prev.slice()];

  // Track match end positions
  const endPositions: Array<{ col: number; distance: number }> = [];

  for (let i = 1; i <= n; i++) {
    const curr = new Uint32Array(m + 1);
    curr[0] = 0; // semi-global: free start position
    for (let j = 1; j <= m; j++) {
      const cost = text[i - 1] === query[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    columns.push(curr.slice());

    if (curr[m] <= maxErrors) {
      endPositions.push({ col: i, distance: curr[m] });
    }
    prev = curr;
  }

  if (endPositions.length === 0) return [];

  // Traceback to find start position for each match end
  const rawMatches: FuzzyMatch[] = [];
  for (const { col: endCol, distance } of endPositions) {
    // Trace back through the DP matrix to find where the match starts
    let j = m;
    let i = endCol;
    while (j > 0 && i > 0) {
      const c = columns[i];
      const p = columns[i - 1];
      const cost = text[i - 1] === query[j - 1] ? 0 : 1;
      if (c[j] === p[j - 1] + cost) {
        // substitution or match — move diagonally
        i--;
        j--;
      } else if (c[j] === p[j] + 1) {
        // deletion from text — move left in text
        i--;
      } else {
        // insertion into text — move up in query
        j--;
      }
    }
    rawMatches.push({ start: i, end: endCol, distance });
  }

  // Merge overlapping matches, keeping the one with lowest distance
  if (rawMatches.length === 0) return [];
  rawMatches.sort((a, b) => a.start - b.start || a.distance - b.distance);

  const merged: FuzzyMatch[] = [rawMatches[0]];
  for (let i = 1; i < rawMatches.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = rawMatches[i];
    if (curr.start < prev.end) {
      // Overlapping — keep the one with lower distance
      if (curr.distance < prev.distance) {
        merged[merged.length - 1] = curr;
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/**
 * Build fullText and charMap from spans.
 */
function buildTextAndCharMap(spans: SpanData[]) {
  let fullText = '';
  const charMap: CharMapEntry[] = [];
  spans.forEach((s, si) => {
    for (let ci = 0; ci < s.text.length; ci++) {
      charMap.push({ spanIdx: si, charIdx: ci });
      fullText += s.text[ci];
    }
  });
  return { fullText, charMap };
}

/**
 * Map a start/end range in fullText to MatchRange[] via charMap.
 */
function mapToSpanRanges(
  start: number,
  end: number,
  charMap: CharMapEntry[]
): MatchRange[] {
  const range: MatchRange[] = [];
  for (let k = start; k < end; k++) {
    const cm = charMap[k];
    const last = range[range.length - 1];
    if (last && last.spanIdx === cm.spanIdx && last.end === cm.charIdx) {
      last.end = cm.charIdx + 1;
    } else {
      range.push({ spanIdx: cm.spanIdx, start: cm.charIdx, end: cm.charIdx + 1 });
    }
  }
  return range;
}

/**
 * Search for text across page spans using charMap-based matching.
 *
 * Algorithm:
 * 1. Concatenate all span texts into one string (fullText)
 * 2. Build charMap: charMap[i] = { spanIdx, charIdx } for each char in fullText
 * 3. Run regex or fuzzy search on fullText
 * 4. Map each match back to span ranges via charMap
 */
export function searchPage(
  spans: SpanData[],
  query: string,
  options: SearchOptions = {}
): MatchRange[][] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (options.fuzzy) {
    return fuzzySearchPage(spans, trimmed, options);
  }

  const regex = buildFlexibleRegex(query, options);
  if (!regex) return [];

  const { fullText, charMap } = buildTextAndCharMap(spans);

  // Find all regex matches
  const allMatchRanges: MatchRange[][] = [];
  let m: RegExpExecArray | null;
  regex.lastIndex = 0;

  while ((m = regex.exec(fullText)) !== null) {
    allMatchRanges.push(mapToSpanRanges(m.index, m.index + m[0].length, charMap));
    if (m[0].length === 0) regex.lastIndex++;
  }

  return allMatchRanges;
}

function fuzzySearchPage(
  spans: SpanData[],
  query: string,
  options: SearchOptions
): MatchRange[][] {
  const { fullText, charMap } = buildTextAndCharMap(spans);
  if (fullText.length === 0) return [];

  const isCaseSensitive = options.caseSensitive ?? false;
  const threshold = options.fuzzyThreshold ?? 0.6;

  const searchText = isCaseSensitive ? fullText : fullText.toLowerCase();
  const searchQuery = isCaseSensitive ? query : query.toLowerCase();

  // Strip whitespace from query for matching
  const strippedQuery = searchQuery.replace(/\s+/g, '');
  if (strippedQuery.length === 0) return [];

  const maxErrors = Math.floor(strippedQuery.length * (1 - threshold));
  const matches = fuzzySearchText(searchText, strippedQuery, maxErrors);

  return matches.map((m) => mapToSpanRanges(m.start, m.end, charMap));
}
