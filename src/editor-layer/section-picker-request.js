/**
 * Where the editor's section picker was asked to add a section, if it was.
 *
 * Kept apart from the picker, `section-picker.jsx`, so app init can take
 * requests without loading the picker: it comes from the app-init-deferred
 * module, the first time it's asked for. See `src/app-init-deferred.js`.
 *
 * Kept in a data store, registered once by name, so a request from a route,
 * built separately from app init, reaches the picker the layer renders.
 */

/**
 * WordPress dependencies
 */
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useSelect,
} from '@wordpress/data';

export const STORE_NAME = 'create-not-learn-editor/section-picker';

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer( state = null, action ) {
				return action.type === 'SET_SECTION_PICKER_REQUEST'
					? action.request
					: state;
			},
			actions: {
				setRequest: ( request ) => ( {
					request,
					type: 'SET_SECTION_PICKER_REQUEST',
				} ),
			},
			selectors: {
				getRequest: ( state ) => state,
			},
		} )
	);
}

/**
 * Open the section picker to add a section at a place in the editor.
 *
 * @param {Object}  place              Where the section goes.
 * @param {?string} place.rootClientId Parent block's client ID.
 * @param {number}  place.index        Index among the parent's blocks.
 */
export function openSectionPicker( { rootClientId, index } ) {
	dispatch( STORE_NAME ).setRequest( { index, rootClientId } );
}

/**
 * Close the section picker, if it is open.
 */
export function closeSectionPicker() {
	if ( select( STORE_NAME ).getRequest() ) {
		dispatch( STORE_NAME ).setRequest( null );
	}
}

/**
 * @return {?Object} Where the picker was asked to add a section, kept up to
 *                   date, or `null` while it isn't open.
 */
export function useSectionPickerRequest() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getRequest(),
		[]
	);
}
