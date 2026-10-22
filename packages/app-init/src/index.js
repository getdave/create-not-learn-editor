/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch } from '@wordpress/data';
import {
	color,
	layout,
	navigation,
	siteLogo,
	styles,
	symbol,
	symbolFilled,
	typography,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { preloadDeferredWhenIdle } from '../../../src/app-init-deferred';
import { mountChat } from '../../../src/chat';
import { mountCommands } from '../../../src/commands';
import { registerFontSizeToolbar } from '../../../src/editor-extensions/font-size-toolbar';
import { registerSectionMenu } from '../../../src/editor-extensions/section-menu';
import { registerSectionPatterns } from '../../../src/editor-extensions/section-patterns';
import { registerTemplatePartEditing } from '../../../src/editor-extensions/template-part-editing';
import { mountEditorLayer } from '../../../src/editor-layer';
import { registerLayoutWireframes } from '../../../src/layouts';
import { mountTopBar } from '../../../src/top-bar';
import { mountWorkspaces } from '../../../src/workspaces';
import { enhanceSidebar } from './sidebar';

export async function init() {
	registerSectionPatterns();
	registerSectionMenu();
	registerFontSizeToolbar();
	registerTemplatePartEditing();
	registerLayoutWireframes();
	mountEditorLayer();

	const menuIcons = {
		colors: color,
		fonts: typography,
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
	mountCommands();
	mountChat();
	enhanceSidebar( { userName: window.createNotLearnEditor?.userName } );

	// The chat's panel and the section picker, ready before they're opened.
	preloadDeferredWhenIdle();
}
