/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	createElement,
	useEffect,
	useMemo,
	useRef,
} from '@wordpress/element';

const upstreamModuleUrl =
	window.createNotLearnEditor?.lazyEditorModuleUrl || '';

if ( ! upstreamModuleUrl ) {
	throw new Error( 'The Gutenberg lazy editor module URL is unavailable.' );
}

const upstream = await import(
	/* webpackIgnore: true */ upstreamModuleUrl
);

const UpstreamEditor = upstream.Editor;

/**
 * Preserve lazy-editor's resolved theme and global styles when boot supplies
 * route-specific editor settings.
 *
 * Gutenberg PR #79581 fixes this in the package by merging both style arrays.
 * Released Gutenberg 23.5.1 replaces the resolved styles instead, so remove
 * boot's style override until the upstream fix is available in the dependency.
 *
 * @param {Object} props Editor props.
 * @return {Element} The released lazy editor with compatible settings.
 */
export function Editor( { postId, postType, settings, ...props } ) {
	const initializedEntities = useRef( new Set() );
	const entityKey = `${ postType || '' }:${ postId || '' }`;
	const { blocks, hasUndefinedContentEdit, rawContent } = useSelect(
		( select ) => {
			if ( ! postId || ! postType ) {
				return {};
			}

			const store = select( coreDataStore );
			const edits = store.getEntityRecordNonTransientEdits(
				'postType',
				postType,
				postId
			) || {};
			return {
				blocks: store.getEditedEntityRecord(
					'postType',
					postType,
					postId
				)?.blocks,
				rawContent: store.getEntityRecord(
					'postType',
					postType,
					postId,
					{ context: 'edit' }
				)?.content?.raw,
				hasUndefinedContentEdit:
					Object.hasOwn( edits, 'content' ) &&
					edits.content === undefined,
			};
		},
		[ postId, postType ]
	);
	const { editEntityRecord } = useDispatch( coreDataStore );
	const compatibleSettings = useMemo( () => {
		if ( ! settings || ! Object.hasOwn( settings, 'styles' ) ) {
			return settings;
		}

		const { styles: _routeStyles, ...restSettings } = settings;
		return restSettings;
	}, [ settings ] );

	useEffect( () => {
		if (
			! postId ||
			! postType ||
			typeof rawContent !== 'string'
		) {
			return;
		}

		if ( initializedEntities.current.has( entityKey ) ) {
			if ( ! hasUndefinedContentEdit ) {
				return;
			}

			const timeout = window.setTimeout( () => {
				editEntityRecord(
					'postType',
					postType,
					postId,
					{ content: rawContent },
					{ undoIgnore: true }
				);
			} );
			return () => window.clearTimeout( timeout );
		}

		if ( blocks?.length ) {
			const timeout = window.setTimeout( () => {
				initializedEntities.current.add( entityKey );
				if ( hasUndefinedContentEdit ) {
					editEntityRecord(
						'postType',
						postType,
						postId,
						{ content: rawContent },
						{ undoIgnore: true }
					);
				}
			}, 500 );
			return () => window.clearTimeout( timeout );
		}

		if ( ! rawContent.trim() ) {
			initializedEntities.current.add( entityKey );
			return;
		}

		const timeout = window.setTimeout( () => {
			initializedEntities.current.add( entityKey );
			editEntityRecord(
				'postType',
				postType,
				postId,
				{ blocks: parse( rawContent ), content: rawContent },
				{ undoIgnore: true }
			);
		}, 750 );
		return () => window.clearTimeout( timeout );
	}, [
		blocks,
		editEntityRecord,
		entityKey,
		hasUndefinedContentEdit,
		postId,
		postType,
		rawContent,
	] );

	return createElement( UpstreamEditor, {
		...props,
		key: entityKey,
		postId,
		postType,
		settings: compatibleSettings,
	} );
}

export const Preview = upstream.Preview;
export const loadEditorAssets = upstream.loadEditorAssets;
export const useEditorAssets = upstream.useEditorAssets;
export const useEditorSettings = upstream.useEditorSettings;
