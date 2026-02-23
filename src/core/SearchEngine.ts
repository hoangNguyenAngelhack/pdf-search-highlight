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

/**
 * Search for text across page spans using charMap-based matching.
 *
 * Algorithm:
 * 1. Concatenate all span texts into one string (fullText)
 * 2. Build charMap: charMap[i] = { spanIdx, charIdx } for each char in fullText
 * 3. Run regex on fullText
 * 4. Map each match back to span ranges via charMap
 */
export function searchPage(
  spans: SpanData[],
  query: string,
  options: SearchOptions = {}
): MatchRange[][] {
  const regex = buildFlexibleRegex(query, options);
  if (!regex) return [];

  // Build fullText and charMap
  let fullText = '';
  const charMap: CharMapEntry[] = [];

  spans.forEach((s, si) => {
    for (let ci = 0; ci < s.text.length; ci++) {
      charMap.push({ spanIdx: si, charIdx: ci });
      fullText += s.text[ci];
    }
  });

  // Find all regex matches
  const allMatchRanges: MatchRange[][] = [];
  let m: RegExpExecArray | null;
  regex.lastIndex = 0;

  while ((m = regex.exec(fullText)) !== null) {
    const start = m.index;
    const end = start + m[0].length;

    // Map to span ranges
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
    allMatchRanges.push(range);

    // Prevent infinite loop for zero-length matches
    if (m[0].length === 0) regex.lastIndex++;
  }

  return allMatchRanges;
}
