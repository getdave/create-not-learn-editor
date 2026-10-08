/**
 * The "Add a section" picker, shared by the Pages screen and the editor.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the editor layer loads it from app init. See
 * `src/editor-layer/index.js`.
 */

export { getPlacementText } from './placement';
export { SectionPicker } from './section-picker';
export {
	createBlankSection,
	getPatternSectionBlocks,
	isSectionPattern,
} from './patterns';
