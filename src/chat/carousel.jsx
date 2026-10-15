/**
 * A row of designs to swipe through one at a time, for pickers whose cards
 * are previews of a layout. In the chat's narrow column a long list would
 * push the conversation out of sight; a carousel keeps it to one card's
 * height.
 *
 * The carousel wraps a picker's own list, so the picker stays the one its
 * screen shows: whatever single element it renders, that element's children
 * are the slides.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, isRTL, sprintf } from '@wordpress/i18n';
import {
	chevronLeft as chevronLeftIcon,
	chevronRight as chevronRightIcon,
} from '@wordpress/icons';

function getSlides( track ) {
	const list = track?.firstElementChild;

	return list ? [ ...list.children ] : [];
}

/**
 * @param {Object}  props          Component props.
 * @param {Element} props.children The picker, rendering one list.
 * @param {string}  props.label    What the slides are, for assistive tech.
 * @return {Element} The carousel.
 */
export function Carousel( { children, label } ) {
	const trackRef = useRef();
	const [ position, setPosition ] = useState( { count: 0, index: 0 } );

	const measure = useCallback( () => {
		const track = trackRef.current;
		const slides = getSlides( track );

		if ( ! track || ! slides.length ) {
			setPosition( { count: 0, index: 0 } );
			return;
		}

		const start = track.getBoundingClientRect().left;
		// The slide whose start is nearest the track's.
		const index = slides.reduce(
			( nearest, slide, i ) =>
				Math.abs( slide.getBoundingClientRect().left - start ) <
				Math.abs(
					slides[ nearest ].getBoundingClientRect().left - start
				)
					? i
					: nearest,
			0
		);

		setPosition( { count: slides.length, index } );
	}, [] );

	// The picker's list can arrive or change after mounting, as it loads.
	useEffect( () => {
		const track = trackRef.current;

		if ( ! track ) {
			return undefined;
		}

		const observer = new window.MutationObserver( measure );
		observer.observe( track, { childList: true, subtree: true } );
		measure();

		return () => observer.disconnect();
	}, [ measure ] );

	const goTo = ( index ) => {
		getSlides( trackRef.current )[ index ]?.scrollIntoView( {
			behavior: 'smooth',
			block: 'nearest',
			inline: 'start',
		} );
	};

	const { count, index } = position;
	const isFirst = index <= 0;
	const isLast = index >= count - 1;
	const rtl = isRTL();

	return (
		<div
			aria-label={ label }
			aria-roledescription={ __( 'carousel' ) }
			className="cnl-chat-carousel"
			role="region"
		>
			<div
				className="cnl-chat-carousel__track"
				onScroll={ measure }
				ref={ trackRef }
			>
				{ children }
			</div>
			{ count > 1 && (
				<div className="cnl-chat-carousel__controls">
					<Button
						accessibleWhenDisabled
						disabled={ isFirst }
						icon={ rtl ? chevronRightIcon : chevronLeftIcon }
						label={ __( 'Previous' ) }
						onClick={ () => goTo( index - 1 ) }
						size="compact"
					/>
					<span
						aria-live="polite"
						className="cnl-chat-carousel__count"
					>
						{ sprintf(
							/* translators: 1: number of the design on show, 2: number of designs. */
							__( '%1$d of %2$d' ),
							index + 1,
							count
						) }
					</span>
					<Button
						accessibleWhenDisabled
						disabled={ isLast }
						icon={ rtl ? chevronLeftIcon : chevronRightIcon }
						label={ __( 'Next' ) }
						onClick={ () => goTo( index + 1 ) }
						size="compact"
					/>
				</div>
			) }
		</div>
	);
}
