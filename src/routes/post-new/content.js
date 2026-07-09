/**
 * WordPress dependencies
 */
import { useNavigate, useParams } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getAdminUrl, getPostType } from '../../settings';
import { Button, __, el, sprintf } from '../../wp-globals';

function Stage() {
	const navigate = useNavigate();
	const params = useParams( { strict: false } );
	const type = getPostType( params.type );

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
				className: 'dashicons dashicons-edit',
			} ),
			el(
				'div',
				null,
				el(
					'h1',
					null,
					sprintf(
						/* translators: %s: post type singular label. */
						__( 'New %s' ),
						type.singular || type.name
					)
				),
				el(
					'p',
					null,
					__(
						'The WordPress editor is embedded for creating new content in this first slice.'
					)
				)
			)
		),
		el(
			Button,
			{
				onClick: () =>
					navigate( {
						to: `/types/${ type.name }/list/default`,
					} ),
				variant: 'secondary',
			},
			__( 'Back to list' )
		)
	);
}

function Canvas() {
	const params = useParams( { strict: false } );
	const type = getPostType( params.type );

	if ( ! type ) {
		return null;
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
				el(
					'div',
					{ className: 'cnl-editor-canvas__label' },
					sprintf(
						/* translators: %s: post type singular label. */
						__( 'New %s' ),
						type.singular || type.name
					)
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					__( 'Embedded WordPress editor' )
				)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-canvas__frame-wrap' },
			el( 'iframe', {
				className: 'cnl-editor-canvas__frame',
				src: getAdminUrl( 'post-new.php', {
					post_type: type.name,
				} ),
				title: __( 'New content editor' ),
			} )
		)
	);
}

export { Stage as stage, Canvas as canvas };
