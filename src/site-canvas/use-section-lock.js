/**
 * In Edit, every section of the page made of other blocks starts
 * content-only: its words, images and links can be changed, but not its
 * layout or the blocks it is built from, until "Edit" on its toolbar unlocks
 * it.
 *
 * Core already treats a block as a content-only section when its inner blocks
 * are locked with `templateLock: 'contentOnly'`, and lifts that lock while
 * the section is being edited, so blocks can be added and moved inside it.
 * So each of the page's sections is given that lock in the block editor's own
 * settings for it, never in its attributes: nothing is saved with the page,
 * and leaving Edit puts the settings back as they were.
 *
 * The settings are written by each block's inner blocks as they render, so
 * the editor's action for writing them is wrapped while Edit is on, to keep
 * the lock in place, and newly added sections are locked as they arrive.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import {
	blockEditorStore,
	useEffect,
	useRegistry,
} from '../wordpress-packages';

const LOCK = 'contentOnly';

/**
 * @param {boolean} isActive Whether to lock the page's sections.
 */
export function useSectionLock( isActive ) {
	const registry = useRegistry();

	useEffect( () => {
		if ( ! isActive ) {
			return undefined;
		}

		const actions = registry.dispatch( blockEditorStore );
		const selectors = unlock( registry.select( blockEditorStore ) );
		const original = actions.updateBlockListSettings;
		// What each locked section had before, `null` for none at all.
		const previous = new Map();

		/*
		 * Sections made of other blocks. A section that is a single block,
		 * like a paragraph, has nothing inside to unlock, and locking it would
		 * only take away its text tools, such as bold and links. Without a
		 * section root, as on a template, there is no page to lock.
		 */
		const getSectionIds = () => {
			const root = selectors.getSectionRootClientId();

			return root
				? selectors
						.getBlockOrder( root )
						.filter(
							( clientId ) =>
								selectors.getBlockOrder( clientId ).length > 0
						)
				: [];
		};
		const isSection = ( clientId ) => getSectionIds().includes( clientId );
		const withLock = ( clientId, settings ) =>
			isSection( clientId )
				? { ...settings, templateLock: LOCK }
				: settings;

		actions.updateBlockListSettings = ( clientId, settings ) => {
			if ( typeof clientId === 'string' ) {
				if ( isSection( clientId ) ) {
					previous.set( clientId, settings ?? null );
				}

				return original( clientId, withLock( clientId, settings ) );
			}

			return original(
				Object.fromEntries(
					Object.entries( clientId ).map( ( [ id, next ] ) => {
						if ( isSection( id ) ) {
							previous.set( id, next ?? null );
						}

						return [ id, withLock( id, next ) ];
					} )
				),
				settings
			);
		};

		const lockSections = () => {
			const updates = {};

			getSectionIds().forEach( ( clientId ) => {
				const settings = selectors.getBlockListSettings( clientId );

				if ( settings?.templateLock === LOCK ) {
					return;
				}

				if ( ! previous.has( clientId ) ) {
					previous.set( clientId, settings ?? null );
				}

				updates[ clientId ] = { ...settings, templateLock: LOCK };
			} );

			if ( Object.keys( updates ).length ) {
				original( updates );
			}
		};

		lockSections();

		// Sections added, or a section's blocks changed, are locked as they
		// arrive. Compared by content, as the list is new on every read.
		let sectionsKey = getSectionIds().join();
		const unsubscribe = registry.subscribe( () => {
			const nextKey = getSectionIds().join();

			if ( nextKey !== sectionsKey ) {
				sectionsKey = nextKey;
				lockSections();
			}
		}, blockEditorStore );

		return () => {
			unsubscribe();
			actions.updateBlockListSettings = original;
			unlock( actions ).stopEditingContentOnlySection();

			const restores = {};

			previous.forEach( ( settings, clientId ) => {
				if ( selectors.getBlockName( clientId ) ) {
					restores[ clientId ] = settings || undefined;
				}
			} );

			if ( Object.keys( restores ).length ) {
				original( restores );
			}
		};
	}, [ isActive, registry ] );
}
