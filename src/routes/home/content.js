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
	getHomepageDocumentIconStatus,
	getHomepageDevice,
	getHomepagePreviewNavigationUrl,
	getHomepagePreviewContextUrl,
	getHomepagePreviewUrl,
	getPreviewHistoryState,
	isHomepagePreviewNavigationUrl,
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
	postListIcon,
	settingsIcon,
	tabletIcon,
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
	useCallback,
	useEffect,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

const EMPTY_OBJECT = {};
const DOCUMENT_ICON_BY_STATUS = {
	'home-latest-posts': homeIcon,
	'home-static': homeIcon,
	'posts-page': postListIcon,
};

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

function DeviceSwitcher( { device, setDevice } ) {
	return el(
		ToggleGroupControl,
		{
			__next40pxDefaultSize: true,
			__nextHasNoMarginBottom: true,
			className: 'cnl-editor-homepage-device-switcher__control',
			hideLabelFromVision: true,
			label: __( 'Preview device' ),
			onChange: setDevice,
			value: device,
		},
		getDeviceOptions().map( ( option ) =>
			el( ToggleGroupControlOptionIcon, {
				icon: option.icon,
				key: option.value,
				label: option.label,
				value: option.value,
			} )
		)
	);
}

function PageOptionsDropdown( {
	hasHomepageOptions,
	isBusy,
	onConfigureHomepage,
} ) {
	if ( ! hasHomepageOptions ) {
		return null;
	}

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

function getFrameUrl( frameWindow, fallbackUrl ) {
	try {
		return frameWindow?.location?.href || fallbackUrl;
	} catch {
		return fallbackUrl;
	}
}

function Canvas() {
	const navigate = useNavigate();
	const [ device, setDeviceState ] = useState( DEFAULT_HOMEPAGE_DEVICE );
	const [ frameWindow, setFrameWindow ] = useState( null );
	const [ previewHistoryState, setPreviewHistoryState ] = useState(
		getPreviewHistoryState()
	);
	const [ localPreviewError, setLocalPreviewError ] = useState( null );
	const [ previewContextUrl, setPreviewContextUrl ] = useState(
		getHomepagePreviewContextUrl( settings.homeUrl )
	);
	const previewHistoryRef = useRef( {
		currentUrl: '',
		maxPosition: 0,
		pendingDirection: null,
		position: 0,
	} );
	const homePreviewContextUrl = getHomepagePreviewContextUrl(
		settings.homeUrl
	);
	const previewUrl = getHomepagePreviewUrl( settings.homeUrl );
	const currentPreviewContextUrl = previewContextUrl || homePreviewContextUrl;
	const { isLoadingContext, previewContext, previewContextError } = useSelect(
		( select ) => {
			const store = select( cnlEditorStore );
			const resolverArgs = [ currentPreviewContextUrl, namespace ];

			return {
				isLoadingContext:
					store.isFetchingPreviewContext(
						currentPreviewContextUrl
					) ||
					( Boolean( currentPreviewContextUrl ) &&
						! store.hasFinishedResolution(
							'getPreviewContext',
							resolverArgs
						) ),
				previewContext:
					store.getPreviewContext(
						currentPreviewContextUrl,
						namespace
					) || EMPTY_OBJECT,
				previewContextError: store.getPreviewContextError(
					currentPreviewContextUrl
				),
			};
		},
		[ currentPreviewContextUrl ]
	);
	const previewError =
		localPreviewError ||
		( previewContextError ? getErrorMessage( previewContextError ) : null );
	const previewLabel = previewContext?.previewLabel || __( 'Home' );
	const previewStatusLabel = isLoadingContext
		? __( 'Loading preview details' )
		: previewContext?.previewStatusLabel || __( 'Preview' );
	const previewTypeLabel = previewContext?.previewTypeLabel || '';
	const previewMetaLabel = isLoadingContext
		? previewStatusLabel
		: [ previewTypeLabel, previewStatusLabel ]
				.filter( Boolean )
				.join( ' · ' );
	const documentIcon =
		DOCUMENT_ICON_BY_STATUS[
			getHomepageDocumentIconStatus(
				previewContext?.previewDocumentStatus
			)
		];
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
			const nextUrl = getFrameUrl( nextWindow, previewUrl );

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
			setPreviewContextUrl(
				getHomepagePreviewContextUrl( nextUrl, settings.homeUrl )
			);
			setPreviewHistoryState(
				getPreviewHistoryState( history.position, history.maxPosition )
			);
		},
		[ previewUrl ]
	);

	const keepPreviewNavigationScoped = useCallback(
		( iframe, nextWindow ) => {
			const nextUrl = getFrameUrl( nextWindow, previewUrl );
			const previewNavigationUrl = getHomepagePreviewNavigationUrl(
				nextUrl,
				previewUrl
			);

			if (
				previewNavigationUrl &&
				previewNavigationUrl !== nextUrl &&
				! isHomepagePreviewNavigationUrl( nextUrl, previewUrl )
			) {
				iframe.src = previewNavigationUrl;
				return false;
			}

			try {
				const frameDocument = nextWindow?.document;
				frameDocument?.addEventListener(
					'click',
					( event ) => {
						if (
							event.defaultPrevented ||
							event.metaKey ||
							event.ctrlKey ||
							event.shiftKey ||
							event.altKey
						) {
							return;
						}

						const anchor = event.target?.closest?.( 'a[href]' );
						if (
							! anchor ||
							anchor.hasAttribute( 'download' ) ||
							( anchor.target && anchor.target !== '_self' )
						) {
							return;
						}

						const guardedHref = getHomepagePreviewNavigationUrl(
							anchor.href,
							nextUrl
						);
						if ( guardedHref ) {
							anchor.href = guardedHref;
						}
					},
					true
				);
			} catch {
				return true;
			}

			return true;
		},
		[ previewUrl ]
	);

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

	const configureHomepage = () => {};

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
					previewContext?.previewEditLabel || __( 'Edit' )
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
					el(
						'div',
						{ className: 'cnl-editor-homepage-document__text' },
						el(
							'div',
							{
								className:
									'cnl-editor-homepage-document__heading',
							},
							documentIcon &&
								el( Icon, {
									className:
										'cnl-editor-homepage-document__icon',
									icon: documentIcon,
								} ),
							el(
								'h1',
								{
									className:
										'cnl-editor-homepage-document__title',
								},
								previewLabel
							)
						),
						previewMetaLabel &&
							el(
								'p',
								{
									className:
										'cnl-editor-homepage-document__meta',
								},
								previewMetaLabel
							)
					),
					el( PageOptionsDropdown, {
						hasHomepageOptions:
							previewContext?.previewStatus === 'homepage',
						isBusy: false,
						onConfigureHomepage: configureHomepage,
					} )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__right' },
				el(
					'div',
					{
						className:
							'cnl-editor-preview-canvas__device-switcher cnl-editor-homepage-device-switcher',
					},
					el( DeviceSwitcher, { device, setDevice } )
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
						const iframe = event.currentTarget;
						const nextWindow = event.currentTarget.contentWindow;
						if (
							! keepPreviewNavigationScoped( iframe, nextWindow )
						) {
							return;
						}
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
