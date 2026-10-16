/**
 * WordPress dependencies
 */
import { useParams, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType } from '../../settings';
import { getErrorMessage } from '../../records';
import { EMPTY_ARRAY } from './page-layouts';
import { DEFAULT_CONTENT_VIEW, getActiveTab } from './helpers';
import {
	coreDataStore,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

const POST_QUERY_FIELDS =
	'id,author,link,title,status,type,date,modified,date_gmt,modified_gmt,content,template,slug,parent,comment_count';

const TEMPLATE_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content,is_custom',
};

function getPostQuery( search ) {
	return {
		context: 'edit',
		per_page: 20,
		search: search || undefined,
		_fields: POST_QUERY_FIELDS,
		status: 'publish,draft,pending,private,future',
	};
}

function getSearchValue( value ) {
	if ( Array.isArray( value ) ) {
		return value[ 0 ];
	}

	return value;
}

function getDefaultContentViewType( type ) {
	return type?.name === 'page' ? 'grid' : 'table';
}

function getDefaultContentViewFields( type ) {
	return type?.name === 'page' ? [ 'on-site' ] : DEFAULT_CONTENT_VIEW.fields;
}

function getInitialContentView( searchParams, type ) {
	return {
		...DEFAULT_CONTENT_VIEW,
		fields: getDefaultContentViewFields( type ),
		page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
		search: searchParams.search || '',
		type: getDefaultContentViewType( type ),
	};
}

function normalizeTemplateText( value ) {
	const rendered = value?.rendered || value?.raw || value || '';
	const element = document.createElement( 'textarea' );
	element.innerHTML = String( rendered )
		.replace( /<[^>]+>/g, '' )
		.trim();
	return element.value;
}

function templateMatchesPostType( template, typeName ) {
	if ( ! template || ! typeName ) {
		return false;
	}

	const slug = template.slug || '';

	if ( typeName === 'page' ) {
		return (
			slug === 'front-page' ||
			slug === 'page' ||
			slug.startsWith( 'page-' )
		);
	}

	if ( typeName === 'post' ) {
		return [ 'home', 'single', 'single-post' ].includes( slug );
	}

	const text = [
		slug,
		normalizeTemplateText( template.title ),
		template.description,
	]
		.join( ' ' )
		.toLowerCase();

	return (
		slug === `single-${ typeName }` ||
		slug === `archive-${ typeName }` ||
		text.includes( typeName.toLowerCase() )
	);
}

export default function useContentRecords() {
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );
	const type = getPostType( params.type );
	const [ contentView, setContentView ] = useState( () =>
		getInitialContentView( searchParams, type )
	);
	const previousTypeNameRef = useRef( type?.name );
	const activeTab = getActiveTab( searchParams );
	const postQuery = useMemo(
		() => getPostQuery( contentView.search ),
		[ contentView.search ]
	);

	useEffect( () => {
		setContentView( ( currentView ) => ( {
			...currentView,
			page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
			search: searchParams.search || '',
		} ) );
	}, [ searchParams.page, searchParams.search ] );

	useEffect( () => {
		if ( previousTypeNameRef.current === type?.name ) {
			return;
		}

		previousTypeNameRef.current = type?.name;
		setContentView( ( currentView ) => ( {
			...currentView,
			fields: getDefaultContentViewFields( type ),
			type: getDefaultContentViewType( type ),
		} ) );
	}, [ type ] );

	const { error, isLoading, posts, rawTemplates } = useSelect(
		( select ) => {
			if ( ! type ) {
				return {
					error: null,
					isLoading: false,
					posts: EMPTY_ARRAY,
					rawTemplates: EMPTY_ARRAY,
				};
			}

			const store = select( coreDataStore );
			const postArgs = [ 'postType', type.name, postQuery ];
			const templateArgs = [ 'postType', 'wp_template', TEMPLATE_QUERY ];
			const resolvedPosts =
				store.getEntityRecords( ...postArgs ) || EMPTY_ARRAY;
			const resolvedTemplates =
				store.getEntityRecords( ...templateArgs ) || EMPTY_ARRAY;
			const postError = store.getResolutionError?.(
				'getEntityRecords',
				postArgs
			);
			const templateError = store.getResolutionError?.(
				'getEntityRecords',
				templateArgs
			);
			const isResolvingPosts = store.isResolving(
				'getEntityRecords',
				postArgs
			);
			const isResolvingTemplates = store.isResolving(
				'getEntityRecords',
				templateArgs
			);
			const hasResolvedPosts = store.hasFinishedResolution(
				'getEntityRecords',
				postArgs
			);
			const hasResolvedTemplates = store.hasFinishedResolution(
				'getEntityRecords',
				templateArgs
			);
			const activeError =
				activeTab === 'templates' ? templateError : postError;

			return {
				error: activeError ? getErrorMessage( activeError ) : null,
				isLoading:
					activeTab === 'templates'
						? ! hasResolvedTemplates || isResolvingTemplates
						: ! hasResolvedPosts ||
							! hasResolvedTemplates ||
							isResolvingPosts ||
							isResolvingTemplates,
				posts: resolvedPosts,
				rawTemplates: resolvedTemplates,
			};
		},
		[ activeTab, postQuery, type ]
	);
	const templates = useMemo(
		() =>
			type
				? rawTemplates.filter( ( template ) =>
						templateMatchesPostType( template, type.name )
					)
				: EMPTY_ARRAY,
		[ rawTemplates, type ]
	);
	const previewTemplates = templates;

	const selectedId =
		getSearchValue( searchParams.postIds ) ||
		searchParams.postId ||
		posts[ 0 ]?.id;
	const selectedTemplateId =
		getSearchValue( searchParams.postIds ) ||
		getSearchValue( searchParams.templateIds ) ||
		searchParams.templateId ||
		templates[ 0 ]?.id;
	const selectedPost = useMemo(
		() =>
			posts.find(
				( post ) => String( post.id ) === String( selectedId )
			),
		[ posts, selectedId ]
	);
	const selectedTemplate = useMemo(
		() =>
			templates.find(
				( template ) =>
					String( template.id ) === String( selectedTemplateId )
			),
		[ selectedTemplateId, templates ]
	);

	return {
		activeTab,
		contentView,
		error,
		isLoading,
		params,
		previewTemplates,
		posts,
		selectedId,
		selectedPost,
		selectedTemplate,
		selectedTemplateId,
		setContentView,
		templates,
		type,
	};
}
