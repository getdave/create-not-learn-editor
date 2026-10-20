/**
 * Lists of records as the editor shows them, with their unsaved changes.
 *
 * Imports nothing, so the chat can use it as well as the screens.
 */

const editedLists = new WeakMap();
const editedRecords = new WeakMap();

/**
 * A record with its unsaved changes to the fields it has. Edits worked out
 * on save, like a page's content from its blocks, are left out.
 *
 * @param {Object}  record Record as last saved.
 * @param {?Object} edits  The record's unsaved changes.
 * @return {Object} The record, or a copy with its changes.
 */
function applyEdits( record, edits ) {
	const changes = {};

	Object.entries( edits || {} ).forEach( ( [ key, value ] ) => {
		if ( key in record && typeof value !== 'function' ) {
			changes[ key ] = value;
		}
	} );

	const signature = JSON.stringify( changes );

	if ( signature === '{}' ) {
		return record;
	}

	const cached = editedRecords.get( record );

	if ( cached?.signature === signature ) {
		return cached.record;
	}

	const edited = { ...record, ...changes };

	editedRecords.set( record, { record: edited, signature } );

	return edited;
}

/**
 * Records from a list request with their unsaved changes, as the rest of the
 * editor shows them. `getEntityRecords` returns records as they were last
 * saved, so a page renamed but not saved yet would keep its old title.
 *
 * Only fields the request fetched change. While those changes stay the same,
 * so do the records and the list, so a `useSelect` returning the list doesn't
 * re-render on other edits, like typing on the page.
 *
 * @param {Object}  store Core data selectors, from `select( coreDataStore )`.
 * @param {string}  kind  Entity kind.
 * @param {string}  name  Entity name.
 * @param {?Object} query Query for `getEntityRecords`.
 * @return {?Object[]} Records, or `null` until they have loaded.
 */
export function getEditedEntityRecords( store, kind, name, query ) {
	const records = store.getEntityRecords( kind, name, query );

	if ( ! records?.length ) {
		return records;
	}

	const edited = records.map( ( record ) =>
		applyEdits(
			record,
			store.getEntityRecordEdits( kind, name, record.id )
		)
	);

	if ( edited.every( ( record, index ) => record === records[ index ] ) ) {
		return records;
	}

	const previous = editedLists.get( records );

	if ( previous?.every( ( record, index ) => record === edited[ index ] ) ) {
		return previous;
	}

	editedLists.set( records, edited );

	return edited;
}
