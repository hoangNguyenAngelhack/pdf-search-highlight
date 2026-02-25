import type { ClassNames } from '../types';

export const DEFAULT_CLASS_NAMES: Required<ClassNames> = {
  container: 'psh-container',
  page: 'psh-page',
  canvas: 'psh-canvas',
  textLayer: 'psh-text-layer',
  pageLabel: 'psh-page-label',
  highlight: 'highlight',
  activeHighlight: 'active',
};

export const DEFAULT_SCALE = 'auto' as number | 'auto';
export const DEFAULT_PAGE_GAP = 20;

export const ZOOM_STEP = 0.25;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 5;
