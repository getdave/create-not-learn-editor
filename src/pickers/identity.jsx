/**
 * The site's name, tagline, logo and browser icon.
 *
 * Shared by the Name & logo screen, the Header and Footer screens and the
 * chat. Changes are unsaved edits to the `root/site` entity, which the canvas
 * shows as they are made.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads it from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { MediaUpload } from '@wordpress/media-utils';
import { InputControl, Spinner, Stack, Text } from '@wordpress/ui';

const EMPTY_OBJECT = {};

function getMediaUrl( media ) {
	return (
		media?.media_details?.sizes?.medium?.source_url ||
		media?.media_details?.sizes?.thumbnail?.source_url ||
		media?.source_url ||
		media?.url ||
		''
	);
}

function useMediaRecord( mediaId ) {
	return useSelect(
		( select ) => {
			if ( ! mediaId ) {
				return {
					isLoading: false,
					media: null,
				};
			}

			const args = [ 'root', 'media', mediaId ];
			const store = select( coreDataStore );

			return {
				isLoading:
					store.isResolving( 'getEntityRecord', args ) ||
					! store.hasFinishedResolution( 'getEntityRecord', args ),
				media: store.getEntityRecord( ...args ),
			};
		},
		[ mediaId ]
	);
}

/**
 * Site name, tagline, logo, and icon, edited through the `root/site` entity.
 *
 * Editing the entity rather than posting settings directly means the site
 * preview, which reads the same entity, updates as the user types, and the
 * save bar picks the changes up with any others.
 *
 * @return {Object} Site identity values and actions.
 */
export function useSiteIdentity() {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { hasEdits, isLoading, isSaving, site } = useSelect( ( select ) => {
		const store = select( coreDataStore );

		return {
			hasEdits: store.hasEditsForEntityRecord( 'root', 'site' ),
			isLoading: ! store.getEntityRecord( 'root', 'site' ),
			isSaving: store.isSavingEntityRecord( 'root', 'site' ),
			site: store.getEditedEntityRecord( 'root', 'site' ) || EMPTY_OBJECT,
		};
	}, [] );
	const savedSite = useSelect(
		( select ) =>
			select( coreDataStore ).getEntityRecord( 'root', 'site' ) ||
			EMPTY_OBJECT,
		[]
	);
	const update = ( edits ) =>
		editEntityRecord( 'root', 'site', undefined, edits );

	const discard = () =>
		update( {
			description: savedSite.description,
			site_icon: savedSite.site_icon,
			site_logo: savedSite.site_logo,
			title: savedSite.title,
		} );

	return {
		discard,
		hasEdits,
		isLoading,
		isSaving,
		site,
		update,
	};
}

export function SiteMediaSetting( {
	description,
	imageClassName = '',
	label,
	onChange,
	value,
} ) {
	const { isLoading, media } = useMediaRecord( value );
	const imageUrl = getMediaUrl( media );

	return (
		<div className="cnl-editor-identity-media">
			<div className="cnl-editor-identity-media__preview">
				{ imageUrl ? (
					<img alt="" className={ imageClassName } src={ imageUrl } />
				) : (
					<div
						aria-hidden
						className="cnl-editor-identity-media__placeholder"
					>
						{ isLoading ? <Spinner /> : label.charAt( 0 ) }
					</div>
				) }
			</div>
			<div className="cnl-editor-identity-media__details">
				<Text render={ <h3 /> } variant="heading-sm">
					{ label }
				</Text>
				<Text className="routes-styles__muted" variant="body-sm">
					{ description }
				</Text>
				<div className="cnl-editor-identity-media__actions">
					<MediaUpload
						allowedTypes={ [ 'image' ] }
						multiple={ false }
						onSelect={ ( nextMedia ) =>
							onChange( nextMedia?.id || 0 )
						}
						render={ ( { open } ) => (
							<Button
								__next40pxDefaultSize
								onClick={ open }
								variant="secondary"
							>
								{ value
									? __( 'Replace' )
									: __( 'Choose image' ) }
							</Button>
						) }
						value={ value || undefined }
					/>
					{ Boolean( value ) && (
						<Button
							__next40pxDefaultSize
							onClick={ () => onChange( 0 ) }
							variant="tertiary"
						>
							{ __( 'Remove' ) }
						</Button>
					) }
				</div>
			</div>
		</div>
	);
}

/**
 * The site's name, tagline, logo and browser icon, with a way to discard
 * changes to them. Shown on Name & logo, in the Header and Footer screens,
 * and in the chat.
 *
 * @param {Object}   props             Component props.
 * @param {boolean}  props.hideDiscard Whether to leave out the row offering to
 *                                     discard changes, for places that offer
 *                                     their own way back.
 * @param {Function} props.onEdit      Called with each edit once made.
 * @return {Element} The fields.
 */
export function SiteIdentityFields( { hideDiscard = false, onEdit } = {} ) {
	const {
		discard,
		hasEdits,
		isLoading,
		isSaving,
		site,
		update: updateSite,
	} = useSiteIdentity();
	const update = ( edits ) => {
		updateSite( edits );
		onEdit?.( edits );
	};
	useSiteIdentity();
	const logoId = site.site_logo || 0;

	if ( isLoading ) {
		return (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	}

	return (
		<>
			<div className="routes-styles__section">
				<InputControl
					description={ __(
						'Usually your business or project name.'
					) }
					label={ __( 'Site name' ) }
					onValueChange={ ( value ) => update( { title: value } ) }
					value={ site.title || '' }
				/>
				<InputControl
					description={ __(
						'A few words about what you do, like “Pottery classes in Hackney”.'
					) }
					label={ __( 'Tagline' ) }
					onValueChange={ ( value ) =>
						update( { description: value } )
					}
					placeholder={ __( 'What does your site offer?' ) }
					value={ site.description || '' }
				/>
				<SiteMediaSetting
					description={ __(
						'Shown in your header. Wide or square images both work.'
					) }
					label={ __( 'Logo' ) }
					onChange={ ( id ) => update( { site_logo: id } ) }
					value={ logoId }
				/>
				<SiteMediaSetting
					description={ __(
						'The small picture in browser tabs and bookmarks. Use a square image.'
					) }
					imageClassName="cnl-editor-identity-media__image--icon"
					label={ __( 'Browser icon' ) }
					onChange={ ( id ) => update( { site_icon: id } ) }
					value={ site.site_icon || 0 }
				/>
				{ Boolean( logoId && site.site_icon !== logoId ) && (
					<Button
						className="cnl-editor-identity__use-logo"
						onClick={ () => update( { site_icon: logoId } ) }
						variant="link"
					>
						{ __( 'Use my logo as the browser icon' ) }
					</Button>
				) }
			</div>
			{ hasEdits && ! hideDiscard && (
				<div className="routes-styles__save">
					<Text className="routes-styles__muted" variant="body-sm">
						{ __(
							'You are previewing changes. Visitors see them once you save.'
						) }
					</Text>
					<Stack gap="sm">
						<Button
							__next40pxDefaultSize
							disabled={ isSaving }
							onClick={ discard }
							variant="tertiary"
						>
							{ __( 'Discard changes' ) }
						</Button>
					</Stack>
				</div>
			) }
		</>
	);
}
