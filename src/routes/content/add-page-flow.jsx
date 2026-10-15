/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../records';
import {
	DEFAULT_PAGE_LAYOUT_COLUMNS,
	EMPTY_ARRAY,
	OTHER_PAGE_LAYOUT_TYPE,
	getPageLayoutGroups,
	getPatternContent,
	getPatternPreviewContentWithTitle,
	getPatternTitle,
	getSelectedTemplateContent,
} from './page-layouts';
import { useAddPageToMenu, useKeepPagesOutOfMenu } from './use-main-menu';
import { useHomepageState, useSwitchHomepage } from './pages/homepage';
import { HOMEPAGE } from './pages/homepage-state';
import {
	DesignPicker,
	DesignPickerNav,
	GridShapeIcon,
	GroupHeading,
	StartFromScratch,
} from '../../design-picker';
import { getTemplateTitle } from './helpers';
import {
	PageLayoutCard,
	usePageLayoutPatterns,
} from '../../pickers/page-designs';
import {
	Button,
	CheckboxControl,
	chevronLeftIcon,
	chevronRightIcon,
	coreDataStore,
	InputControl,
	Notice,
	SelectControl,
	Skeleton,
	Stack,
	Text,
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
	__,
	parseBlocks,
	sprintf,
	serialize,
	useEffect,
	useDispatch,
	useId,
	useMemo,
	useState,
} from '../../wordpress-packages';

const PAGE_TITLE_PREVIEW_DEBOUNCE_MS = 700;

const BLANK_PAGE_PATTERN = { content: '' };

/*
 * Each density is a grid shape, and that shape doubles as the page size: the
 * design grid never scrolls, so `columns * rows` designs is exactly what fits
 * before paginating. The densest option is a genuine grid rather than three
 * full-height columns, which read as awkwardly narrow slivers.
 */
const PAGE_LAYOUT_DENSITIES = [
	{ columns: 3, label: __( 'Small previews' ), rows: 2 },
	{ columns: 2, label: __( 'Medium previews' ), rows: 1 },
	{ columns: 1, label: __( 'Large previews' ), rows: 1 },
];

function getPageLayoutDensity( columns ) {
	return (
		PAGE_LAYOUT_DENSITIES.find(
			( density ) => density.columns === columns
		) || PAGE_LAYOUT_DENSITIES[ 1 ]
	);
}

function getPageTemplateOptions( templates ) {
	return [
		{
			label: __( 'Standard layout' ),
			value: '',
		},
		...templates
			.filter( ( template ) => !! template.content?.raw )
			.filter( ( template ) => template.slug !== 'page' )
			.map( ( template ) => ( {
				label: getTemplateTitle( template ),
				value: template.slug || String( template.id ),
			} ) ),
	];
}

function PageLayoutSidebarPlaceholder() {
	return (
		<Stack
			aria-hidden
			className="cnl-add-page-layout-categories-placeholder"
			direction="column"
			gap="lg"
		>
			{ [ 70, 54, 62, 48, 66, 52 ].map( ( width, index ) => (
				<Skeleton
					key={ index }
					style={ { height: 14, width: `${ width }%` } }
				/>
			) ) }
		</Stack>
	);
}

function PageLayoutResultsPlaceholder( { columns, rows } ) {
	return (
		<div
			aria-hidden
			className="cnl-add-page-layout-grid"
			style={ {
				'--cnl-add-page-layout-columns': columns,
				'--cnl-add-page-layout-rows': rows,
			} }
		>
			{ Array.from( { length: columns * rows } ).map( ( _, index ) => (
				<Skeleton
					className="cnl-add-page-layout-skeleton"
					key={ index }
				/>
			) ) }
		</div>
	);
}

function getAddToMenuHelp( {
	menuListsAllPages,
	menuTitle,
	publishImmediately,
} ) {
	if ( menuListsAllPages ) {
		return __( 'Your menu already lists every published page.' );
	}

	if ( ! publishImmediately ) {
		return __( 'It shows in your menu once you publish it.' );
	}

	return menuTitle
		? sprintf(
				/* translators: %s: navigation menu name. */
				__( 'Adds a link to your “%s” menu so visitors can find it.' ),
				menuTitle
			)
		: __( 'Adds a link to your menu so visitors can find it.' );
}

export default function AddPageFlow( {
	mainMenu = {},
	menuPlacement,
	onClose,
	templates,
} ) {
	const navigate = useNavigate();
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const addPageToMenu = useAddPageToMenu();
	const keepPagesOutOfMenu = useKeepPagesOutOfMenu();
	// A page started for the homepage is published, to be seen there, and
	// leaves the menu as it is: the homepage is in it or not already.
	const isForHomepage = menuPlacement === 'homepage';
	const { showPage } = useSwitchHomepage( useHomepageState() );
	const [ addToMenu, setAddToMenu ] = useState( true );
	const menuListsAllPages = Boolean( mainMenu.menuPages?.listsAllPages );
	const [ startedBlank, setStartedBlank ] = useState( false );
	const [ selectedLayout, setSelectedLayout ] = useState();
	const [ selectedPageType, setSelectedPageType ] = useState();
	const [ selectedTemplateSlug, setSelectedTemplateSlug ] = useState( '' );
	const [ pageLayoutColumns, setPageLayoutColumns ] = useState(
		DEFAULT_PAGE_LAYOUT_COLUMNS
	);
	const [ pageLayoutPage, setPageLayoutPage ] = useState( 1 );
	const [ pageTitle, setPageTitle ] = useState( '' );
	const [ previewPageTitle, setPreviewPageTitle ] = useState( '' );
	const [ publishImmediately, setPublishImmediately ] = useState( true );
	const [ validationError, setValidationError ] = useState();
	const [ isBusy, setIsBusy ] = useState( false );
	const idPrefix = `cnl-add-page-${ useId().replace( /:/g, '' ) }`;
	const { isResolving, patterns } = usePageLayoutPatterns();
	const pageLayoutGroups = useMemo(
		() => getPageLayoutGroups( patterns ),
		[ patterns ]
	);
	const visiblePageLayoutGroups = useMemo( () => {
		if ( pageLayoutGroups.length !== 1 ) {
			return pageLayoutGroups;
		}

		return [
			{
				...pageLayoutGroups[ 0 ],
				label: __( 'All designs' ),
			},
		];
	}, [ pageLayoutGroups ] );
	const activePageType =
		selectedPageType ||
		pageLayoutGroups[ 0 ]?.slug ||
		OTHER_PAGE_LAYOUT_TYPE;
	const activePageLayoutGroup = pageLayoutGroups.find(
		( group ) => group.slug === activePageType
	);
	const activePageLayouts = activePageLayoutGroup?.patterns || EMPTY_ARRAY;
	const activePageLayoutDensity = getPageLayoutDensity( pageLayoutColumns );
	const pageLayoutPerPage =
		activePageLayoutDensity.columns * activePageLayoutDensity.rows;
	const pageLayoutPageCount = Math.max(
		1,
		Math.ceil( activePageLayouts.length / pageLayoutPerPage )
	);
	const isLoadingPageLayouts = isResolving && ! pageLayoutGroups.length;
	const pageTemplateOptions = useMemo(
		() => getPageTemplateOptions( templates ),
		[ templates ]
	);
	const pageTemplateContent = useMemo(
		() => getSelectedTemplateContent( templates, selectedTemplateSlug ),
		[ selectedTemplateSlug, templates ]
	);
	const isShowingForm = startedBlank || !! selectedLayout;
	// A blank page still previews, as its layout with nothing in it.
	const previewPattern =
		selectedLayout || ( startedBlank ? BLANK_PAGE_PATTERN : undefined );
	useEffect( () => {
		if ( ! previewPattern ) {
			setPreviewPageTitle( pageTitle );
			return undefined;
		}

		const timeoutId = window.setTimeout(
			() => setPreviewPageTitle( pageTitle ),
			PAGE_TITLE_PREVIEW_DEBOUNCE_MS
		);

		return () => window.clearTimeout( timeoutId );
	}, [ pageTitle, previewPattern ] );
	const formPreviewContent = useMemo(
		() =>
			previewPattern
				? getPatternPreviewContentWithTitle(
						previewPattern,
						pageTemplateContent,
						previewPageTitle,
						{ parseBlocks, serialize }
					)
				: '',
		[ pageTemplateContent, previewPageTitle, previewPattern ]
	);
	const canCreate = pageTitle.trim().length > 0;

	useEffect( () => {
		setPageLayoutPage( 1 );
	}, [ activePageType, pageLayoutColumns ] );

	useEffect( () => {
		if ( ! pageLayoutGroups.length ) {
			return;
		}

		if (
			! selectedPageType ||
			! pageLayoutGroups.some(
				( group ) => group.slug === selectedPageType
			)
		) {
			setSelectedPageType( pageLayoutGroups[ 0 ].slug );
		}
	}, [ pageLayoutGroups, selectedPageType ] );

	const handleStartBlank = () => {
		setStartedBlank( true );
		setSelectedLayout( undefined );
		setSelectedTemplateSlug( '' );
		setPageTitle( '' );
		setValidationError( undefined );
	};
	const handleBack = () => {
		setStartedBlank( false );
		setSelectedLayout( undefined );
		setSelectedTemplateSlug( '' );
		setPageTitle( '' );
		setValidationError( undefined );
	};
	const handleSelectLayout = ( pattern ) => {
		setSelectedLayout( pattern );
		setPageTitle( getPatternTitle( pattern ) );
		setValidationError( undefined );
	};
	const createPage = async () => {
		const trimmedTitle = pageTitle.trim();

		if ( ! trimmedTitle ) {
			setValidationError( __( 'Enter a page title.' ) );
			return;
		}

		setIsBusy( true );
		setValidationError( undefined );

		try {
			const newPage = await saveEntityRecord(
				'postType',
				'page',
				{
					content: selectedLayout
						? getPatternContent( selectedLayout )
						: '',
					status:
						publishImmediately || isForHomepage
							? 'publish'
							: 'draft',
					template: selectedTemplateSlug || undefined,
					title: trimmedTitle,
				},
				{ throwOnError: true }
			);

			if ( isForHomepage ) {
				showPage( newPage );
				onClose();
				navigate( {
					search: { postId: HOMEPAGE, previewId: HOMEPAGE },
					to: '/types/page/list/all',
				} );
				return;
			}

			if ( mainMenu.menuId ) {
				if ( menuPlacement === 'not-in-menu' ) {
					await keepPagesOutOfMenu( mainMenu.menuId, [ newPage.id ] );
				} else if ( menuPlacement === 'menu' || addToMenu ) {
					await addPageToMenu( mainMenu.menuId, newPage );
				}
			}

			onClose();
			// Show the new page in the canvas, and leave the list where it
			// was so the page can be seen in it.
			navigate( {
				search: { previewId: newPage.id },
				to: '/types/page/list/all',
			} );
		} catch ( error ) {
			setValidationError( getErrorMessage( error ) );
		} finally {
			setIsBusy( false );
		}
	};
	const goToPreviousPageLayouts = () =>
		setPageLayoutPage( ( page ) => Math.max( 1, page - 1 ) );
	const goToNextPageLayouts = () =>
		setPageLayoutPage( ( page ) =>
			Math.min( pageLayoutPageCount, page + 1 )
		);

	if ( isShowingForm ) {
		return (
			<DesignPicker
				className="cnl-add-page-modal"
				mainClassName={ `cnl-add-page-form${
					formPreviewContent ? ' has-preview' : ''
				}` }
				onClose={ onClose }
				subtitle={
					selectedLayout
						? sprintf(
								/* translators: %s: page design name. */
								__(
									'Your page starts from the “%s” design. You can change its name later.'
								),
								getPatternTitle( selectedLayout )
							)
						: __(
								'Your page starts blank. You can change its name later.'
							)
				}
				title={ __( 'Name your page' ) }
			>
				<div className="cnl-add-page-form__fields">
					{ validationError && (
						<Notice
							isDismissible
							onRemove={ () => setValidationError( undefined ) }
							status="error"
						>
							{ validationError }
						</Notice>
					) }
					<InputControl
						autoComplete="off"
						className="cnl-add-page-form__title"
						disabled={ isBusy }
						label={ __( 'Page title' ) }
						onValueChange={ setPageTitle }
						placeholder={ __( 'Enter page title' ) }
						required
						value={ pageTitle }
					/>
					<div className="cnl-add-page-form__settings">
						{ ! isForHomepage && (
							<div className="cnl-add-page-form__checkbox-item">
								<CheckboxControl
									checked={ publishImmediately }
									disabled={ isBusy }
									label={ __( 'Publish immediately' ) }
									onChange={ setPublishImmediately }
								/>
								<p className="cnl-add-page-form__checkbox-help">
									{ __(
										'Your page will be visible to visitors immediately.'
									) }
								</p>
							</div>
						) }
						{ mainMenu.menuId && ! menuPlacement && (
							<div className="cnl-add-page-form__checkbox-item">
								<CheckboxControl
									checked={ menuListsAllPages || addToMenu }
									disabled={ isBusy || menuListsAllPages }
									label={ __( 'Add to my menu' ) }
									onChange={ setAddToMenu }
								/>
								<p className="cnl-add-page-form__checkbox-help">
									{ getAddToMenuHelp( {
										menuListsAllPages,
										menuTitle: mainMenu.menuTitle,
										publishImmediately,
									} ) }
								</p>
							</div>
						) }
						{ pageTemplateOptions.length > 1 && (
							<SelectControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								disabled={ isBusy }
								label={ __( 'Layout' ) }
								onChange={ ( value ) =>
									setSelectedTemplateSlug( String( value ) )
								}
								options={ pageTemplateOptions }
								value={ selectedTemplateSlug }
							/>
						) }
					</div>
					<div className="cnl-add-page-form__actions">
						<Button
							__next40pxDefaultSize
							disabled={ isBusy }
							icon={ chevronLeftIcon }
							onClick={ handleBack }
							variant="tertiary"
						>
							{ __( 'Back to designs' ) }
						</Button>
						<Button
							__next40pxDefaultSize
							accessibleWhenDisabled
							disabled={ isBusy || ! canCreate }
							isBusy={ isBusy }
							onClick={ createPage }
							variant="primary"
						>
							{ __( 'Create page' ) }
						</Button>
					</div>
				</div>
				{ formPreviewContent && (
					<div className="cnl-add-page-form__preview">
						<div className="cnl-design-picker__preview cnl-add-page-form__preview-page">
							<LazyEditorPreview
								content={ formPreviewContent }
								description={
									selectedLayout
										? getPatternTitle( selectedLayout )
										: __( 'Blank page' )
								}
							/>
						</div>
					</div>
				) }
			</DesignPicker>
		);
	}

	const currentPageLayoutPage = Math.min(
		pageLayoutPage,
		pageLayoutPageCount
	);
	const visiblePageLayouts = activePageLayouts.slice(
		( currentPageLayoutPage - 1 ) * pageLayoutPerPage,
		currentPageLayoutPage * pageLayoutPerPage
	);
	/*
	 * Only lay out the rows that actually have designs in them, so a partly
	 * filled last page stretches to fill the panel instead of leaving a void.
	 */
	const visiblePageLayoutRows = Math.max(
		1,
		Math.min(
			activePageLayoutDensity.rows,
			Math.ceil(
				visiblePageLayouts.length / activePageLayoutDensity.columns
			)
		)
	);
	const firstVisiblePageLayoutIndex =
		( currentPageLayoutPage - 1 ) * pageLayoutPerPage + 1;
	const lastVisiblePageLayoutIndex = Math.min(
		currentPageLayoutPage * pageLayoutPerPage,
		activePageLayouts.length
	);
	let designs;

	if ( isLoadingPageLayouts ) {
		designs = (
			<PageLayoutResultsPlaceholder
				columns={ activePageLayoutDensity.columns }
				rows={ activePageLayoutDensity.rows }
			/>
		);
	} else if ( ! activePageLayouts.length ) {
		designs = (
			<Text className="cnl-design-picker__empty" variant="body-md">
				{ __(
					'Your theme has no page designs to offer, so start from scratch.'
				) }
			</Text>
		);
	} else {
		designs = (
			<section
				aria-labelledby={ `${ idPrefix }-heading` }
				className="cnl-add-page-layout-results"
			>
				<GroupHeading
					id={ `${ idPrefix }-heading` }
					label={ activePageLayoutGroup?.label }
				>
					{ activePageLayouts.length > pageLayoutPerPage && (
						<Stack
							aria-label={ __( 'Page design pagination' ) }
							align="center"
							className="cnl-add-page-layout-pagination"
							direction="row"
							gap="xs"
							render={ <nav /> }
						>
							<Button
								accessibleWhenDisabled
								disabled={ currentPageLayoutPage === 1 }
								icon={ chevronLeftIcon }
								label={ __( 'Previous designs' ) }
								onClick={ goToPreviousPageLayouts }
								size="compact"
								variant="tertiary"
							/>
							<Text
								className="cnl-add-page-layout-pagination__label"
								variant="body-sm"
							>
								{ sprintf(
									/* translators: 1: first visible design number, 2: last visible design number, 3: total designs. */
									__( '%1$d-%2$d of %3$d designs' ),
									firstVisiblePageLayoutIndex,
									lastVisiblePageLayoutIndex,
									activePageLayouts.length
								) }
							</Text>
							<Button
								accessibleWhenDisabled
								disabled={
									currentPageLayoutPage ===
									pageLayoutPageCount
								}
								icon={ chevronRightIcon }
								label={ __( 'Next designs' ) }
								onClick={ goToNextPageLayouts }
								size="compact"
								variant="tertiary"
							/>
						</Stack>
					) }
				</GroupHeading>
				<div
					className="cnl-add-page-layout-grid"
					style={ {
						'--cnl-add-page-layout-columns':
							activePageLayoutDensity.columns,
						'--cnl-add-page-layout-rows': visiblePageLayoutRows,
					} }
				>
					{ visiblePageLayouts.map( ( pattern ) => (
						<PageLayoutCard
							key={ pattern.name }
							onSelect={ handleSelectLayout }
							pageTemplateContent={ pageTemplateContent }
							pattern={ pattern }
							Preview={ LazyEditorPreview }
						/>
					) ) }
				</div>
			</section>
		);
	}

	return (
		<DesignPicker
			actions={ [
				pageTemplateOptions.length > 1 && (
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						className="cnl-add-page-layout-template-select"
						key="template"
						label={ __( 'Preview with' ) }
						labelPosition="side"
						onChange={ ( value ) =>
							setSelectedTemplateSlug( String( value ) )
						}
						options={ pageTemplateOptions }
						value={ selectedTemplateSlug }
					/>
				),
				<ToggleGroupControl
					__next40pxDefaultSize
					hideLabelFromVision
					isBlock={ false }
					key="density"
					label={ __( 'Preview size' ) }
					onChange={ ( value ) =>
						setPageLayoutColumns( Number( value ) )
					}
					value={ pageLayoutColumns }
				>
					{ PAGE_LAYOUT_DENSITIES.map( ( density ) => (
						<ToggleGroupControlOptionIcon
							icon={
								<GridShapeIcon
									columns={ density.columns }
									rows={ density.rows }
								/>
							}
							key={ density.columns }
							label={ density.label }
							value={ density.columns }
						/>
					) ) }
				</ToggleGroupControl>,
			] }
			className="cnl-add-page-modal"
			mainClassName="cnl-add-page-layout-main"
			nav={
				<DesignPickerNav
					current={ activePageType }
					items={ visiblePageLayoutGroups.map( ( group ) => ( {
						label: group.label,
						value: group.slug,
					} ) ) }
					label={ __( 'Page types' ) }
					onSelect={ setSelectedPageType }
				>
					{ isLoadingPageLayouts && <PageLayoutSidebarPlaceholder /> }
				</DesignPickerNav>
			}
			onClose={ onClose }
			subtitle={ __(
				'Choose a design to get started. You can change anything on it later.'
			) }
			title={ __( 'Add a page' ) }
		>
			<StartFromScratch
				description={ __( 'Build your page on a blank canvas' ) }
				onClick={ handleStartBlank }
			/>
			{ designs }
		</DesignPicker>
	);
}
