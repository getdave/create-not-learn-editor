/**
 * Internal dependencies
 */
import SitePreviewCanvas from './site-preview';
import {
	Button,
	InputControl,
	MediaUpload,
	Spinner,
	Stack,
	Text,
	__,
	coreDataStore,
	el,
	useDispatch,
	useSelect,
} from '../../wordpress-packages';

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
function useSiteIdentity() {
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

function SiteMediaSetting( {
	description,
	imageClassName = '',
	label,
	onChange,
	value,
} ) {
	const { isLoading, media } = useMediaRecord( value );
	const imageUrl = getMediaUrl( media );

	return el(
		'div',
		{ className: 'cnl-editor-identity-media' },
		el(
			'div',
			{ className: 'cnl-editor-identity-media__preview' },
			imageUrl
				? el( 'img', {
						alt: '',
						className: imageClassName,
						src: imageUrl,
					} )
				: el(
						'div',
						{
							'aria-hidden': true,
							className: 'cnl-editor-identity-media__placeholder',
						},
						isLoading ? el( Spinner ) : label.charAt( 0 )
					)
		),
		el(
			'div',
			{ className: 'cnl-editor-identity-media__details' },
			el( Text, { render: el( 'h3' ), variant: 'heading-sm' }, label ),
			el(
				Text,
				{ className: 'routes-styles__muted', variant: 'body-sm' },
				description
			),
			el(
				'div',
				{ className: 'cnl-editor-identity-media__actions' },
				el( MediaUpload, {
					allowedTypes: [ 'image' ],
					multiple: false,
					onSelect: ( nextMedia ) => onChange( nextMedia?.id || 0 ),
					render: ( { open } ) =>
						el(
							Button,
							{
								__next40pxDefaultSize: true,
								onClick: open,
								variant: 'secondary',
							},
							value ? __( 'Replace' ) : __( 'Choose image' )
						),
					value: value || undefined,
				} ),
				Boolean( value ) &&
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							onClick: () => onChange( 0 ),
							variant: 'tertiary',
						},
						__( 'Remove' )
					)
			)
		)
	);
}

export function SiteIdentityStage() {
	const { discard, hasEdits, isLoading, isSaving, site, update } =
		useSiteIdentity();
	const logoId = site.site_logo || 0;

	return el(
		'div',
		{ className: 'cnl-editor-stage routes-styles cnl-editor-identity' },
		el(
			Stack,
			{ direction: 'column', gap: 'xs' },
			el(
				Text,
				{ render: el( 'h1' ), variant: 'heading-lg' },
				__( 'Name & logo' )
			),
			el(
				Text,
				{ className: 'routes-styles__muted', variant: 'body-md' },
				__(
					'How your site introduces itself. Shown in your header, browser tabs, and search results.'
				)
			)
		),
		isLoading &&
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
		! isLoading &&
			el(
				'div',
				{ className: 'routes-styles__section' },
				el( InputControl, {
					description: __( 'Usually your business or project name.' ),
					label: __( 'Site name' ),
					onValueChange: ( value ) => update( { title: value } ),
					value: site.title || '',
				} ),
				el( InputControl, {
					description: __(
						'A few words about what you do, like “Pottery classes in Hackney”.'
					),
					label: __( 'Tagline' ),
					onValueChange: ( value ) =>
						update( { description: value } ),
					placeholder: __( 'What does your site offer?' ),
					value: site.description || '',
				} ),
				el( SiteMediaSetting, {
					description: __(
						'Shown in your header. Wide or square images both work.'
					),
					label: __( 'Logo' ),
					onChange: ( id ) => update( { site_logo: id } ),
					value: logoId,
				} ),
				el( SiteMediaSetting, {
					description: __(
						'The small picture in browser tabs and bookmarks. Use a square image.'
					),
					imageClassName: 'cnl-editor-identity-media__image--icon',
					label: __( 'Browser icon' ),
					onChange: ( id ) => update( { site_icon: id } ),
					value: site.site_icon || 0,
				} ),
				Boolean( logoId && site.site_icon !== logoId ) &&
					el(
						Button,
						{
							className: 'cnl-editor-identity__use-logo',
							onClick: () => update( { site_icon: logoId } ),
							variant: 'link',
						},
						__( 'Use my logo as the browser icon' )
					)
			),
		! isLoading &&
			hasEdits &&
			el(
				'div',
				{ className: 'routes-styles__save' },
				el(
					Text,
					{ className: 'routes-styles__muted', variant: 'body-sm' },
					__(
						'You are previewing changes. Visitors see them once you save.'
					)
				),
				el(
					Stack,
					{ gap: 'sm' },
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							disabled: isSaving,
							onClick: discard,
							variant: 'tertiary',
						},
						__( 'Undo changes' )
					)
				)
			)
	);
}

export function SiteIdentityCanvas() {
	return el( SitePreviewCanvas, {
		description: __( 'Your header updates as you type.' ),
		title: __( 'Live preview' ),
	} );
}
