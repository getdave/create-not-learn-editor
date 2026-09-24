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
import { mountEditorLayer } from '../../../src/editor-layer';
import { mountTopBar } from '../../../src/top-bar';
import { mountWorkspaces } from '../../../src/workspaces';
import { enhanceSidebar } from './sidebar';

export async function init() {
	registerTemplatePartEditing();
	mountEditorLayer();

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

	mountWorkspaces();
	mountTopBar();
	enhanceSidebar( { userName: window.createNotLearnEditor?.userName } );
}
