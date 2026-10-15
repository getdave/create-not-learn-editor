/**
 * Taking back, saving and undoing the changes the chat's pickers make.
 *
 * The pickers make ordinary unsaved edits, the same as on their screens. The
 * chat notes how a record stood before its picker changed it, so it can put
 * the record back if the pick is cancelled, save just that record when the
 * pick is sent, and undo it after.
 *
 * An entity is `[ kind, name, key ]`, as core-data's actions take it.
 */

/**
 * WordPress dependencies
 */
import { parse as parseBlocks, serialize } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch, select } from '@wordpress/data';

/**
 * How a record's blocks stand, with any unsaved changes.
 *
 * @param {Object} record Edited post or template part record.
 * @return {Object[]} Its blocks.
 */
export function getEditedBlocks( record ) {
	if ( Array.isArray( record?.blocks ) ) {
		return record.blocks;
	}

	return typeof record?.content === 'string'
		? parseBlocks( record.content )
		: [];
}

/**
 * The edit that sets a record's blocks, as the editor makes it.
 *
 * @param {Object[]} blocks Blocks.
 * @return {Object} The edit.
 */
export function getBlocksEdit( blocks ) {
	return {
		blocks,
		// A new function on every edit, as the editor does, so each change
		// makes the record dirty and gets its own undo level.
		content: ( { blocks: edited = [] } ) => serialize( edited ),
	};
}

/**
 * The values to undo a saved pick with: how the record stood before it.
 *
 * Blocks are told apart from the markup they were saved as: the editor
 * expands some blocks when it loads them, like a pattern placed by name, so
 * a record with no unsaved changes is put back to its saved markup rather
 * than to the editor's blocks, which would save differently.
 *
 * @param {Object}   store     `coreDataStore` selectors.
 * @param {Array}    entity    `[ kind, name, key ]`.
 * @param {string[]} keys      The record's properties the picker changes.
 * @param {boolean}  hasBlocks Whether the picker changes the record's blocks.
 * @return {Object} The values.
 */
function getUndoValues( store, entity, keys, hasBlocks ) {
	const record = store.getEditedEntityRecord( ...entity ) || {};

	if ( ! hasBlocks ) {
		return Object.fromEntries(
			keys.map( ( key ) => [ key, record[ key ] ] )
		);
	}

	const saved = store.getRawEntityRecord( ...entity )?.content;

	if (
		! store.hasEditsForEntityRecord( ...entity ) &&
		typeof saved === 'string'
	) {
		return { blocks: parseBlocks( saved ), content: saved };
	}

	return getBlocksEdit( getEditedBlocks( record ) );
}

/**
 * Note how a record stands, before a picker changes it.
 *
 * @param {Array}    entity    `[ kind, name, key ]`.
 * @param {string[]} keys      The record's properties the picker changes.
 * @param {boolean}  hasBlocks Whether the picker changes the record's blocks.
 * @return {Object} `{ blocks, edits, values }`: the record's blocks, for
 *                  pickers that add to them; the unsaved edits to those
 *                  properties, to put back if the pick is cancelled; and
 *                  their values, to put back if it is undone once saved.
 */
export function takeSnapshot( entity, keys, hasBlocks = false ) {
	const store = select( coreDataStore );
	const edits = store.getEntityRecordEdits( ...entity ) || {};

	return {
		blocks: hasBlocks
			? getEditedBlocks( store.getEditedEntityRecord( ...entity ) )
			: undefined,
		edits: Object.fromEntries(
			keys.map( ( key ) => [ key, edits[ key ] ] )
		),
		values: getUndoValues( store, entity, keys, hasBlocks ),
	};
}

/**
 * Put a record back as it was before the pick. Core-data drops edits that
 * match the saved record, so a record that had none is clean again.
 *
 * @param {Array}  entity   `[ kind, name, key ]`.
 * @param {Object} snapshot From `takeSnapshot`.
 */
export function revertSnapshot( entity, snapshot ) {
	dispatch( coreDataStore ).editEntityRecord( ...entity, snapshot.edits );
}

/**
 * Save one record, and nothing else.
 *
 * @param {Array} entity `[ kind, name, key ]`.
 * @return {Promise} Resolves once saved, rejects if it fails.
 */
export function saveEntity( entity ) {
	return dispatch( coreDataStore ).saveEditedEntityRecord( ...entity, {
		throwOnError: true,
	} );
}

/**
 * Undo a saved pick: put the record back as it was, and save it.
 *
 * @param {Array}  entity   `[ kind, name, key ]`.
 * @param {Object} snapshot From `takeSnapshot`.
 * @return {Promise} Resolves once saved.
 */
export function restoreSnapshot( entity, snapshot ) {
	dispatch( coreDataStore ).editEntityRecord( ...entity, snapshot.values );

	return saveEntity( entity );
}

/**
 * @param {Array} entity `[ kind, name, key ]`.
 * @return {boolean} Whether the record has unsaved changes.
 */
export function hasEdits( entity ) {
	return select( coreDataStore ).hasEditsForEntityRecord( ...entity );
}
