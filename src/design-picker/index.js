/**
 * The modal shell shared by "Add a page" and "Add a section".
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the editor layer loads the section picker from app init. See
 * `src/editor-layer/index.js`.
 */

export {
	DesignPicker,
	DesignPickerNav,
	GridShapeIcon,
	GroupHeading,
	StartFromScratch,
} from './design-picker';
