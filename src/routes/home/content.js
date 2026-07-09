/**
 * Internal dependencies
 */
import { namespace, settings } from '../../settings';
import { getErrorMessage, setupDefaults } from '../../records';
import { Button, Notice, __, el, useState } from '../../wp-globals';

function Stage() {
	const [ setupState, setSetupState ] = useState( null );
	const [ isSettingUp, setIsSettingUp ] = useState( false );

	const runSetup = () => {
		setIsSettingUp( true );
		setSetupState( null );

		setupDefaults( namespace )
			.then( setSetupState )
			.catch( ( error ) =>
				setSetupState( {
					success: false,
					message: getErrorMessage( error ),
				} )
			)
			.finally( () => setIsSettingUp( false ) );
	};

	return el(
		'div',
		{ className: 'cnl-editor-stage' },
		el(
			'div',
			{ className: 'cnl-editor-stage__header' },
			el( 'span', {
				'aria-hidden': true,
				className: 'dashicons dashicons-admin-home',
			} ),
			el(
				'div',
				null,
				el( 'h1', null, __( 'Homepage' ) ),
				el(
					'p',
					null,
					__(
						'Preview the current homepage and optionally create a basic Home page and navigation menu.'
					)
				)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-panel' },
			el( 'h2', null, __( 'Site setup' ) ),
			el(
				'p',
				null,
				__(
					'This action creates or reuses a published Home page, sets it as the static homepage, and creates a basic page-list navigation menu if none exists.'
				)
			),
			el(
				Button,
				{
					isBusy: isSettingUp,
					onClick: runSetup,
					variant: 'secondary',
				},
				__( 'Set up defaults' )
			),
			setupState &&
				el(
					Notice,
					{
						className: 'cnl-editor-panel__notice',
						isDismissible: false,
						status: setupState.success ? 'success' : 'error',
					},
					setupState.success
						? __( 'Defaults are ready.' )
						: setupState.message || __( 'Setup failed.' )
				)
		)
	);
}

function Canvas() {
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
					__( 'Home' )
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					__( 'Placeholder canvas' )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-canvas__actions' },
				el(
					Button,
					{
						href: settings.homeUrl,
						rel: 'noreferrer',
						target: '_blank',
						variant: 'tertiary',
					},
					__( 'Open preview' )
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
					className:
						'cnl-editor-canvas-placeholder__icon dashicons dashicons-admin-home',
				} ),
				el(
					'h2',
					{ className: 'cnl-editor-canvas-placeholder__title' },
					__( 'Homepage canvas' )
				),
				el(
					'p',
					{ className: 'cnl-editor-canvas-placeholder__description' },
					__(
						'The homepage preview and editing surface will render in this area.'
					)
				)
			)
		)
	);
}

export { Stage as stage, Canvas as canvas };
