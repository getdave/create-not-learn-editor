/**
 * WordPress dependencies
 */
import { useNavigate, useParams, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getTitleText } from '../../records';
import { getEditablePostType } from '../../settings';
import { getActiveTab, getTemplateTitle } from './helpers';
import useContentRecords from './use-content-records';
import PagesCanvas from './pages/canvas';
import TemplateCanvas from './template-canvas';
import { Button, Spinner, __, sprintf } from '../../wordpress-packages';

function getCanvasLabel( {
	selectedPost,
	selectedTemplate,
	showTemplates,
	type,
} ) {
	if ( showTemplates ) {
		return selectedTemplate
			? getTemplateTitle( selectedTemplate )
			: __( 'Template' );
	}

	return selectedPost
		? getTitleText( selectedPost.title )
		: type.singular || type.label;
}

function getCanvasDescription( {
	selectedPost,
	selectedTemplate,
	showTemplates,
	type,
} ) {
	if ( showTemplates ) {
		if ( selectedTemplate ) {
			return (
				selectedTemplate.description ||
				__( 'Template preview placeholder.' )
			);
		}

		return sprintf(
			/* translators: %s: post type label. */
			__( 'Select a template used by %s.' ),
			( type.label || type.name ).toLowerCase()
		);
	}

	if ( selectedPost ) {
		return sprintf(
			/* translators: 1: post type label, 2: post status. */
			__( '%1$s preview placeholder. Status: %2$s.' ),
			type.singular || type.label,
			selectedPost.status
		);
	}

	return sprintf(
		/* translators: %s: post type label. */
		__( 'Select %s from the list to populate this canvas.' ),
		( type.label || type.name ).toLowerCase()
	);
}

function getCanvasIconClass( { showTemplates, type } ) {
	if ( showTemplates ) {
		return 'dashicons-layout';
	}

	return type.name === 'page'
		? 'dashicons-admin-page'
		: 'dashicons-admin-post';
}

export default function Canvas() {
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );

	if (
		params.type === 'page' &&
		getActiveTab( searchParams ) !== 'templates'
	) {
		return <PagesCanvas />;
	}

	return <ContentCanvas />;
}

function ContentCanvas() {
	const navigate = useNavigate();
	const {
		activeTab,
		isLoading,
		posts,
		selectedPost,
		selectedTemplate,
		type,
	} = useContentRecords();

	if ( ! type ) {
		return null;
	}

	const showTemplates = activeTab === 'templates';

	if ( isLoading ) {
		return (
			<section className="cnl-editor-canvas">
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			</section>
		);
	}

	if (
		showTemplates &&
		selectedTemplate &&
		getEditablePostType( 'wp_template' )
	) {
		return (
			<TemplateCanvas records={ posts } template={ selectedTemplate } />
		);
	}

	const label = getCanvasLabel( {
		selectedPost,
		selectedTemplate,
		showTemplates,
		type,
	} );
	const description = getCanvasDescription( {
		selectedPost,
		selectedTemplate,
		showTemplates,
		type,
	} );

	return (
		<section className="cnl-editor-canvas">
			<header className="cnl-editor-canvas__toolbar">
				<div>
					<div className="cnl-editor-canvas__label">{ label }</div>
					<div className="cnl-editor-canvas__status">
						{ selectedPost?.status || __( 'Preview' ) }
					</div>
				</div>
				<div className="cnl-editor-canvas__actions">
					{ selectedPost?.link && (
						<Button
							href={ selectedPost.link }
							rel="noreferrer"
							target="_blank"
							variant="tertiary"
						>
							{ __( 'Open preview' ) }
						</Button>
					) }
					{ showTemplates && (
						<Button
							onClick={ () => navigate( { to: '/templates' } ) }
							variant="secondary"
						>
							{ __( 'See all layouts' ) }
						</Button>
					) }
					{ showTemplates && selectedTemplate && (
						<Button
							onClick={ () =>
								navigate( {
									search: {
										postId: selectedTemplate.id,
									},
									to: '/wp_template',
								} )
							}
							variant="primary"
						>
							{ __( 'Edit' ) }
						</Button>
					) }
					{ ! showTemplates && selectedPost && (
						<Button
							onClick={ () =>
								navigate( {
									to: `/types/${ type.name }/edit/${ selectedPost.id }`,
								} )
							}
							variant="primary"
						>
							{ __( 'Edit' ) }
						</Button>
					) }
				</div>
			</header>
			<div className="cnl-editor-canvas__frame-wrap">
				<div className="cnl-editor-canvas-placeholder">
					<span
						aria-hidden
						className={ `cnl-editor-canvas-placeholder__icon dashicons ${ getCanvasIconClass(
							{ showTemplates, type }
						) }` }
					/>
					<h2 className="cnl-editor-canvas-placeholder__title">
						{ label }
					</h2>
					<p className="cnl-editor-canvas-placeholder__description">
						{ description }
					</p>
					{ selectedPost?.id && ! showTemplates && (
						<div className="cnl-editor-canvas-placeholder__meta">
							{ sprintf(
								/* translators: %d: post ID. */
								__( 'ID %d' ),
								selectedPost.id
							) }
						</div>
					) }
					{ selectedTemplate?.id && showTemplates && (
						<div className="cnl-editor-canvas-placeholder__meta">
							{ selectedTemplate.id }
						</div>
					) }
				</div>
			</div>
		</section>
	);
}
