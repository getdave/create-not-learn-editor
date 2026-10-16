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
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
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
	show_on_front: __( 'Your homepage' ),
	page_on_front: __( 'Your homepage' ),
	page_for_posts: __( 'Blog page' ),
};

/*
 * What the homepage shows is kept in three settings. Changed together, they
 * are one change: listed once, and discarded together.
 */
const HOMEPAGE_SETTINGS = [
	'show_on_front',
	'page_on_front',
	'page_for_posts',
];

const TYPE_LABELS = {
	'postType/page': __( 'Page' ),
	'postType/post': __( 'Post' ),
	'postType/wp_navigation': __( 'Menu' ),
	'postType/wp_template': __( 'Layout' ),
	'postType/wp_template_part': __( 'Site part' ),
	'postType/wp_block': __( 'Section' ),
};

function describeHomepage( site, getPageTitle ) {
	if ( site?.show_on_front !== 'page' ) {
		return __( 'Shows your latest posts' );
	}

	const title = getPageTitle( site?.page_on_front );

	return title
		? sprintf(
				/* translators: %s: page title. */
				__( 'Shows “%s”' ),
				title
			)
		: __( 'Shows a page' );
}

function describeSiteSetting( property, value, { site, getPageTitle } ) {
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
	} else if ( property === 'show_on_front' || property === 'page_on_front' ) {
		detail = describeHomepage( site, getPageTitle );
	} else if ( property === 'page_for_posts' ) {
		detail = getPageTitle( value ) || __( 'None' );
	}

	return {
		label: SITE_SETTING_LABELS[ property ] || property,
		detail,
	};
}

function describeChange( record, { site, getEntityConfig, getPageTitle } ) {
	const { kind, name, property, title } = record;

	if ( kind === 'root' && name === 'site' ) {
		return describeSiteSetting( property, site?.[ property ], {
			getPageTitle,
			site,
		} );
	}

	if ( kind === 'root' && name === 'globalStyles' ) {
		return {
			label: __( 'Site look' ),
			detail: __( 'The colors, fonts, and spacing of your whole site' ),
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

function getRecordId( { kind, name, key } ) {
	return [ kind, name, key ?? '' ].join( '|' );
}

// Long enough for the editor to load a discarded layout's parts and menus.
const DISCARD_SETTLE_MS = 1500;

/**
 * Put back what the editor changes by itself just after a discard.
 *
 * Discarding a layout's changes hands the editor its saved blocks again, and
 * the site parts and menus inside it load afresh. Some write themselves back
 * as they do, a menu tidying its links say, which core counts as a change
 * nobody made. For a moment after a discard, a post that wasn't changed
 * before it is put back as saved whenever the editor changes it. Its blocks
 * are kept, so the editor doesn't load it, and change it, again.
 *
 * @param {Object}      registry Data registry.
 * @param {Set<string>} kept     Records still changed after the discard, by
 *                               `getRecordId`.
 */
function putBackWhileSettling( registry, kept ) {
	let isPuttingBack = false;
	const unsubscribe = registry.subscribe( () => {
		if ( isPuttingBack ) {
			return;
		}

		const store = registry.select( coreStore );

		isPuttingBack = true;
		store
			.__experimentalGetDirtyEntityRecords()
			.filter(
				( record ) =>
					record.kind === 'postType' &&
					! kept.has( getRecordId( record ) )
			)
			.forEach( ( { kind, name, key } ) => {
				const saved = store.getRawEntityRecord( kind, name, key ) || {};
				const edits = store.getEntityRecordNonTransientEdits(
					kind,
					name,
					key
				);

				registry
					.dispatch( coreStore )
					.editEntityRecord(
						kind,
						name,
						key,
						Object.fromEntries(
							Object.keys( edits ).map( ( edit ) => [
								edit,
								saved[ edit ],
							] )
						),
						{ undoIgnore: true }
					);
			} );
		isPuttingBack = false;
	}, coreStore );

	window.setTimeout( unsubscribe, DISCARD_SETTLE_MS );
}

/**
 * @return {Object} `changes`, each with an `id`, a `label` and a `detail`,
 *                  whether they are saving, and `save`, `discard` and
 *                  `discardAll` actions.
 */
export function useChanges() {
	const { dirtyEntityRecords } = useEntitiesSavedStatesIsDirty();
	const {
		editedSite,
		savedSite,
		getEditedEntityRecord,
		getEntityConfig,
		isSaving,
	} = useSelect( ( select ) => {
		const store = select( coreStore );

		return {
			getEditedEntityRecord: store.getEditedEntityRecord,
			editedSite: store.getEditedEntityRecord( 'root', 'site' ),
			savedSite: store.getRawEntityRecord( 'root', 'site' ),
			getEntityConfig: store.getEntityConfig,
			isSaving: store
				.__experimentalGetDirtyEntityRecords()
				.some( ( { kind, name, key } ) =>
					store.isSavingEntityRecord( kind, name, key )
				),
		};
	}, [] );
	const { clearEntityRecordEdits, editEntityRecord } =
		useDispatch( coreStore );
	const getPageTitle = ( id ) =>
		( Number( id ) &&
			getEditedEntityRecord( 'postType', 'page', Number( id ) )
				?.title ) ||
		'';
	const { saveDirtyEntities } = unlock( useDispatch( coreStore ) );
	const registry = useRegistry();

	const isHomepageSwitched = dirtyEntityRecords.some(
		( { kind, name, property } ) =>
			kind === 'root' && name === 'site' && property === 'show_on_front'
	);
	const changes = dirtyEntityRecords
		.filter(
			( { kind, name, property } ) =>
				! isHomepageSwitched ||
				kind !== 'root' ||
				name !== 'site' ||
				property === 'show_on_front' ||
				! HOMEPAGE_SETTINGS.includes( property )
		)
		.map( ( record ) => ( {
			...record,
			id: getChangeId( record ),
			...describeChange( record, {
				getEntityConfig,
				getPageTitle,
				site: editedSite,
			} ),
		} ) );

	/*
	 * A site setting is put back to its saved value, which core counts as no
	 * edit at all, so the site's other settings keep their edits. Anything
	 * else is one record, and loses all of its edits.
	 */
	const discardOne = ( { kind, name, key, property } ) => {
		if ( kind === 'root' && name === 'site' ) {
			const properties =
				property === 'show_on_front' ? HOMEPAGE_SETTINGS : [ property ];

			editEntityRecord(
				'root',
				'site',
				undefined,
				Object.fromEntries(
					properties.map( ( setting ) => [
						setting,
						savedSite?.[ setting ],
					] )
				)
			);
		} else {
			clearEntityRecordEdits( kind, name, key );
		}
	};

	const discardRecords = ( records ) => {
		const discarded = new Set( records.map( getRecordId ) );
		const kept = new Set(
			dirtyEntityRecords
				.map( getRecordId )
				.filter( ( id ) => ! discarded.has( id ) )
		);

		records.forEach( discardOne );
		putBackWhileSettling( registry, kept );
	};

	const discard = ( change ) => discardRecords( [ change ] );

	const discardAll = () => discardRecords( changes );

	// Core's own save, as its review uses: it saves site settings together
	// and publishes menus, and reports success or failure in a snackbar.
	const save = () => saveDirtyEntities( { dirtyEntityRecords } );

	return { changes, isSaving, save, discard, discardAll };
}
