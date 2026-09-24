/**
 * The changes waiting to be saved, in the user's terms, with ways to save or
 * discard them.
 *
 * Changes are listed the way core's review lists them: each edited site
 * setting is a change of its own, and every other edited record is one.
 */

/**
 * WordPress dependencies
 */
import { store as coreStore } from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEntitiesSavedStatesIsDirty } from '@wordpress/editor';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';

/*
 * Named as the editor names them, so a change reads as the place it was made.
 */
const SITE_SETTING_LABELS = {
	title: __( 'Site name' ),
	description: __( 'Tagline' ),
	site_logo: __( 'Logo' ),
	site_icon: __( 'Browser icon' ),
};

const TYPE_LABELS = {
	'postType/page': __( 'Page' ),
	'postType/post': __( 'Post' ),
	'postType/wp_navigation': __( 'Menu' ),
	'postType/wp_template': __( 'Layout' ),
	'postType/wp_template_part': __( 'Site part' ),
	'postType/wp_block': __( 'Section' ),
};

function describeSiteSetting( property, value ) {
	let detail = __( 'Site setting' );

	if ( property === 'title' || property === 'description' ) {
		detail = value
			? sprintf(
					/* translators: %s: The new value of a site setting. */
					__( 'Changed to “%s”' ),
					value
				)
			: __( 'Left empty' );
	} else if ( property === 'site_logo' || property === 'site_icon' ) {
		detail = value ? __( 'New image' ) : __( 'Image removed' );
	}

	return {
		label: SITE_SETTING_LABELS[ property ] || property,
		detail,
	};
}

function describeChange( record, { site, getEntityConfig } ) {
	const { kind, name, property, title } = record;

	if ( kind === 'root' && name === 'site' ) {
		return describeSiteSetting( property, site?.[ property ] );
	}

	if ( kind === 'root' && name === 'globalStyles' ) {
		return {
			label: __( 'Colors & fonts' ),
			detail: __( 'The look of your whole site' ),
		};
	}

	const type =
		TYPE_LABELS[ `${ kind }/${ name }` ] ||
		getEntityConfig( kind, name )?.label ||
		name;

	return { label: title || type, detail: type };
}

function getChangeId( { kind, name, key, property } ) {
	return [ kind, name, key ?? '', property ?? '' ].join( '|' );
}

/**
 * @return {Object} `changes`, each with an `id`, a `label` and a `detail`,
 *                  whether they are saving, and `save`, `discard` and
 *                  `discardAll` actions.
 */
export function useChanges() {
	const { dirtyEntityRecords } = useEntitiesSavedStatesIsDirty();
	const { editedSite, savedSite, getEntityConfig, isSaving } = useSelect(
		( select ) => {
			const store = select( coreStore );

			return {
				editedSite: store.getEditedEntityRecord( 'root', 'site' ),
				savedSite: store.getRawEntityRecord( 'root', 'site' ),
				getEntityConfig: store.getEntityConfig,
				isSaving: store
					.__experimentalGetDirtyEntityRecords()
					.some( ( { kind, name, key } ) =>
						store.isSavingEntityRecord( kind, name, key )
					),
			};
		},
		[]
	);
	const { clearEntityRecordEdits, editEntityRecord } =
		useDispatch( coreStore );
	const { saveDirtyEntities } = unlock( useDispatch( coreStore ) );

	const changes = dirtyEntityRecords.map( ( record ) => ( {
		...record,
		id: getChangeId( record ),
		...describeChange( record, { site: editedSite, getEntityConfig } ),
	} ) );

	/*
	 * A site setting is put back to its saved value, which core counts as no
	 * edit at all, so the site's other settings keep their edits. Anything
	 * else is one record, and loses all of its edits.
	 */
	const discard = ( { kind, name, key, property } ) => {
		if ( kind === 'root' && name === 'site' ) {
			editEntityRecord( 'root', 'site', undefined, {
				[ property ]: savedSite?.[ property ],
			} );
		} else {
			clearEntityRecordEdits( kind, name, key );
		}
	};

	const discardAll = () => changes.forEach( discard );

	// Core's own save, as its review uses: it saves site settings together
	// and publishes menus, and reports success or failure in a snackbar.
	const save = () => saveDirtyEntities( { dirtyEntityRecords } );

	return { changes, isSaving, save, discard, discardAll };
}
