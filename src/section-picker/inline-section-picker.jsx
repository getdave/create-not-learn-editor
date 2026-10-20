/**
 * The "Add a section" picker opened in place, in a gap the canvas opens up
 * where the section will go: the designs and the templates, each as a
 * carousel of the modal's own cards, then a blank section, with a way to the
 * modal for searching and browsing them by kind.
 *
 * The designs and templates are shuffled each time it opens, so a few
 * openings show a few of what is on offer. The theme's own designs are
 * shuffled among themselves and lead, so the first few match the site.
 *
 * It knows nothing about the canvas: the caller places it, closes it on
 * Escape, and passes the preview component that works where it is, as with
 * the modal.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, isRTL } from '@wordpress/i18n';
import {
	arrowRight as arrowRightIcon,
	chevronLeft as chevronLeftIcon,
	chevronRight as chevronRightIcon,
	close as closeIcon,
	plus as plusIcon,
} from '@wordpress/icons';
import { Icon, Skeleton } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { GroupHeading } from '../design-picker';
import { useSectionDesigns } from './patterns';
import { SectionDesignCard } from './section-picker';

const EMPTY_ARRAY = [];

// A line of a mouse wheel's scroll, in pixels.
const WHEEL_LINE = 16;

/**
 * Patterns in a random order.
 *
 * @param {Object[]} patterns Patterns.
 * @return {Object[]} The same patterns, shuffled.
 */
function shuffle( patterns ) {
	const shuffled = [ ...patterns ];

	for ( let i = shuffled.length - 1; i > 0; i-- ) {
		const j = Math.floor( Math.random() * ( i + 1 ) );

		[ shuffled[ i ], shuffled[ j ] ] = [ shuffled[ j ], shuffled[ i ] ];
	}

	return shuffled;
}

/**
 * Patterns in an order of their own each time the picker opens, kept while
 * it is open. Any put first stay first, shuffled among themselves.
 *
 * @param {Object[]} patterns Patterns.
 * @param {Object[]} first    Those of them to put first.
 * @return {Object[]} The same patterns, shuffled.
 */
function useShuffled( patterns, first = EMPTY_ARRAY ) {
	return useMemo(
		() => [
			...shuffle( first ),
			...shuffle(
				patterns.filter( ( pattern ) => ! first.includes( pattern ) )
			),
		],
		[ patterns, first ]
	);
}

/**
 * One kind of section, as a row of cards that scrolls sideways: a card at a
 * time with the arrows beside its heading, or freely with a trackpad or
 * mouse wheel.
 *
 * @param {Object}   props             Component props.
 * @param {string}   props.description What this kind gives you.
 * @param {string}   props.label       Name of the kind.
 * @param {string}   props.nextLabel   Label of the next arrow.
 * @param {Function} props.onPick      Called with the picked pattern.
 * @param {Object[]} props.patterns    Patterns.
 * @param {string}   props.prevLabel   Label of the previous arrow.
 * @param {Function} props.Preview     Renders a design's preview.
 * @return {Element} The row.
 */
function DesignCarousel( {
	description,
	label,
	nextLabel,
	onPick,
	patterns,
	prevLabel,
	Preview,
} ) {
	const id = `cnl-inline-section-picker-${ useId().replace( /:/g, '' ) }`;
	const trackRef = useRef();
	const [ edges, setEdges ] = useState( { isAtEnd: false, isAtStart: true } );
	const rtl = isRTL();

	const measure = useCallback( () => {
		const track = trackRef.current;

		if ( ! track ) {
			return;
		}

		// Negative when right to left.
		const scrolled = Math.abs( track.scrollLeft );

		setEdges( {
			isAtEnd: scrolled + track.clientWidth >= track.scrollWidth - 1,
			isAtStart: scrolled <= 1,
		} );
	}, [] );

	useEffect( () => {
		const track = trackRef.current;

		if ( ! track ) {
			return undefined;
		}

		const observer = new window.ResizeObserver( measure );

		observer.observe( track );

		return () => observer.disconnect();
	}, [ measure, patterns ] );

	/*
	 * A mouse wheel turned over the row scrolls it sideways, until it
	 * reaches its end, when the canvas scrolls again. A sideways swipe on a
	 * trackpad scrolls it as it would anyway. Either way the canvas under
	 * it, which the section layer scrolls on every wheel, is left alone.
	 */
	useEffect( () => {
		const track = trackRef.current;

		if ( ! track ) {
			return undefined;
		}

		const onWheel = ( event ) => {
			if ( Math.abs( event.deltaX ) > Math.abs( event.deltaY ) ) {
				event.stopPropagation();
				return;
			}

			// A pinch, which zooms the canvas.
			if ( event.ctrlKey ) {
				return;
			}

			const max = track.scrollWidth - track.clientWidth;
			const scrolled = Math.abs( track.scrollLeft );
			// In lines, from some mice.
			const delta =
				event.deltaY * ( event.deltaMode === 1 ? WHEEL_LINE : 1 );

			if (
				max <= 0 ||
				( delta < 0 && scrolled <= 0 ) ||
				( delta > 0 && scrolled >= max - 1 )
			) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			track.scrollLeft += rtl ? -delta : delta;
		};

		track.addEventListener( 'wheel', onWheel, { passive: false } );

		return () => track.removeEventListener( 'wheel', onWheel );
	}, [ rtl ] );

	// To the start of the next card along, or the one before, from wherever
	// the wheel left the row.
	const step = ( direction ) => {
		const track = trackRef.current;

		if ( ! track ) {
			return;
		}

		const bounds = track.getBoundingClientRect();
		const offsets = [ ...track.children ].map( ( card ) => {
			const rect = card.getBoundingClientRect();

			return rtl ? bounds.right - rect.right : rect.left - bounds.left;
		} );
		const offset =
			direction > 0
				? offsets.find( ( value ) => value > 1 )
				: offsets.filter( ( value ) => value < -1 ).pop();

		if ( offset === undefined ) {
			return;
		}

		const reduceMotion = window.matchMedia(
			'(prefers-reduced-motion: reduce)'
		).matches;

		track.scrollBy( {
			behavior: reduceMotion ? 'auto' : 'smooth',
			left: rtl ? -offset : offset,
		} );
	};

	return (
		<section
			aria-labelledby={ id }
			className="cnl-inline-section-picker__row"
		>
			<GroupHeading description={ description } id={ id } label={ label }>
				{ ! ( edges.isAtStart && edges.isAtEnd ) && (
					<div className="cnl-inline-section-picker__arrows">
						<Button
							accessibleWhenDisabled
							disabled={ edges.isAtStart }
							icon={ rtl ? chevronRightIcon : chevronLeftIcon }
							label={ prevLabel }
							onClick={ () => step( -1 ) }
							size="compact"
						/>
						<Button
							accessibleWhenDisabled
							disabled={ edges.isAtEnd }
							icon={ rtl ? chevronLeftIcon : chevronRightIcon }
							label={ nextLabel }
							onClick={ () => step( 1 ) }
							size="compact"
						/>
					</div>
				) }
			</GroupHeading>
			<ul
				className="cnl-inline-section-picker__track"
				onScroll={ measure }
				ref={ trackRef }
				role="list"
			>
				{ patterns.map( ( pattern ) => (
					<SectionDesignCard
						key={ pattern.name }
						onPick={ onPick }
						pattern={ pattern }
						Preview={ Preview }
						scrollRef={ trackRef }
					/>
				) ) }
			</ul>
		</section>
	);
}

/**
 * @param {Object}   props              Component props.
 * @param {Function} props.Preview      Renders a design's preview from
 *                                      `{ content, description }`.
 * @param {Function} props.onClose      Called to close without adding.
 * @param {Function} props.onPick       Called with the picked pattern.
 * @param {Function} props.onStartBlank Called to add an empty section.
 * @param {Function} props.onViewAll    Called to open the full picker.
 * @return {Element} The picker.
 */
export function InlineSectionPicker( {
	Preview,
	onClose,
	onPick,
	onStartBlank,
	onViewAll,
} ) {
	const { isLoading, layouts, patterns, themePatterns } = useSectionDesigns();
	const designs = useShuffled( patterns, themePatterns );
	const templates = useShuffled( layouts );
	const ref = useRef();
	const isWaiting = isLoading && ! patterns.length && ! layouts.length;

	// Straight to the picker, so the keyboard goes on from where it opened.
	useEffect( () => {
		ref.current?.focus( { preventScroll: true } );
	}, [] );

	return (
		<div
			aria-label={ __( 'Add a section' ) }
			className="cnl-inline-section-picker"
			ref={ ref }
			role="region"
			tabIndex={ -1 }
		>
			<div className="cnl-inline-section-picker__header">
				<span className="cnl-inline-section-picker__title">
					{ __( 'Add a section' ) }
				</span>
				<div className="cnl-inline-section-picker__actions">
					<Button
						__next40pxDefaultSize
						icon={ arrowRightIcon }
						iconPosition="right"
						onClick={ onViewAll }
						variant="primary"
					>
						{ __( 'View all sections' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						icon={ closeIcon }
						label={ __( 'Close' ) }
						onClick={ onClose }
					/>
				</div>
			</div>
			{ isWaiting &&
				[ 0, 1 ].map( ( row ) => (
					<div
						aria-hidden
						className="cnl-inline-section-picker__track"
						key={ row }
					>
						{ [ 0, 1, 2, 3 ].map( ( key ) => (
							<Skeleton
								className="cnl-section-picker__skeleton"
								key={ key }
							/>
						) ) }
					</div>
				) ) }
			{ designs.length > 0 && (
				<DesignCarousel
					description={ __(
						'Predesigned sections you can customize'
					) }
					label={ __( 'Designs' ) }
					nextLabel={ __( 'More designs' ) }
					onPick={ onPick }
					patterns={ designs }
					prevLabel={ __( 'Previous designs' ) }
					Preview={ Preview }
				/>
			) }
			{ templates.length > 0 && (
				<DesignCarousel
					description={ __(
						'Starting points to fill with your content'
					) }
					label={ __( 'Templates' ) }
					nextLabel={ __( 'More templates' ) }
					onPick={ onPick }
					patterns={ templates }
					prevLabel={ __( 'Previous templates' ) }
					Preview={ Preview }
				/>
			) }
			<button
				className="cnl-inline-section-picker__blank"
				onClick={ onStartBlank }
				type="button"
			>
				<Icon icon={ plusIcon } size={ 20 } />
				<span className="cnl-inline-section-picker__blank-label">
					{ __( 'Start blank' ) }
				</span>
				<span className="cnl-inline-section-picker__blank-description">
					{ __( 'An empty section to build however you like' ) }
				</span>
			</button>
		</div>
	);
}
