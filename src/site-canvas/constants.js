/*
 * A block editor setting the Header and Footer screens force while their
 * canvas is open, so a header or footer entered there has its blocks locked
 * to their content, words and images only. Read it with `getSettings()`.
 */
export const LOCKED_PART_CONTENT_SETTING = 'cnlLocksPartContent';

export const DEFAULT_DEVICE = 'desktop';

// The preview's devices, as the editor names them.
export const EDITOR_DEVICES = {
	desktop: 'Desktop',
	mobile: 'Mobile',
	tablet: 'Tablet',
};

// How long to hold a switch to Browse for the preview to load.
export const PREVIEW_WAIT_TIMEOUT_MS = 15000;
