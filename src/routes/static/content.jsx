/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withScreenKey } from '../../screen-key';
import { withUiTheme } from '../../theme';
import { getCurrentEditorPath, getStaticScreen } from './screens';
import { SiteIdentityCanvas, SiteIdentityStage } from './identity';
import { ColorsStage, DesignStage, FontsStage, StylesCanvas } from './styles';
import { TemplatesStage } from './templates';
import { TemplatePartsStage } from './template-parts';
import { PatternsStage } from './patterns';

function Stage() {
	if ( getCurrentEditorPath() === '/patterns' ) {
		return <PatternsStage />;
	}

	if ( getCurrentEditorPath() === '/template-parts' ) {
		return <TemplatePartsStage />;
	}

	if ( getCurrentEditorPath() === '/templates' ) {
		return <TemplatesStage />;
	}

	if ( getCurrentEditorPath() === '/design' ) {
		return <DesignStage />;
	}

	if ( getCurrentEditorPath() === '/design/colors' ) {
		return <ColorsStage />;
	}

	if ( getCurrentEditorPath() === '/design/fonts' ) {
		return <FontsStage />;
	}

	if ( getCurrentEditorPath() === '/design/identity' ) {
		return <SiteIdentityStage />;
	}

	const screen = getStaticScreen();

	return (
		<div className="cnl-editor-stage">
			<div className="cnl-editor-stage__header">
				<span aria-hidden className={ `dashicons ${ screen.icon }` } />
				<div>
					<h1>{ screen.title }</h1>
					<p>{ screen.description }</p>
				</div>
			</div>
		</div>
	);
}

// The Advanced lists have no canvas; see `route.js`.
function Canvas() {
	if (
		getCurrentEditorPath() === '/design' ||
		getCurrentEditorPath() === '/design/colors' ||
		getCurrentEditorPath() === '/design/fonts'
	) {
		return <StylesCanvas />;
	}

	if ( getCurrentEditorPath() === '/design/identity' ) {
		return <SiteIdentityCanvas />;
	}

	const screen = getStaticScreen();

	return (
		<section className="cnl-editor-canvas">
			<header className="cnl-editor-canvas__toolbar">
				<div>
					<div className="cnl-editor-canvas__label">
						{ screen.title }
					</div>
					<div className="cnl-editor-canvas__status">
						{ screen.section }
					</div>
				</div>
			</header>
			<div className="cnl-editor-canvas__frame-wrap">
				<div className="cnl-editor-canvas-placeholder">
					<span
						aria-hidden
						className={ `cnl-editor-canvas-placeholder__icon dashicons ${ screen.icon }` }
					/>
					<h2 className="cnl-editor-canvas-placeholder__title">
						{ screen.title }
					</h2>
					<p className="cnl-editor-canvas-placeholder__description">
						{ screen.description }
					</p>
					<div className="cnl-editor-canvas-placeholder__meta">
						{ screen.status }
					</div>
				</div>
			</div>
		</section>
	);
}

export const stage = withUiTheme( Stage );
export const canvas = withScreenKey(
	withCanvasRecovery( withUiTheme( Canvas ) )
);
