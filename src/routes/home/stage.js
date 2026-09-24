/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import {
	getLaunchProgress,
	getLaunchStepStatus,
	LAUNCH_STEP_IDS,
} from './checklist';
import {
	Button,
	Card,
	Icon,
	Link,
	ProgressBar,
	Spinner,
	Stack,
	Text,
	__,
	checkIcon,
	chevronRightIcon,
	coreDataStore,
	decodeEntities,
	el,
	sprintf,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];
const PUBLISHED_PAGES_QUERY = {
	per_page: 100,
	status: 'publish',
	_fields: 'id,date_gmt,modified_gmt',
};

function getLaunchSteps( frontPageId ) {
	return {
		identity: {
			description: __( 'Site name, tagline, and logo' ),
			title: __( 'Name & logo' ),
			to: '/identity',
		},
		styles: {
			description: __( 'Pick a look, then fine-tune it' ),
			title: __( 'Colors & fonts' ),
			to: '/styles',
		},
		homepage: {
			description: __( 'Make the first page visitors see your own' ),
			title: __( 'Your homepage' ),
			to: frontPageId
				? `/types/page/edit/${ frontPageId }`
				: '/types/page/list/default',
		},
		pages: {
			description: __( 'Add pages like About and Contact' ),
			title: __( 'Pages & menu' ),
			to: '/types/page/list/default',
		},
	};
}

function useLaunchData() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const site = store.getEntityRecord( 'root', 'site' );
		const globalStylesId = store.__experimentalGetCurrentGlobalStylesId?.();
		const globalStyles = globalStylesId
			? store.getEntityRecord( 'root', 'globalStyles', globalStylesId )
			: null;
		const pagesArgs = [ 'postType', 'page', PUBLISHED_PAGES_QUERY ];
		const pages = store.getEntityRecords( ...pagesArgs ) || EMPTY_ARRAY;
		const frontPageId =
			site?.show_on_front === 'page' ? site?.page_on_front : 0;

		return {
			frontPage: frontPageId
				? pages.find( ( page ) => page.id === frontPageId )
				: null,
			frontPageId,
			globalStyles,
			isLoading:
				! site ||
				! store.hasFinishedResolution( 'getEntityRecords', pagesArgs ),
			publishedPageCount: pages.length,
			site,
		};
	}, [] );
}

function StepStatus( { isDone } ) {
	return el(
		'span',
		{
			'aria-hidden': true,
			className: `cnl-site-hub__step-status${ isDone ? ' is-done' : '' }`,
		},
		isDone && el( Icon, { icon: checkIcon, size: 16 } )
	);
}

function LaunchStep( { isDone, onSelect, step } ) {
	return el(
		'li',
		null,
		el(
			Button,
			{
				__next40pxDefaultSize: true,
				className: `cnl-site-hub__step${ isDone ? ' is-done' : '' }`,
				onClick: onSelect,
			},
			el( StepStatus, { isDone } ),
			el(
				'span',
				{ className: 'cnl-site-hub__step-text' },
				el(
					Text,
					{
						className: 'cnl-site-hub__step-title',
						variant: 'body-md',
					},
					step.title
				),
				el(
					Text,
					{
						className: 'cnl-site-hub__step-description',
						variant: 'body-sm',
					},
					step.description
				)
			),
			el(
				'span',
				{ className: 'screen-reader-text' },
				isDone ? __( '(done)' ) : __( '(to do)' )
			),
			el( Icon, {
				className: 'cnl-site-hub__step-chevron',
				icon: chevronRightIcon,
				size: 20,
			} )
		)
	);
}

export default function Stage() {
	const navigate = useNavigate();
	const {
		frontPage,
		frontPageId,
		globalStyles,
		isLoading,
		publishedPageCount,
		site,
	} = useLaunchData();
	const status = getLaunchStepStatus( {
		frontPage,
		globalStyles,
		publishedPageCount,
		site,
	} );
	const progress = getLaunchProgress( status );
	const steps = getLaunchSteps( frontPageId );
	const siteName = decodeEntities( site?.title || settings.siteName || '' );
	const isComplete = progress.done === progress.total;

	return el(
		'div',
		{ className: 'cnl-editor-stage cnl-site-hub' },
		el(
			Stack,
			{ direction: 'column', gap: 'xs' },
			el(
				Text,
				{ render: el( 'h1' ), variant: 'heading-xl' },
				__( 'Your site' )
			),
			el(
				Text,
				{
					className: 'cnl-site-hub__meta',
					variant: 'body-sm',
				},
				siteName || __( 'Untitled site' ),
				settings.homeUrl && ' · ',
				settings.homeUrl &&
					el(
						Link,
						{ href: settings.homeUrl, openInNewTab: true },
						__( 'View site' )
					)
			)
		),
		el(
			Card.Root,
			{ className: 'cnl-site-hub__card' },
			el(
				Card.Header,
				null,
				el(
					Stack,
					{ align: 'center', justify: 'space-between' },
					el(
						Card.Title,
						{ render: el( 'h2' ) },
						isComplete
							? __( 'Ready to share' )
							: __( 'Getting ready to launch' )
					),
					! isLoading &&
						el(
							Text,
							{
								className: 'cnl-site-hub__count',
								variant: 'body-sm',
							},
							sprintf(
								/* translators: 1: completed steps, 2: total steps. */
								__( '%1$d of %2$d' ),
								progress.done,
								progress.total
							)
						)
				)
			),
			el(
				Card.Content,
				null,
				isLoading
					? el(
							'div',
							{ className: 'cnl-editor-spinner' },
							el( Spinner )
						)
					: el(
							Stack,
							{ direction: 'column', gap: 'md' },
							el( ProgressBar, {
								className: 'cnl-site-hub__progress',
								value: progress.percent,
							} ),
							isComplete &&
								el(
									Text,
									{
										className: 'cnl-site-hub__complete',
										variant: 'body-sm',
									},
									__(
										'Nice work. Your site has the basics in place, and you can change any of it later.'
									)
								),
							el(
								'ol',
								{
									'aria-label': __( 'Launch steps' ),
									className: 'cnl-site-hub__steps',
								},
								LAUNCH_STEP_IDS.map( ( id ) =>
									el( LaunchStep, {
										isDone: status[ id ],
										key: id,
										onSelect: () =>
											navigate( { to: steps[ id ].to } ),
										step: steps[ id ],
									} )
								)
							)
						)
			)
		),
		el(
			Text,
			{ className: 'cnl-site-hub__hint', variant: 'body-sm' },
			__(
				'Tip: click links in the preview to visit other pages, then press Edit to change the one you are looking at.'
			)
		)
	);
}
