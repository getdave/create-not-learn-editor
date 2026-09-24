/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch } from '@wordpress/data';
import {
	layout,
	navigation,
	siteLogo,
	styles,
	symbol,
	symbolFilled,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { registerTemplatePartEditing } from '../../../src/editor-extensions/template-part-editing';
import { enhanceSidebar } from './sidebar';

export async function init() {
	registerTemplatePartEditing();

	const menuIcons = {
		identity: siteLogo,
		navigation,
		patterns: symbol,
		styles,
		templateParts: symbolFilled,
		templates: layout,
	};

	Object.entries( menuIcons ).forEach( ( [ id, icon ] ) => {
		dispatch( bootStore ).updateMenuItem( id, { icon } );
	} );

	enhanceSidebar( { userName: window.createNotLearnEditor?.userName } );
}
