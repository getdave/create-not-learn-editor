export const SURFACE_PREVIEW = 'preview';
export const SURFACE_EDITOR = 'editor';

/*
 * A block editor setting the site canvas forces while its editor is open for
 * quick changes, so editor extensions can hold back what is meant for the
 * full-screen editor. Read it with `getSettings()`.
 */
export const QUICK_EDIT_SETTING = 'cnlIsQuickEdit';

export const DEFAULT_DEVICE = 'desktop';

// The preview's devices, as the editor names them.
export const EDITOR_DEVICES = {
	desktop: 'Desktop',
	mobile: 'Mobile',
	tablet: 'Tablet',
};

// How long to hold a switch to Preview for the preview to load.
export const PREVIEW_WAIT_TIMEOUT_MS = 15000;
