/**
 * What the Pages sidebar and the preview canvas tell each other about a page's
 * sections: which one is pointed at, which one is picked, and where a new one
 * would go.
 *
 * Boot renders the stage and the canvas as separate trees, so they share this
 * small store rather than props. None of it is saved: it is only where the
 * pointer and the selection are.
 */

/**
 * Internal dependencies
 */
import { useSyncExternalStore } from '../../../wordpress-packages';

const INITIAL_STATE = {
	// Section client ID under the pointer, in either surface.
	hoveredId: null,
	// Where a new section would be inserted, or `null` when not adding one.
	insertionIndex: null,
	// Section client ID picked in either surface.
	selectedId: null,
	// Bumped to ask the canvas to scroll the selected section into view.
	scrollRequest: 0,
	// Which surface last picked a section, so it doesn't scroll itself.
	selectedFrom: null,
};

let state = INITIAL_STATE;
const listeners = new Set();

function setState( partial ) {
	const next = { ...state, ...partial };

	if (
		Object.keys( next ).every( ( key ) => next[ key ] === state[ key ] )
	) {
		return;
	}

	state = next;
	listeners.forEach( ( listener ) => listener() );
}

function subscribe( listener ) {
	listeners.add( listener );

	return () => listeners.delete( listener );
}

export const sectionBridge = {
	getState: () => state,
	hover: ( hoveredId ) => setState( { hoveredId } ),
	reset: () => setState( INITIAL_STATE ),
	select: ( selectedId, from ) =>
		setState( {
			scrollRequest:
				from === 'canvas'
					? state.scrollRequest
					: state.scrollRequest + 1,
			selectedFrom: from,
			selectedId,
		} ),
	setInsertionIndex: ( insertionIndex ) => setState( { insertionIndex } ),
	subscribe,
};

/**
 * Read a value from the section bridge, re-rendering when it changes.
 *
 * @param {Function} selector Picks a value from the bridge state.
 * @return {*} The selected value.
 */
export function useSectionBridge( selector ) {
	return useSyncExternalStore( subscribe, () => selector( state ) );
}
