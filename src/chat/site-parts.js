/**
 * Opening the header or footer for a language model to change its words,
 * links, images and social links.
 *
 * On a page, the header's and footer's blocks are locked, as they show on
 * every page, until someone chooses Edit header or Edit footer. Agentic
 * Editor's tools stop at that lock, so the chat opens the part the same
 * way first: in Edit, in the spotlight, its blocks open to their content.
 * See `requestOpenPart()` in `src/site-canvas/mode.js`.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockType, store as blocksStore } from '@wordpress/blocks';
import { select, subscribe } from '@wordpress/data';

/**
 * Internal dependencies
 */
import {
	MODE_EDIT,
	PART_CONTENT,
	STORE_NAME as CANVAS_STORE,
	requestOpenPart,
	setCanvasMode,
} from '../site-canvas/mode';

// How long the canvas has to open the part.
const OPEN_TIMEOUT_MS = 8000;

// How many of the part's blocks to describe.
const MAX_BLOCKS = 80;

/**
 * Wait for a condition, as the stores change.
 *
 * @param {Function} getValue Returns what is waited for, or a falsy value.
 * @return {Promise<*>} The value, or null if it took too long.
 */
function waitFor( getValue ) {
	const value = getValue();

	if ( value ) {
		return Promise.resolve( value );
	}

	return new Promise( ( resolve ) => {
		const finish = ( result ) => {
			window.clearTimeout( timeout );
			unsubscribe();
			resolve( result );
		};
		const timeout = window.setTimeout(
			() => finish( null ),
			OPEN_TIMEOUT_MS
		);
		const unsubscribe = subscribe( () => {
			const next = getValue();

			if ( next ) {
				finish( next );
			}
		} );
	} );
}

/**
 * The blocks in an open part that can be changed, with what can be changed
 * in each: its content attributes, like a paragraph's words or a social
 * link's address. Each says what it is, like "Facebook" for a social link,
 * from its variation.
 *
 * @param {string} clientId The part.
 * @return {Object[]} `{ clientId, name, kind, attributes }` items, in order.
 */
function getEditableBlocks( clientId ) {
	const store = select( blockEditorStore );
	const blocks = [];

	const visit = ( id ) => {
		if ( blocks.length >= MAX_BLOCKS ) {
			return;
		}

		const name = store.getBlockName( id );
		const blockType = getBlockType( name );
		const roles = blockType?.attributes || {};
		const all = store.getBlockAttributes( id ) || {};
		const attributes = Object.fromEntries(
			Object.entries( all )
				.filter( ( [ key ] ) => roles[ key ]?.role === 'content' )
				.map( ( [ key, value ] ) => [
					key,
					typeof value === 'object' ? String( value ) : value,
				] )
		);

		if (
			store.getBlockEditingMode( id ) !== 'disabled' &&
			Object.keys( attributes ).length
		) {
			blocks.push( {
				clientId: id,
				name,
				kind:
					select( blocksStore ).getActiveBlockVariation( name, all )
						?.title || blockType?.title,
				attributes,
			} );
		}

		store.getBlockOrder( id ).forEach( visit );
	};

	store.getBlockOrder( clientId ).forEach( visit );

	return blocks;
}

/**
 * Open the header or footer on the canvas, as Edit header or Edit footer
 * does.
 *
 * @param {Object} args      What the model asked for.
 * @param {string} args.part `header` or `footer`.
 * @return {Promise<Object>} `{ opened, blocks, note }`, or `{ error }`.
 */
export async function openSitePart( { part } ) {
	const area = part === 'header' ? 'header' : 'footer';

	// Compose is for layouts and the page's order: parts open in Edit.
	setCanvasMode( MODE_EDIT );
	requestOpenPart( area );

	// Noted as open just before core opens it: its blocks open after.
	const clientId = await waitFor( () => {
		const open = select( CANVAS_STORE ).getOpenPart();
		const store = select( blockEditorStore );

		return ! select( CANVAS_STORE ).getPartRequest() &&
			open?.how === PART_CONTENT &&
			store
				.getBlockOrder( open.clientId )
				.some(
					( id ) => store.getBlockEditingMode( id ) !== 'disabled'
				)
			? open.clientId
			: null;
	} );

	if ( ! clientId ) {
		requestOpenPart( null );

		return {
			error: `The ${ area } couldn't be opened here. It opens on a page shown on the canvas: ask the user to open one, or to change it on the ${
				area === 'header' ? 'Header' : 'Footer'
			} screen.`,
		};
	}

	return {
		opened: area,
		blocks: getEditableBlocks( clientId ),
		note: `The ${ area } is open on the canvas. Change these blocks with editor_update-block, by clientId, changing only the attributes listed. The change shows on every page, so say so.`,
	};
}
