/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getStaticScreen } from './screens';
import { useDataViews } from '../../use-dataviews';
import {
	DEFAULT_TEMPLATE_LAYOUTS,
	EMPTY_ARRAY,
	NO_LIST_DATA,
} from './list-shared';
import {
	getErrorMessage,
	getTemplateAuthorText,
	getTemplateDisplayDescription,
	getTemplateDisplayTitle,
	getTitleText,
} from '../../records';
import {
	Button,
	coreDataStore,
	EmptyState,
	InputControl,
	layoutIcon,
	Modal,
	noticesStore,
	Notice,
	Page,
	plusIcon,
	Spinner,
	sprintf,
	__,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

const TEMPLATE_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content,date,modified',
};
const DEFAULT_TEMPLATE_VIEW = {
	descriptionField: 'description',
	fields: [],
	filters: [],
	layout: {
		previewSize: 160,
	},
	mediaField: 'preview',
	page: 1,
	perPage: 20,
	search: '',
	sort: {
		direction: 'asc',
		field: 'title',
	},
	titleField: 'title',
	type: 'grid',
};

function getTemplateStatusLabel( template ) {
	switch ( template?.status ) {
		case 'publish':
			return __( 'Published' );
		case 'draft':
		case 'auto-draft':
			return __( 'Draft' );
		case 'future':
			return __( 'Scheduled' );
		case 'pending':
			return __( 'Pending review' );
		case 'private':
			return __( 'Private' );
		case 'trash':
			return __( 'Trash' );
		default:
			return __( 'Template' );
	}
}

function getTemplateSlug( template ) {
	return template?.slug || String( template?.id || '' );
}

function getCleanTemplateSlug( title ) {
	return (
		title
			.trim()
			.toLowerCase()
			.replace( /[^a-z0-9_\s-]/g, '' )
			.replace( /[\s_]+/g, '-' )
			.replace( /-+/g, '-' )
			.replace( /^-|-$/g, '' ) || 'wp-custom-template'
	);
}

function getUniqueTemplateTitle( title, templates ) {
	const trimmedTitle = title.trim();
	const existingTitles = new Set(
		( templates || EMPTY_ARRAY ).map( ( template ) =>
			getTitleText( template?.title ).toLowerCase()
		)
	);
	const lowerTitle = trimmedTitle.toLowerCase();

	if ( ! existingTitles.has( lowerTitle ) ) {
		return trimmedTitle;
	}

	let suffix = 2;
	while ( existingTitles.has( `${ lowerTitle } ${ suffix }` ) ) {
		suffix += 1;
	}

	return `${ trimmedTitle } ${ suffix }`;
}

function getTemplateRecordId( template ) {
	if ( template?.id ) {
		return template.id;
	}

	if ( template?.theme && template?.slug ) {
		return `${ template.theme }//${ template.slug }`;
	}

	return template?.slug;
}

function renderTemplatePreview( { item } ) {
	return (
		<div className="cnl-editor-dataviews-preview">
			<LazyEditorPreview
				content={ item?.content?.raw }
				description={ getTitleText( item?.title ) }
			/>
		</div>
	);
}

function getTemplateFields() {
	return [
		{
			enableGlobalSearch: true,
			enableHiding: false,
			getValue: ( { item } ) => getTemplateDisplayTitle( item ),
			id: 'title',
			label: __( 'Title' ),
			render: ( { item } ) => (
				<span className="cnl-editor-dataviews-title">
					{ getTemplateDisplayTitle( item ) }
				</span>
			),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			enableSorting: false,
			getValue: ( { item } ) => getTemplateDisplayDescription( item ),
			id: 'description',
			label: __( 'Description' ),
			render: ( { item } ) =>
				getTemplateDisplayDescription( item ) ||
				__( 'Controls part of the site layout.' ),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			getValue: ( { item } ) => getTemplateAuthorText( item ),
			id: 'author',
			label: __( 'Author' ),
			type: 'text',
		},
		{
			getValue: ( { item } ) => getTemplateStatusLabel( item ),
			id: 'status',
			label: __( 'Status' ),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			getValue: ( { item } ) => getTemplateSlug( item ),
			id: 'slug',
			label: __( 'Slug' ),
			type: 'text',
		},
		{
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			id: 'preview',
			label: __( 'Preview' ),
			render: renderTemplatePreview,
			type: 'media',
		},
	];
}

function openTemplate( navigate, template ) {
	if ( template?.id ) {
		navigate( {
			search: {
				postId: template.id,
			},
			to: '/wp_template',
		} );
	}
}

function getTemplateActions( navigate, onRename ) {
	return [
		{
			callback: ( items ) => openTemplate( navigate, items[ 0 ] ),
			id: 'edit-template',
			isPrimary: true,
			label: __( 'Edit' ),
			supportsBulk: false,
		},
		{
			callback: ( items ) => onRename( items[ 0 ] ),
			id: 'rename-template',
			isEligible: ( item ) => item?.source === 'custom',
			label: __( 'Rename' ),
			supportsBulk: false,
		},
	];
}

function RenameTemplateModal( {
	isSaving,
	onChangeTitle,
	onClose,
	onSave,
	saveError,
	templateTitle,
	title,
} ) {
	const canSave =
		! isSaving && title.trim().length > 0 && title.trim() !== templateTitle;
	const submit = ( event ) => {
		event.preventDefault();

		if ( canSave ) {
			onSave();
		}
	};

	return (
		<Modal
			className="routes-template-list__rename-modal"
			onRequestClose={ () => {
				if ( ! isSaving ) {
					onClose();
				}
			} }
			title={ __( 'Rename layout' ) }
		>
			<form
				className="routes-template-list__rename-form"
				onSubmit={ submit }
			>
				<InputControl
					autoComplete="off"
					disabled={ isSaving }
					label={ __( 'Name' ) }
					onValueChange={ onChangeTitle }
					value={ title }
				/>
				{ saveError && (
					<Notice isDismissible={ false } status="error">
						{ saveError }
					</Notice>
				) }
				<div className="routes-template-list__rename-actions">
					<Button
						__next40pxDefaultSize
						disabled={ isSaving }
						onClick={ onClose }
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						disabled={ ! canSave }
						isBusy={ isSaving }
						type="submit"
						variant="primary"
					>
						{ __( 'Save' ) }
					</Button>
				</div>
			</form>
		</Modal>
	);
}

function CreateTemplateModal( { isSaving, onClose, onCreate, saveError } ) {
	const [ title, setTitle ] = useState( '' );
	const [ validationError, setValidationError ] = useState( '' );
	const canCreate = title.trim().length > 0;
	const submit = ( event ) => {
		event.preventDefault();

		if ( ! canCreate ) {
			setValidationError( __( 'Enter a template name.' ) );
			return;
		}

		setValidationError( '' );
		onCreate( {
			title: title.trim(),
		} );
	};

	return (
		<Modal
			className="routes-template-list__create-modal"
			onRequestClose={ () => {
				if ( ! isSaving ) {
					onClose();
				}
			} }
			title={ __( 'Add a layout' ) }
		>
			<form
				className="routes-template-list__create-form"
				onSubmit={ submit }
			>
				<InputControl
					autoComplete="off"
					disabled={ isSaving }
					label={ __( 'Name' ) }
					onValueChange={ ( value ) => {
						setTitle( value );
						setValidationError( '' );
					} }
					value={ title }
				/>
				{ ( validationError || saveError ) && (
					<Notice isDismissible={ false } status="error">
						{ validationError || saveError }
					</Notice>
				) }
				<div className="routes-template-list__create-actions">
					<Button
						__next40pxDefaultSize
						disabled={ isSaving }
						onClick={ onClose }
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						disabled={ isSaving || ! canCreate }
						isBusy={ isSaving }
						type="submit"
						variant="primary"
					>
						{ __( 'Add' ) }
					</Button>
				</div>
			</form>
		</Modal>
	);
}

function TemplatesDataViewsLayout() {
	// Only rendered inside `DataViews`, so the module has loaded.
	const { DataViews } = useDataViews();

	return (
		<div className="routes-template-list__dataviews">
			<div className="routes-template-list__dataviews-toolbar">
				<div className="routes-template-list__dataviews-toolbar-start">
					<DataViews.Search />
					<DataViews.FiltersToggle />
				</div>
				<div className="routes-template-list__dataviews-toolbar-end">
					<DataViews.LayoutSwitcher />
					<DataViews.ViewConfig />
				</div>
			</div>
			<DataViews.Filters className="routes-template-list__dataviews-filters" />
			<div className="routes-template-list__dataviews-scroll">
				<DataViews.Layout />
				<DataViews.Pagination />
			</div>
		</div>
	);
}

function useTemplatesData() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const args = [ 'postType', 'wp_template', TEMPLATE_QUERY ];
		const templates = store.getEntityRecords( ...args ) || EMPTY_ARRAY;
		const error = store.getResolutionError?.( 'getEntityRecords', args );

		return {
			error: error ? getErrorMessage( error ) : null,
			isLoading:
				store.isResolving( 'getEntityRecords', args ) ||
				! store.hasFinishedResolution( 'getEntityRecords', args ),
			templates,
		};
	}, [] );
}

export function TemplatesStage() {
	const navigate = useNavigate();
	const dataViews = useDataViews();
	const { invalidateResolution, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { error, isLoading, templates } = useTemplatesData();
	const [ view, setView ] = useState( DEFAULT_TEMPLATE_VIEW );
	const [ isCreateModalOpen, setIsCreateModalOpen ] = useState( false );
	const [ isCreatingTemplate, setIsCreatingTemplate ] = useState( false );
	const [ createTemplateError, setCreateTemplateError ] = useState( '' );
	const [ templateToRename, setTemplateToRename ] = useState( null );
	const [ renameTitle, setRenameTitle ] = useState( '' );
	const [ isRenamingTemplate, setIsRenamingTemplate ] = useState( false );
	const [ renameTemplateError, setRenameTemplateError ] = useState( '' );
	const canCreateTemplates = useSelect(
		( select ) =>
			select( coreDataStore ).canUser?.( 'create', {
				kind: 'postType',
				name: 'wp_template',
			} ),
		[]
	);
	const fields = useMemo( () => getTemplateFields(), [] );
	const openRenameModal = ( template ) => {
		setRenameTemplateError( '' );
		setRenameTitle( getTitleText( template?.title ) );
		setTemplateToRename( template );
	};
	const closeRenameModal = () => {
		if ( ! isRenamingTemplate ) {
			setRenameTemplateError( '' );
			setTemplateToRename( null );
		}
	};
	const renameTemplate = async () => {
		const title = renameTitle.trim();

		if ( ! templateToRename?.id || ! title ) {
			return;
		}

		setIsRenamingTemplate( true );
		setRenameTemplateError( '' );

		try {
			await saveEntityRecord(
				'postType',
				'wp_template',
				{
					id: templateToRename.id,
					title,
				},
				{ throwOnError: true }
			);
			invalidateResolution?.( 'getEntityRecords', [
				'postType',
				'wp_template',
				TEMPLATE_QUERY,
			] );
			setTemplateToRename( null );
			createSuccessNotice( __( 'Layout renamed.' ), {
				type: 'snackbar',
			} );
		} catch ( saveError ) {
			const message = getErrorMessage( saveError );
			setRenameTemplateError( message );
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to rename layout (%s).' ),
					message
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsRenamingTemplate( false );
		}
	};
	const actions = useMemo(
		() => getTemplateActions( navigate, openRenameModal ),
		[ navigate ]
	);
	/*
	 * One page of cards at a time. Each card is a live preview, so handing
	 * DataViews the whole list renders every one of them at once.
	 */
	const { data: shownTemplates, paginationInfo } = useMemo(
		() =>
			dataViews
				? dataViews.filterSortAndPaginate( templates, view, fields )
				: NO_LIST_DATA,
		[ dataViews, fields, templates, view ]
	);
	const onChangeView = ( nextView ) => {
		setView( nextView );
		navigate( {
			search: {
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				search: nextView.search || undefined,
			},
			to: '/templates',
		} );
	};
	const openCreateModal = () => {
		setCreateTemplateError( '' );
		setIsCreateModalOpen( true );
	};
	const closeCreateModal = () => {
		if ( ! isCreatingTemplate ) {
			setCreateTemplateError( '' );
			setIsCreateModalOpen( false );
		}
	};
	const createTemplate = async ( { title } ) => {
		const uniqueTitle = getUniqueTemplateTitle( title, templates );
		const record = {
			content: '',
			slug: getCleanTemplateSlug( uniqueTitle ),
			title: uniqueTitle,
		};

		setIsCreatingTemplate( true );
		setCreateTemplateError( '' );

		try {
			const template = await saveEntityRecord(
				'postType',
				'wp_template',
				record,
				{ throwOnError: true }
			);
			const templateId = getTemplateRecordId( template );

			invalidateResolution?.( 'getEntityRecords', [
				'postType',
				'wp_template',
				TEMPLATE_QUERY,
			] );
			setIsCreateModalOpen( false );
			navigate( {
				search: {
					postId: templateId,
				},
				to: '/wp_template',
			} );
		} catch ( saveError ) {
			setCreateTemplateError( getErrorMessage( saveError ) );
		} finally {
			setIsCreatingTemplate( false );
		}
	};
	const pageActions = canCreateTemplates !== false && (
		<div className="routes-template-list__page-actions">
			<Button
				__next40pxDefaultSize
				icon={ plusIcon }
				onClick={ openCreateModal }
				variant="primary"
			>
				{ __( 'Add layout' ) }
			</Button>
		</div>
	);
	const empty = (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ layoutIcon } />
				<EmptyState.Title>
					{ __( 'No templates found' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Templates will appear here when the active theme or site defines them.'
					) }
				</EmptyState.Description>
			</EmptyState.Root>
		</div>
	);

	const DataViews = dataViews?.DataViews;

	return (
		<Page
			actions={ pageActions }
			className="cnl-editor-stage routes-template-list"
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ getStaticScreen().description }
			title={ getStaticScreen().title }
		>
			{ error && <div className="cnl-editor-empty">{ error }</div> }
			{ DataViews ? (
				<DataViews
					actions={ actions }
					data={ shownTemplates }
					defaultLayouts={ DEFAULT_TEMPLATE_LAYOUTS }
					empty={ empty }
					fields={ fields }
					getItemId={ ( item ) => String( item.id ) }
					isLoading={ isLoading }
					onChangeSelection={ () => {} }
					onChangeView={ onChangeView }
					onClickItem={ ( item ) => openTemplate( navigate, item ) }
					paginationInfo={ paginationInfo }
					selection={ EMPTY_ARRAY }
					view={ view }
				>
					<TemplatesDataViewsLayout />
				</DataViews>
			) : (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ isCreateModalOpen && (
				<CreateTemplateModal
					isSaving={ isCreatingTemplate }
					onClose={ closeCreateModal }
					onCreate={ createTemplate }
					saveError={ createTemplateError }
				/>
			) }
			{ templateToRename && (
				<RenameTemplateModal
					isSaving={ isRenamingTemplate }
					key="rename-template-modal"
					onChangeTitle={ setRenameTitle }
					onClose={ closeRenameModal }
					onSave={ renameTemplate }
					saveError={ renameTemplateError }
					templateTitle={ getTitleText( templateToRename.title ) }
					title={ renameTitle }
				/>
			) }
		</Page>
	);
}
