/**
 * WordPress dependencies
 */
import { useNavigate, useParams, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType } from '../../settings';
import { fetchPosts, getTitleText } from '../../records';
import {
	Button,
	Spinner,
	TextControl,
	__,
	el,
	sprintf,
	useEffect,
	useMemo,
	useState,
} from '../../wp-globals';

function useContentRecords() {
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );
	const [ search, setSearch ] = useState( '' );
	const [ posts, setPosts ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ error, setError ] = useState( null );
	const type = getPostType( params.type );

	useEffect( () => {
		if ( ! type ) {
			return;
		}

		setIsLoading( true );
		setError( null );

		fetchPosts( type.name, search )
			.then( ( records ) => setPosts( records || [] ) )
			.catch( ( fetchError ) => {
				setError(
					fetchError.message || __( 'Unable to load content.' )
				);
				setPosts( [] );
			} )
			.finally( () => setIsLoading( false ) );
	}, [ search, type ] );

	const selectedId =
		searchParams.postId || searchParams.postIds?.[ 0 ] || posts[ 0 ]?.id;
	const selectedPost = useMemo(
		() =>
			posts.find(
				( post ) => String( post.id ) === String( selectedId )
			),
		[ posts, selectedId ]
	);

	return {
		error,
		isLoading,
		params,
		posts,
		search,
		selectedId,
		selectedPost,
		setSearch,
		type,
	};
}

function Stage() {
	const navigate = useNavigate();
	const { error, isLoading, posts, search, selectedId, setSearch, type } =
		useContentRecords();

	if ( ! type ) {
		return null;
	}

	return el(
		'div',
		{ className: 'cnl-editor-stage' },
		el(
			'div',
			{ className: 'cnl-editor-stage__header' },
			el( 'span', {
				'aria-hidden': true,
				className: `dashicons ${
					type.name === 'page'
						? 'dashicons-admin-page'
						: 'dashicons-admin-post'
				}`,
			} ),
			el(
				'div',
				null,
				el( 'h1', null, type.menuName || type.label ),
				el(
					'p',
					null,
					sprintf(
						/* translators: %s: post type label. */
						__( 'Browse, preview, and edit %s.' ),
						( type.label || type.name ).toLowerCase()
					)
				)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-stage__tools' },
			el( TextControl, {
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				label: __( 'Search content' ),
				onChange: setSearch,
				value: search,
			} ),
			type.canCreate &&
				el(
					Button,
					{
						onClick: () =>
							navigate( {
								to: `/types/${ type.name }/new`,
							} ),
						variant: 'primary',
					},
					__( 'New' )
				)
		),
		error && el( 'div', { className: 'cnl-editor-empty' }, error ),
		el(
			'div',
			{ className: 'cnl-editor-list' },
			isLoading &&
				el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
			! isLoading &&
				posts.map( ( post ) =>
					el(
						'button',
						{
							key: post.id,
							className: `cnl-editor-list__item${
								String( selectedId ) === String( post.id )
									? ' is-selected'
									: ''
							}`,
							onClick: () =>
								navigate( {
									search: { postId: post.id },
									to: `/types/${ type.name }/list/default`,
								} ),
							type: 'button',
						},
						el( 'span', null, getTitleText( post.title ) ),
						el( 'small', null, post.status )
					)
				),
			! isLoading &&
				posts.length === 0 &&
				el(
					'div',
					{ className: 'cnl-editor-empty' },
					__( 'No content found.' )
				)
		)
	);
}

function Canvas() {
	const navigate = useNavigate();
	const { isLoading, selectedPost, type } = useContentRecords();

	if ( ! type ) {
		return null;
	}

	const label = selectedPost
		? getTitleText( selectedPost.title )
		: type.singular || type.label;
	const description = selectedPost
		? sprintf(
				/* translators: 1: post type label, 2: post status. */
				__( '%1$s preview placeholder. Status: %2$s.' ),
				type.singular || type.label,
				selectedPost.status
		  )
		: sprintf(
				/* translators: %s: post type label. */
				__( 'Select %s from the list to populate this canvas.' ),
				( type.label || type.name ).toLowerCase()
		  );

	if ( isLoading ) {
		return el(
			'section',
			{ className: 'cnl-editor-canvas' },
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) )
		);
	}

	return el(
		'section',
		{ className: 'cnl-editor-canvas' },
		el(
			'header',
			{ className: 'cnl-editor-canvas__toolbar' },
			el(
				'div',
				null,
				el( 'div', { className: 'cnl-editor-canvas__label' }, label ),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					selectedPost?.status || __( 'Preview' )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-canvas__actions' },
				selectedPost?.link &&
					el(
						Button,
						{
							href: selectedPost.link,
							rel: 'noreferrer',
							target: '_blank',
							variant: 'tertiary',
						},
						__( 'Open preview' )
					),
				selectedPost &&
					el(
						Button,
						{
							onClick: () =>
								navigate( {
									to: `/types/${ type.name }/edit/${ selectedPost.id }`,
								} ),
							variant: 'primary',
						},
						__( 'Edit' )
					)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-canvas__frame-wrap' },
			el(
				'div',
				{ className: 'cnl-editor-canvas-placeholder' },
				el( 'span', {
					'aria-hidden': true,
					className: `cnl-editor-canvas-placeholder__icon dashicons ${
						type.name === 'page'
							? 'dashicons-admin-page'
							: 'dashicons-admin-post'
					}`,
				} ),
				el(
					'h2',
					{ className: 'cnl-editor-canvas-placeholder__title' },
					label
				),
				el(
					'p',
					{ className: 'cnl-editor-canvas-placeholder__description' },
					description
				),
				selectedPost?.id &&
					el(
						'div',
						{
							className: 'cnl-editor-canvas-placeholder__meta',
						},
						sprintf(
							/* translators: %d: post ID. */
							__( 'ID %d' ),
							selectedPost.id
						)
					)
			)
		)
	);
}

export { Stage as stage, Canvas as canvas };
