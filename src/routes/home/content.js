/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { addPreviewArgs, namespace, settings } from '../../settings';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	Button,
	Notice,
	Spinner,
	__,
	el,
	useDispatch,
	useEffect,
	useSelect,
	useState,
} from '../../wordpress-packages';

const HOMEPAGE_CONFIGURED_EVENT = 'cnl-editor-homepage-configured';
const EMPTY_OBJECT = {};

function getPreviewUrl( refreshKey ) {
	const previewUrl = addPreviewArgs( settings.homeUrl );

	if ( ! previewUrl || ! refreshKey ) {
		return previewUrl;
	}

	const url = new URL( previewUrl, window.location.origin );
	url.searchParams.set( 'cnl-editor-preview-refresh', refreshKey );

	return url.href;
}

function Stage() {
	const { setupDefaults } = useDispatch( cnlEditorStore );
	const [ setupState, setSetupState ] = useState( null );
	const [ isSettingUp, setIsSettingUp ] = useState( false );

	const runSetup = () => {
		setIsSettingUp( true );
		setSetupState( null );

		setupDefaults( namespace )
			.then( ( result ) => {
				setSetupState( result );

				if ( result?.success ) {
					window.dispatchEvent(
						new CustomEvent( HOMEPAGE_CONFIGURED_EVENT )
					);
				}
			} )
			.catch( ( error ) =>
				setSetupState( {
					success: false,
					message: getErrorMessage( error ),
				} )
			)
			.finally( () => setIsSettingUp( false ) );
	};

	return el(
		'div',
		{ className: 'cnl-editor-stage' },
		el(
			'div',
			{ className: 'cnl-editor-stage__header' },
			el( 'span', {
				'aria-hidden': true,
				className: 'dashicons dashicons-admin-home',
			} ),
			el(
				'div',
				null,
				el( 'h1', null, __( 'Homepage' ) ),
				el(
					'p',
					null,
					__( 'Preview and configure the page visitors see first.' )
				)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-panel' },
			el( 'h2', null, __( 'Homepage configuration' ) ),
			el(
				'p',
				null,
				__(
					'Create or reuse a published Home page, set it as the static homepage, and ensure a basic navigation menu exists.'
				)
			),
			el(
				Button,
				{
					isBusy: isSettingUp,
					onClick: runSetup,
					variant: 'secondary',
				},
				__( 'Configure homepage' )
			),
			setupState &&
				el(
					Notice,
					{
						className: 'cnl-editor-panel__notice',
						isDismissible: false,
						status: setupState.success ? 'success' : 'error',
					},
					setupState.success
						? __( 'Homepage is configured.' )
						: setupState.message || __( 'Setup failed.' )
				)
		)
	);
}

function DeviceButton( { currentDevice, label, setDevice, value } ) {
	return el(
		Button,
		{
			'aria-pressed': currentDevice === value,
			className: currentDevice === value ? 'is-selected' : undefined,
			onClick: () => setDevice( value ),
			variant: currentDevice === value ? 'secondary' : 'tertiary',
		},
		label
	);
}

function Canvas() {
	const navigate = useNavigate();
	const { invalidatePreviewContext, setupDefaults } =
		useDispatch( cnlEditorStore );
	const [ device, setDevice ] = useState( 'desktop' );
	const [ frameWindow, setFrameWindow ] = useState( null );
	const [ localPreviewError, setLocalPreviewError ] = useState( null );
	const [ isConfiguringHomepage, setIsConfiguringHomepage ] =
		useState( false );
	const [ isPageOptionsOpen, setIsPageOptionsOpen ] = useState( false );
	const [ refreshKey, setRefreshKey ] = useState( '' );
	const previewUrl = getPreviewUrl( refreshKey );
	const { isLoadingContext, previewContext, previewContextError } = useSelect(
		( select ) => {
			const store = select( cnlEditorStore );
			const resolverArgs = [ settings.homeUrl, namespace ];

			return {
				isLoadingContext:
					store.isFetchingPreviewContext( settings.homeUrl ) ||
					( Boolean( settings.homeUrl ) &&
						! store.hasFinishedResolution(
							'getPreviewContext',
							resolverArgs
						) ),
				previewContext:
					store.getPreviewContext( settings.homeUrl, namespace ) ||
					EMPTY_OBJECT,
				previewContextError: store.getPreviewContextError(
					settings.homeUrl
				),
			};
		},
		[]
	);
	const previewError =
		localPreviewError ||
		( previewContextError ? getErrorMessage( previewContextError ) : null );
	const previewLabel = previewContext?.previewLabel || __( 'Home' );
	const previewStatus = previewContext?.previewStatusLabel || __( 'Preview' );
	const editLink = previewContext?.editLink;

	useEffect( () => {
		const refreshPreview = () => {
			invalidatePreviewContext( settings.homeUrl, namespace );
			setRefreshKey( String( Date.now() ) );
		};

		window.addEventListener( HOMEPAGE_CONFIGURED_EVENT, refreshPreview );

		return () => {
			window.removeEventListener(
				HOMEPAGE_CONFIGURED_EVENT,
				refreshPreview
			);
		};
	}, [ invalidatePreviewContext ] );

	const movePreviewHistory = ( direction ) => {
		try {
			if ( direction === 'back' ) {
				frameWindow?.history.back();
			} else {
				frameWindow?.history.forward();
			}
		} catch ( error ) {
			setLocalPreviewError( getErrorMessage( error ) );
		}
	};

	const configureHomepage = () => {
		setIsConfiguringHomepage( true );
		setIsPageOptionsOpen( false );
		setLocalPreviewError( null );

		setupDefaults( namespace )
			.then( ( result ) => {
				if ( result?.success ) {
					invalidatePreviewContext( settings.homeUrl, namespace );
					window.dispatchEvent(
						new CustomEvent( HOMEPAGE_CONFIGURED_EVENT )
					);
					return;
				}

				setLocalPreviewError(
					result?.message || __( 'Homepage configuration failed.' )
				);
			} )
			.catch( ( error ) =>
				setLocalPreviewError( getErrorMessage( error ) )
			)
			.finally( () => setIsConfiguringHomepage( false ) );
	};

	return el(
		'section',
		{ className: 'cnl-editor-canvas cnl-editor-preview-canvas' },
		el(
			'header',
			{ className: 'cnl-editor-canvas__toolbar' },
			el(
				'div',
				null,
				el(
					'div',
					{ className: 'cnl-editor-canvas__document' },
					el(
						'div',
						{ className: 'cnl-editor-canvas__label' },
						previewLabel
					),
					previewContext?.previewStatus === 'homepage' &&
						el(
							'div',
							{ className: 'cnl-editor-page-options' },
							el(
								Button,
								{
									'aria-expanded': isPageOptionsOpen,
									'aria-haspopup': 'menu',
									className:
										'cnl-editor-page-options__toggle',
									onClick: () =>
										setIsPageOptionsOpen(
											( isOpen ) => ! isOpen
										),
									variant: 'tertiary',
								},
								__( 'Page Options' )
							),
							isPageOptionsOpen &&
								el(
									'div',
									{
										className:
											'cnl-editor-page-options__menu',
										role: 'menu',
									},
									el(
										'button',
										{
											className:
												'cnl-editor-page-options__item',
											onClick: configureHomepage,
											role: 'menuitem',
											type: 'button',
										},
										__( 'Configure Homepage' )
									)
								)
						)
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					isLoadingContext
						? __( 'Loading preview details' )
						: previewStatus
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-canvas__actions' },
				el(
					Button,
					{
						disabled: ! frameWindow,
						label: __( 'Back in preview' ),
						onClick: () => movePreviewHistory( 'back' ),
						variant: 'tertiary',
					},
					__( 'Back' )
				),
				el(
					Button,
					{
						disabled: ! frameWindow,
						label: __( 'Forward in preview' ),
						onClick: () => movePreviewHistory( 'forward' ),
						variant: 'tertiary',
					},
					__( 'Forward' )
				),
				el(
					Button,
					{
						isBusy: isConfiguringHomepage,
						onClick: configureHomepage,
						variant: 'secondary',
					},
					__( 'Configure homepage' )
				),
				el(
					Button,
					{
						onClick: () => navigate( { to: '/navigation' } ),
						variant: 'secondary',
					},
					__( 'Customize navigation' )
				),
				el(
					Button,
					{
						disabled: ! editLink,
						onClick: () => {
							if ( editLink ) {
								navigate( { to: editLink } );
							}
						},
						variant: 'primary',
					},
					previewContext?.previewEditLabel || __( 'Edit page' )
				),
				el(
					Button,
					{
						href: settings.homeUrl,
						rel: 'noreferrer',
						target: '_blank',
						variant: 'tertiary',
					},
					__( 'View site in new tab' )
				)
			)
		),
		previewError &&
			el(
				Notice,
				{
					className: 'cnl-editor-preview-canvas__notice',
					isDismissible: false,
					status: 'error',
				},
				previewError
			),
		el(
			'div',
			{ className: 'cnl-editor-preview-canvas__device-switcher' },
			el( DeviceButton, {
				currentDevice: device,
				label: __( 'Desktop view' ),
				setDevice,
				value: 'desktop',
			} ),
			el( DeviceButton, {
				currentDevice: device,
				label: __( 'Tablet view' ),
				setDevice,
				value: 'tablet',
			} ),
			el( DeviceButton, {
				currentDevice: device,
				label: __( 'Mobile view' ),
				setDevice,
				value: 'mobile',
			} )
		),
		el(
			'div',
			{
				className: `cnl-editor-canvas__frame-wrap cnl-editor-preview-canvas__frame-wrap is-${ device }`,
			},
			isLoadingContext &&
				el(
					'div',
					{ className: 'cnl-editor-preview-canvas__spinner' },
					el( Spinner )
				),
			previewUrl &&
				el( 'iframe', {
					className: 'cnl-editor-canvas__frame',
					onLoad: ( event ) =>
						setFrameWindow( event.currentTarget.contentWindow ),
					src: previewUrl,
					title: __( 'Homepage preview' ),
				} )
		)
	);
}

export { Stage as stage, Canvas as canvas };
