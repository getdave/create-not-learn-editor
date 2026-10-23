/**
 * What a design preview shows until its design has drawn.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads the pickers from app init. See
 * `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';

/**
 * Whether a preview has drawn its design yet. The block editor's preview
 * renders into a frame that only gets a height once the design inside it has
 * been measured, so until then the card would be an empty box.
 *
 * @param {Object} ref Ref of the element the preview renders in.
 * @return {boolean} Whether the preview has drawn.
 */
export function useHasPreviewDrawn( ref ) {
	const [ hasDrawn, setHasDrawn ] = useState( false );

	useEffect( () => {
		const node = ref.current;

		if ( hasDrawn || ! node ) {
			return;
		}

		const check = () => {
			const frame = node.querySelector( 'iframe' );

			if ( frame && parseFloat( frame.style.height ) > 0 ) {
				setHasDrawn( true );
			}
		};
		const observer = new window.MutationObserver( check );

		observer.observe( node, {
			attributeFilter: [ 'style' ],
			childList: true,
			subtree: true,
		} );
		check();

		return () => observer.disconnect();
	}, [ hasDrawn, ref ] );

	return hasDrawn;
}

// A row of text, as a bar with rounded ends.
function Bar( { x, y, width, height = 14 } ) {
	return (
		<rect
			height={ height }
			rx={ height / 2 }
			width={ width }
			x={ x }
			y={ y }
		/>
	);
}

/**
 * A page drawn in outline while its preview loads: a header, an introduction
 * with a picture, a row of cards, a wide picture, some text and a footer. It
 * stands for any page rather than the one loading, and pulses so it reads as
 * loading rather than empty.
 *
 * Drawn 1200 wide, as previews are, and cut off at the bottom of whatever it
 * fills.
 *
 * @return {Element} The outline.
 */
export function PagePreviewLoading() {
	return (
		<span aria-hidden className="cnl-page-preview-loading">
			<svg
				focusable={ false }
				preserveAspectRatio="xMidYMin slice"
				viewBox="0 0 1200 1600"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g className="cnl-page-preview-loading__shapes">
					{ /* Header: logo, site name, menu and a button. */ }
					<rect height="40" rx="10" width="40" x="64" y="28" />
					<Bar width={ 150 } x={ 120 } y={ 41 } />
					{ [ 640, 730, 820, 910 ].map( ( x ) => (
						<Bar key={ x } width={ 64 } x={ x } y={ 41 } />
					) ) }
					<Bar height={ 44 } width={ 136 } x={ 1000 } y={ 26 } />

					{ /* Introduction: heading, text, button and picture. */ }
					<Bar height={ 60 } width={ 560 } x={ 100 } y={ 190 } />
					<Bar height={ 60 } width={ 420 } x={ 100 } y={ 266 } />
					<Bar width={ 520 } x={ 100 } y={ 366 } />
					<Bar width={ 480 } x={ 100 } y={ 396 } />
					<Bar width={ 360 } x={ 100 } y={ 426 } />
					<Bar height={ 52 } width={ 176 } x={ 100 } y={ 482 } />
					<rect height="380" rx="20" width="380" x="720" y="170" />

					{ /* A row of three cards. */ }
					{ [ 100, 440, 780 ].map( ( x ) => (
						<g key={ x }>
							<rect
								height="200"
								rx="16"
								width="320"
								x={ x }
								y="650"
							/>
							<Bar
								height={ 20 }
								width={ 200 }
								x={ x }
								y={ 876 }
							/>
							<Bar width={ 280 } x={ x } y={ 912 } />
							<Bar width={ 240 } x={ x } y={ 940 } />
						</g>
					) ) }

					{ /* A wide picture, then text. */ }
					<rect height="260" rx="20" width="1000" x="100" y="1030" />
					<Bar height={ 32 } width={ 380 } x={ 100 } y={ 1350 } />
					<Bar width={ 1000 } x={ 100 } y={ 1406 } />
					<Bar width={ 940 } x={ 100 } y={ 1436 } />

					{ /* Footer. */ }
					<rect
						className="cnl-page-preview-loading__footer"
						height="100"
						width="1200"
						x="0"
						y="1500"
					/>
				</g>
			</svg>
		</span>
	);
}
