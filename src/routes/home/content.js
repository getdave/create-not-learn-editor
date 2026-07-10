/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { namespace, settings } from '../../settings';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	DEFAULT_HOMEPAGE_DEVICE,
	getHomepageDevice,
	getHomepagePreviewUrl,
	getHomepageStatusTone,
	getPreviewHistoryState,
} from './preview';
import {
	Button,
	Dropdown,
	Icon,
	MenuGroup,
	MenuItem,
	Notice,
	Spinner,
	__,
	chevronDownIcon,
	chevronLeftIcon,
	chevronRightIcon,
	desktopIcon,
	el,
	externalIcon,
	homeIcon,
	mobileIcon,
	pencilIcon,
	settingsIcon,
	tabletIcon,
	useCallback,
	useDispatch,
	useEffect,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

const HOMEPAGE_CONFIGURED_EVENT = 'cnl-editor-homepage-configured';
const EMPTY_OBJECT = {};

function getDeviceOptions() {
	return [
		{
			icon: desktopIcon,
			label: __( 'Desktop view' ),
			value: 'desktop',
		},
		{
			icon: tabletIcon,
			label: __( 'Tablet view' ),
			value: 'tablet',
		},
		{
			icon: mobileIcon,
			label: __( 'Mobile view' ),
			value: 'mobile',
		},
	];
}

function DeviceButton( { currentDevice, icon, label, setDevice, value } ) {
	const isSelected = currentDevice === value;

	return el( Button, {
		'aria-pressed': isSelected,
		className: `cnl-editor-homepage-device-switcher__button${
			isSelected ? ' is-selected' : ''
		}`,
		icon,
		label,
		onClick: () => setDevice( value ),
		showTooltip: true,
		variant: 'tertiary',
	} );
}

function PageOptionsDropdown( { isBusy, onConfigureHomepage } ) {
	return el( Dropdown, {
		className: 'cnl-editor-homepage-options',
		contentClassName: 'cnl-editor-homepage-options__content',
		popoverProps: {
			placement: 'bottom',
		},
		renderContent: ( { onClose } ) =>
			el(
				MenuGroup,
				{ className: 'cnl-editor-homepage-options__menu' },
				el(
					MenuItem,
					{
						disabled: isBusy,
						icon: settingsIcon,
						onClick: () => {
							onClose();
							onConfigureHomepage();
						},
					},
					__( 'Configure Homepage' )
				)
			),
		renderToggle: ( { isOpen, onToggle } ) =>
			el( Button, {
				'aria-expanded': isOpen,
				className: 'cnl-editor-homepage-options__toggle',
				icon: chevronDownIcon,
				label: __( 'Page Options' ),
				onClick: onToggle,
				showTooltip: true,
				variant: 'tertiary',
			} ),
	} );
}

function HistoryButton( { canMove, direction, icon, label, onMove } ) {
	return el( Button, {
		className: `cnl-editor-homepage-toolbar__history-button is-${ direction }`,
		disabled: ! canMove,
		icon,
		label,
		onClick: () => onMove( direction ),
		showTooltip: true,
		variant: 'tertiary',
	} );
}

function HomepageStatusIndicator( { label, status } ) {
	const tone = getHomepageStatusTone( status );

	return el( 'span', {
		'aria-label': label,
		className: `cnl-editor-homepage-document__status is-${ tone }`,
		role: 'status',
		title: label,
	} );
}

function EmptyPreview() {
	return el(
		'div',
		{ className: 'cnl-editor-canvas-placeholder' },
		el( 'span', {
			'aria-hidden': true,
			className:
				'cnl-editor-canvas-placeholder__icon dashicons dashicons-admin-home',
		} ),
		el(
			'div',
			{ className: 'cnl-editor-canvas-placeholder__title' },
			__( 'Homepage preview unavailable' )
		),
		el(
			'p',
			{ className: 'cnl-editor-canvas-placeholder__description' },
			__( 'Configure the site URL before previewing the homepage.' )
		)
	);
}

function Canvas() {
	const navigate = useNavigate();
	const { invalidatePreviewContext, setupDefaults } =
		useDispatch( cnlEditorStore );
	const [ device, setDeviceState ] = useState( DEFAULT_HOMEPAGE_DEVICE );
	const [ frameWindow, setFrameWindow ] = useState( null );
	const [ previewHistoryState, setPreviewHistoryState ] = useState(
		getPreviewHistoryState()
	);
	const [ localPreviewError, setLocalPreviewError ] = useState( null );
	const [ isConfiguringHomepage, setIsConfiguringHomepage ] =
		useState( false );
	const [ refreshKey, setRefreshKey ] = useState( '' );
	const previewHistoryRef = useRef( {
		currentUrl: '',
		maxPosition: 0,
		pendingDirection: null,
		position: 0,
	} );
	const previewUrl = getHomepagePreviewUrl( settings.homeUrl, refreshKey );
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
	const previewStatus = previewContext?.previewStatus || 'homepage';
	const previewStatusLabel = isLoadingContext
		? __( 'Loading preview details' )
		: previewContext?.previewStatusLabel || __( 'Preview' );
	const editLink = previewContext?.editLink;
	const canEditPreview = Boolean(
		editLink && previewContext?.previewCanEdit !== false
	);

	const resetPreviewHistory = useCallback( () => {
		previewHistoryRef.current = {
			currentUrl: '',
			maxPosition: 0,
			pendingDirection: null,
			position: 0,
		};
		setFrameWindow( null );
		setPreviewHistoryState( getPreviewHistoryState() );
	}, [] );

	const syncPreviewHistory = useCallback(
		( nextWindow ) => {
			const history = previewHistoryRef.current;
			let nextUrl = previewUrl;

			try {
				nextUrl = nextWindow?.location?.href || previewUrl;
			} catch {
				nextUrl = previewUrl;
			}

			if ( ! history.currentUrl ) {
				history.currentUrl = nextUrl;
			} else if ( nextUrl && nextUrl !== history.currentUrl ) {
				if ( history.pendingDirection === 'back' ) {
					history.position = Math.max( 0, history.position - 1 );
				} else if ( history.pendingDirection === 'forward' ) {
					history.position = Math.min(
						history.maxPosition,
						history.position + 1
					);
				} else {
					history.position += 1;
					history.maxPosition = history.position;
				}

				history.currentUrl = nextUrl;
			}

			history.pendingDirection = null;
			setPreviewHistoryState(
				getPreviewHistoryState( history.position, history.maxPosition )
			);
		},
		[ previewUrl ]
	);

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

	useEffect( () => {
		resetPreviewHistory();
	}, [ previewUrl, resetPreviewHistory ] );

	const setDevice = ( value ) => {
		setDeviceState( getHomepageDevice( value ) );
	};

	const movePreviewHistory = ( direction ) => {
		const canMove =
			direction === 'back'
				? previewHistoryState.canGoBack
				: previewHistoryState.canGoForward;

		if ( ! frameWindow || ! canMove ) {
			return;
		}

		try {
			previewHistoryRef.current.pendingDirection = direction;

			if ( direction === 'back' ) {
				frameWindow.history.back();
			} else {
				frameWindow.history.forward();
			}
		} catch ( error ) {
			previewHistoryRef.current.pendingDirection = null;
			setLocalPreviewError( getErrorMessage( error ) );
		}
	};

	const configureHomepage = () => {
		setIsConfiguringHomepage( true );
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

	const editHomepage = () => {
		if ( canEditPreview ) {
			navigate( { to: editLink } );
		}
	};

	return el(
		'section',
		{
			className: `cnl-editor-canvas cnl-editor-preview-canvas cnl-editor-homepage-preview is-${ device }`,
		},
		el(
			'header',
			{
				className:
					'cnl-editor-canvas__toolbar cnl-editor-homepage-toolbar',
			},
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__left' },
				el(
					Button,
					{
						className: 'cnl-editor-homepage-toolbar__edit',
						disabled: ! canEditPreview,
						icon: pencilIcon,
						onClick: editHomepage,
						variant: 'primary',
					},
					previewContext?.previewEditLabel || __( 'Edit page' )
				),
				el(
					'div',
					{
						'aria-label': __( 'Preview history' ),
						className: 'cnl-editor-homepage-toolbar__history',
						role: 'group',
					},
					el( HistoryButton, {
						canMove: previewHistoryState.canGoBack,
						direction: 'back',
						icon: chevronLeftIcon,
						label: __( 'Back in preview' ),
						onMove: movePreviewHistory,
					} ),
					el( HistoryButton, {
						canMove: previewHistoryState.canGoForward,
						direction: 'forward',
						icon: chevronRightIcon,
						label: __( 'Forward in preview' ),
						onMove: movePreviewHistory,
					} )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__center' },
				el(
					'div',
					{
						className: 'cnl-editor-homepage-document',
					},
					el( Icon, {
						className: 'cnl-editor-homepage-document__icon',
						icon: homeIcon,
					} ),
					el(
						'h1',
						{ className: 'cnl-editor-homepage-document__title' },
						previewLabel
					),
					el( PageOptionsDropdown, {
						isBusy: isConfiguringHomepage,
						onConfigureHomepage: configureHomepage,
					} ),
					el( HomepageStatusIndicator, {
						label: previewStatusLabel,
						status: previewStatus,
					} )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__right' },
				el(
					'div',
					{
						'aria-label': __( 'Preview device' ),
						className:
							'cnl-editor-preview-canvas__device-switcher cnl-editor-homepage-device-switcher',
						role: 'group',
					},
					getDeviceOptions().map( ( option ) =>
						el( DeviceButton, {
							currentDevice: device,
							icon: option.icon,
							key: option.value,
							label: option.label,
							setDevice,
							value: option.value,
						} )
					)
				),
				el( Button, {
					className: 'cnl-editor-homepage-toolbar__external',
					disabled: ! settings.homeUrl,
					href: settings.homeUrl || undefined,
					icon: externalIcon,
					label: __( 'View site in new tab' ),
					rel: 'noreferrer',
					showTooltip: true,
					target: '_blank',
					variant: 'tertiary',
				} )
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
					onLoad: ( event ) => {
						const nextWindow = event.currentTarget.contentWindow;
						setFrameWindow( nextWindow );
						syncPreviewHistory( nextWindow );
					},
					src: previewUrl,
					title: __( 'Homepage preview' ),
				} ),
			! previewUrl && el( EmptyPreview )
		)
	);
}

const stage = undefined;

export { stage, Canvas as canvas };
