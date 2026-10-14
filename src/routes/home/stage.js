/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import {
	getCreationProgress,
	getCreationStepStatus,
	CREATION_STEP_IDS,
} from './checklist';
import {
	Button,
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
const TEMPLATE_PARTS_QUERY = {
	per_page: 100,
	_fields: 'id,area,source',
};

function getCreationSteps( homepageId ) {
	return {
		identity: {
			description: __( 'Name your site and add a logo' ),
			title: __( 'Name & logo' ),
			to: '/design/identity',
		},
		header: {
			description: __( 'Choose how the top of every page looks' ),
			title: __( 'Header' ),
			to: '/design/header',
		},
		footer: {
			description: __( 'Choose how the bottom of every page looks' ),
			title: __( 'Footer' ),
			to: '/design/footer',
		},
		colors: {
			description: __( 'Pick the colors your whole site uses' ),
			title: __( 'Colors' ),
			to: '/design/colors',
		},
		fonts: {
			description: __( 'Pick the fonts your whole site uses' ),
			title: __( 'Fonts' ),
			to: '/design/fonts',
		},
		homepage: {
			description: __( 'Make the first page visitors see your own' ),
			title: __( 'Your homepage' ),
			// The homepage opened up on the Pages screen, where its sections,
			// layout and what it shows all live.
			search: homepageId
				? { postId: homepageId, previewId: homepageId }
				: undefined,
			to: '/types/page/list/all',
		},
		pages: {
			description: __( 'Add pages like About and Contact' ),
			title: __( 'Pages & menu' ),
			to: '/types/page/list/default',
		},
	};
}

function useCreationData() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const site = store.getEntityRecord( 'root', 'site' );
		const globalStylesId = store.__experimentalGetCurrentGlobalStylesId?.();
		const globalStyles = globalStylesId
			? store.getEntityRecord( 'root', 'globalStyles', globalStylesId )
			: null;
		const pagesArgs = [ 'postType', 'page', PUBLISHED_PAGES_QUERY ];
		const pages = store.getEntityRecords( ...pagesArgs ) || EMPTY_ARRAY;
		const templateParts =
			store.getEntityRecords(
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY
			) || EMPTY_ARRAY;
		const frontPageId =
			site?.show_on_front === 'page' ? site?.page_on_front : 0;

		return {
			frontPage: frontPageId
				? pages.find( ( page ) => page.id === frontPageId )
				: null,
			globalStyles,
			// Kept when the homepage shows the latest posts, so the step can
			// still open the page to switch it back.
			homepageId: Number( site?.page_on_front ) || 0,
			isLoading:
				! site ||
				! store.hasFinishedResolution( 'getEntityRecords', pagesArgs ),
			publishedPageCount: pages.length,
			site,
			templateParts,
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

function CreationStep( { isDone, onSelect, step } ) {
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
		globalStyles,
		homepageId,
		isLoading,
		publishedPageCount,
		site,
		templateParts,
	} = useCreationData();
	const status = getCreationStepStatus( {
		frontPage,
		globalStyles,
		publishedPageCount,
		site,
		templateParts,
	} );
	const progress = getCreationProgress( status );
	const steps = getCreationSteps( homepageId );
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
				{ render: el( 'h1' ), variant: 'heading-lg' },
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
			Stack,
			{
				className: 'cnl-site-hub__checklist',
				direction: 'column',
				gap: 'md',
			},
			el(
				Stack,
				{ align: 'center', justify: 'space-between' },
				el(
					Text,
					{ render: el( 'h2' ), variant: 'heading-sm' },
					isComplete
						? __( 'Your site is made' )
						: __( 'Create your site' )
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
			),
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
									'Nice work, you made it. Keep creating: add pages, try new looks, and change anything whenever you like.'
								)
							),
						el(
							'ol',
							{
								'aria-label': __( 'Steps to create your site' ),
								className: 'cnl-site-hub__steps',
							},
							CREATION_STEP_IDS.map( ( id ) =>
								el( CreationStep, {
									isDone: status[ id ],
									key: id,
									onSelect: () =>
										navigate( {
											search: steps[ id ].search,
											to: steps[ id ].to,
										} ),
									step: steps[ id ],
								} )
							)
						)
					)
		),
		el(
			Text,
			{ className: 'cnl-site-hub__hint', variant: 'body-sm' },
			__(
				'Tip: click any text on the page to change it. Turn on Preview to visit other pages through their links.'
			)
		)
	);
}
