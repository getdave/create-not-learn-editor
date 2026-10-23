/**
 * The Pages sidebar: a page opened up into its details and sections.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { useSiteTrail } from '../../../site-trail';
import ScreenLinks from '../../../screen-links';
import { MODE_COMPOSE, useCanvasMode } from '../../../site-canvas/mode';
import { sectionsIcon } from '../../../site-canvas/icons';
import { getPatternTitle } from '../page-layouts';
import {
	createBlankSection,
	getPatternSectionBlocks,
	getPlacementText,
	SectionPicker,
} from '../../../section-picker';
import { getPageTitle, usePages, usePageSections } from './data';
import { getPageAncestorTitles } from './page-tree';
import { getSectionTitle, insertItems } from './page-sections';
import { sectionBridge } from './section-bridge';
import { LIST_PATH } from './page-tree-list';
import { getPageSearchString, SECTIONS_VIEW } from './sections-view';
import { PageOptions } from './page-options';
import { MemoizedPageLayouts } from './page-layout-picker';
import { SectionList } from './section-list';
import {
	__,
	_n,
	blockEditorStore,
	Breadcrumbs,
	Button,
	coreDataStore,
	dispatch,
	noticesStore,
	Page,
	plusIcon,
	select,
	sprintf,
	Stack,
	Text,
	useDispatch,
	useEffect,
	useSelect,
	useState,
} from '../../../wordpress-packages';

/**
 * Pick a section in the full editor once it has loaded the page, so opening a
 * section to edit lands on it.
 *
 * The editor gives the page's blocks client IDs of its own, so the section is
 * found by its position inside the Post Content block, or at the top level when
 * the page is edited without its template.
 *
 * @param {number} index Section position.
 */
function selectSectionWhenEditorLoads( index ) {
	const startedAt = Date.now();
	const attempt = () => {
		const store = select( blockEditorStore );
		const [ contentId ] = store.getBlocksByName( 'core/post-content' );
		const clientId = store.getBlockOrder( contentId || '' )[ index ];

		// Until the preview has gone, its blocks are still in the store.
		if ( clientId && ! store.getSettings().isPreviewMode ) {
			dispatch( blockEditorStore ).selectBlock( clientId );
			window.setTimeout( () => {
				document
					.querySelector( 'iframe[name="editor-canvas"]' )
					?.contentDocument?.getElementById( `block-${ clientId }` )
					?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
			}, 300 );
			return;
		}

		if ( Date.now() - startedAt < 8000 ) {
			window.setTimeout( attempt, 150 );
		}
	};

	window.setTimeout( attempt, 300 );
}

/**
 * What the Sections link says about the page's sections.
 *
 * @param {boolean} isReady Whether the page's sections have loaded.
 * @param {number}  count   How many there are.
 * @return {string} One short line.
 */
function getSectionsDescription( isReady, count ) {
	if ( ! isReady ) {
		return __( 'See every part of this page.' );
	}

	if ( ! count ) {
		return __( 'None yet. Add the first one.' );
	}

	return sprintf(
		/* translators: %d: number of sections. */
		_n(
			'%d section. Move it, or add more.',
			'%d sections. Move them, or add more.',
			count
		),
		count
	);
}

/*
 * ---------------------------------------------------------------------------
 * A page, opened up.
 * ---------------------------------------------------------------------------
 */

/**
 * A page opened up: what it is, and the sections it is made of.
 *
 * Its sections open from a link, which zooms the canvas out to them and lists
 * them in place of the page's details. The list is shown only while the canvas
 * is in Compose, which works on the same sections on the page itself.
 *
 * The homepage's page opens as the homepage, with what the homepage shows
 * above the page's own details.
 *
 * @param {Object}  props            Component props.
 * @param {Element} props.intro      Shown first, for the homepage.
 * @param {boolean} props.isHomepage Whether the page is the homepage.
 * @param {number}  props.pageId     Page ID.
 * @return {Element} The page stage.
 */
export function PageDetailStage( {
	intro = null,
	isHomepage = false,
	pageId,
} ) {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const siteTrail = useSiteTrail();
	const { pages } = usePages();
	const { blocks, isReady, setBlocks } = usePageSections( pageId );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const [ insertAt, setInsertAt ] = useState( null );
	const isComposing = useCanvasMode() === MODE_COMPOSE;
	const page = useSelect(
		( selectStore ) =>
			selectStore( coreDataStore ).getEditedEntityRecord(
				'postType',
				'page',
				pageId
			) || null,
		[ pageId ]
	);
	const listPage = pages.find( ( item ) => Number( item.id ) === pageId );
	const title = isHomepage
		? __( 'Homepage' )
		: getPageTitle( listPage || page );
	const ancestors = isHomepage
		? []
		: getPageAncestorTitles( pages, pageId, getPageTitle );

	// Leaving a page forgets what was picked on it. Arriving keeps a section
	// picked by clicking it on the canvas.
	useEffect( () => () => sectionBridge.reset(), [ pageId ] );

	// While the picker is open, the canvas marks where the section will go.
	useEffect( () => {
		if ( insertAt === null ) {
			return;
		}

		sectionBridge.setInsertionIndex( insertAt );

		return () => sectionBridge.setInsertionIndex( null );
	}, [ insertAt ] );

	const closeAdd = () => setInsertAt( null );
	const pickPattern = ( pattern ) => {
		const newBlocks = getPatternSectionBlocks( pattern );

		setBlocks( insertItems( blocks, insertAt, newBlocks ) );
		setInsertAt( null );

		if ( newBlocks[ 0 ] ) {
			sectionBridge.select( newBlocks[ 0 ].clientId, 'stage' );
		}

		createSuccessNotice(
			sprintf(
				/* translators: %s: section design name. */
				__( 'Added “%s”.' ),
				getPatternTitle( pattern )
			),
			{ id: 'cnl-page-section-added', type: 'snackbar' }
		);
	};
	const editPage = ( sectionIndex ) => {
		navigate( { to: `/types/page/edit/${ pageId }` } );

		if ( Number.isInteger( sectionIndex ) ) {
			selectSectionWhenEditorLoads( sectionIndex );
		}
	};
	const startFromScratch = () => {
		const index = insertAt;

		setBlocks( insertItems( blocks, index, [ createBlankSection() ] ) );
		setInsertAt( null );
		editPage( index );
	};
	const editPart = ( id ) =>
		navigate( { search: { postId: id }, to: '/wp_template_part' } );
	const actions = (
		<PageOptions
			isHomepage={ isHomepage }
			onEdit={ () => editPage() }
			page={ listPage ? { ...listPage, ...page } : page }
			pageId={ pageId }
		/>
	);

	return (
		<Page
			actions={ actions }
			ariaLabel={ title }
			breadcrumbs={
				<Breadcrumbs
					items={ [
						// Opened from the "My site" screen, a page leads
						// back to it.
						...siteTrail,
						{ label: __( 'Pages' ), to: LIST_PATH },
						...ancestors.map( ( label ) => ( { label } ) ),
						// The sections lead back to the page's details.
						...( isComposing
							? [
									{
										label: title,
										to: `${ LIST_PATH }?${ getPageSearchString(
											searchParams
										) }`,
									},
									{ label: __( 'Sections' ) },
								]
							: [ { label: title } ] ),
					] }
				/>
			}
			className="cnl-editor-stage cnl-pages-detail"
			hasPadding={ false }
			headingLevel={ 2 }
		>
			<div className="cnl-pages-detail__body">
				{ ! isComposing && intro }
				{ ! isComposing && (
					<MemoizedPageLayouts
						isFrontPage={ isHomepage }
						pageId={ pageId }
						sectionCount={ blocks.length }
						slug={ page?.slug }
						template={ page?.template }
					/>
				) }
				{ ! isComposing && (
					<ScreenLinks
						label={ __( 'More about this page' ) }
						links={ [
							{
								description: getSectionsDescription(
									isReady,
									blocks.length
								),
								icon: sectionsIcon,
								search: {
									...searchParams,
									view: SECTIONS_VIEW,
								},
								title: __( 'Edit sections' ),
								to: LIST_PATH,
							},
						] }
					/>
				) }
				{ isComposing && (
					<section
						aria-label={ __( 'Sections' ) }
						className="cnl-page-sections"
					>
						<header className="cnl-page-sections__header">
							<Stack direction="column" gap="xs">
								<h3 className="cnl-page-sections__title">
									{ __( 'On this page' ) }
								</h3>
								{ isReady && blocks.length > 0 && (
									<Text
										className="cnl-page-sections__hint"
										variant="body-sm"
									>
										{ __(
											'Top to bottom, as visitors see it. Drag sections to reorder them, or click one to find it on the page.'
										) }
									</Text>
								) }
							</Stack>
							{ isReady && blocks.length > 0 && (
								<Button
									icon={ plusIcon }
									label={ __( 'Add a section at the top' ) }
									onClick={ () => setInsertAt( 0 ) }
									size="compact"
								/>
							) }
						</header>
						<SectionList
							blocks={ blocks }
							isReady={ isReady }
							onAdd={ setInsertAt }
							onEdit={ editPage }
							onEditPart={ editPart }
							setBlocks={ setBlocks }
						/>
					</section>
				) }
				{ insertAt !== null && (
					<SectionPicker
						onClose={ closeAdd }
						onPick={ pickPattern }
						onStartFromScratch={ startFromScratch }
						placement={ getPlacementText(
							blocks[ insertAt - 1 ] &&
								getSectionTitle( blocks[ insertAt - 1 ] ),
							blocks[ insertAt ] &&
								getSectionTitle( blocks[ insertAt ] )
						) }
						Preview={ LazyEditorPreview }
					/>
				) }
			</div>
		</Page>
	);
}
