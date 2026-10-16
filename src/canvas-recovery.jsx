/**
 * A way back from a canvas that has stopped working.
 *
 * Boot wraps the canvas in an error boundary of its own, but it sits above
 * every screen and is never reset, so one error leaves the canvas broken
 * until the page is reloaded, on every screen after it. This one sits inside
 * each screen's canvas and catches first. "Try again" mounts the canvas
 * afresh, and moving to another screen or page does too. Unsaved changes
 * live in the data stores, not the canvas, so neither loses them.
 */

/**
 * WordPress dependencies
 */
import { useParams, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	cautionIcon,
	Component,
	dispatch,
	EmptyState,
	Fragment,
	noticesStore,
	useMemo,
} from './wordpress-packages';

/**
 * Copy what went wrong, and where: the error's own stack says which code
 * threw, and the component stack which part of the canvas it was in.
 *
 * @param {Error}  error          The error caught.
 * @param {string} componentStack React's component stack for it.
 */
function copyError( error, componentStack ) {
	const text = [
		error?.stack || String( error ),
		componentStack && `Component stack:${ componentStack }`,
		`Address: ${ window.location.href }`,
	]
		.filter( Boolean )
		.join( '\n\n' );

	window.navigator.clipboard?.writeText( text ).then( () =>
		dispatch( noticesStore ).createSuccessNotice( __( 'Error copied.' ), {
			type: 'snackbar',
		} )
	);
}

class CanvasErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { attempt: 0, componentStack: '', error: null };
		this.retry = this.retry.bind( this );
	}

	static getDerivedStateFromError( error ) {
		return { error };
	}

	componentDidCatch( error, info ) {
		this.setState( { componentStack: info?.componentStack || '' } );
		// eslint-disable-next-line no-console
		console.error( 'The canvas stopped working:', error, info );
	}

	componentDidUpdate( prevProps ) {
		if ( this.state.error && prevProps.resetKey !== this.props.resetKey ) {
			this.retry();
		}
	}

	retry() {
		this.setState( ( { attempt } ) => ( {
			attempt: attempt + 1,
			componentStack: '',
			error: null,
		} ) );
	}

	render() {
		const { attempt, componentStack, error } = this.state;

		if ( ! error ) {
			// A new key mounts everything inside afresh.
			return <Fragment key={ attempt }>{ this.props.children }</Fragment>;
		}

		return (
			<div className="cnl-canvas-recovery" role="alert">
				<EmptyState.Root>
					<EmptyState.Icon icon={ cautionIcon } />
					<EmptyState.Title>
						{ __( 'This view stopped working' ) }
					</EmptyState.Title>
					<EmptyState.Description>
						{ __(
							'Your unsaved changes are safe. Try again to load it afresh.'
						) }
					</EmptyState.Description>
					<EmptyState.Actions>
						<Button
							__next40pxDefaultSize
							onClick={ this.retry }
							variant="primary"
						>
							{ __( 'Try again' ) }
						</Button>
						<Button
							__next40pxDefaultSize
							onClick={ () => copyError( error, componentStack ) }
							variant="tertiary"
						>
							{ __( 'Copy error' ) }
						</Button>
					</EmptyState.Actions>
				</EmptyState.Root>
			</div>
		);
	}
}

/**
 * Wrap a route's canvas so that an error in it can be recovered from.
 *
 * @param {Function} Canvas Route canvas component.
 * @return {Function} The canvas, with a way back from an error.
 */
export function withCanvasRecovery( Canvas ) {
	function RecoverableCanvas( props ) {
		const params = useParams( { strict: false } );
		const search = useSearch( { strict: false } );
		const resetKey = JSON.stringify( [ params, search ] );
		// Only the boundary follows the address; the canvas reads its own.
		const canvas = useMemo( () => <Canvas { ...props } />, [ props ] );

		return (
			<CanvasErrorBoundary resetKey={ resetKey }>
				{ canvas }
			</CanvasErrorBoundary>
		);
	}

	RecoverableCanvas.displayName = `withCanvasRecovery(${
		Canvas.displayName || Canvas.name || 'Canvas'
	})`;

	return RecoverableCanvas;
}
