/**
 * The "Add a section" picker: every section design the site offers, grouped
 * by what it is for, in one modal. Three ways to start sit at the top:
 * designs, templates, which are plain layouts grouped by shape and shown as
 * wireframes to fill in with your own content, or a blank section.
 *
 * Shared by the Pages screen and the editor, so it knows nothing about where
 * the section goes beyond the sentence describing it. Each caller passes the
 * preview component that works where it is: the Pages screen has
 * lazy-editor's, and the editor has the block editor's own.
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	SearchControl,
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The segmented control is still experimental in @wordpress/components and has no @wordpress/ui equivalent yet. */
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	brush as brushIcon,
	check as checkIcon,
	layout as layoutIcon,
	plus as plusIcon,
} from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';
import { Icon, Skeleton, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	DesignPicker,
	DesignPickerNav,
	GridShapeIcon,
	GroupHeading,
} from '../design-picker';
import {
	getPatternContent,
	getPatternDescription,
	getPatternTitle,
} from '../routes/content/page-layouts';
import { searchSectionDesigns } from './groups';
import { useSectionDesigns } from './patterns';

// Where the designs-per-row choice is remembered between visits.
const PREFERENCES_SCOPE = 'create-not-learn-editor';
const PER_ROW_PREFERENCE = 'sectionPickerPerRow';
const DEFAULT_PER_ROW = 3;
const MODE_PREFERENCE = 'sectionPickerMode';

// What the picker offers: designed sections, or plain layouts to fill in,
// which it calls templates.
const DESIGNS_MODE = 'designs';
const LAYOUTS_MODE = 'layouts';

// How far ahead of the visible area a card starts rendering its preview,
// down a list or along a carousel.
const PREVIEW_MARGIN = '400px';

// How long scrolling has to stop before the cards near view render their
// previews, so the cards a fast scroll passes over don't queue up ahead of
// the ones it stops at. Previews render one at a time, in the order they are
// asked for.
const PREVIEW_SETTLE_MS = 150;

// How much longer the cards only near view wait, so the ones in view are
// rendered first.
const PREVIEW_AHEAD_MS = 300;

// How far below the top of the scroll area a group counts as the one in view.
const ACTIVE_OFFSET = 48;

// Events that mean the designs are being scrolled by hand, not by a jump.
const SCROLL_BY_HAND_EVENTS = [
	'wheel',
	'touchstart',
	'pointerdown',
	'keydown',
];

/**
 * Whether an element has been near the visible part of a scroll area while
 * the scrolling stopped for a moment. Stays true once it has, so a preview is
 * not thrown away when scrolled past.
 *
 * @param {Object} ref     Element ref.
 * @param {Object} rootRef Scroll area ref.
 * @return {boolean} Whether it is near view.
 */
function useHasBeenNearView( ref, rootRef ) {
	const [ isNear, setIsNear ] = useState( false );

	useEffect( () => {
		const node = ref.current;
		const root = rootRef.current;

		if ( isNear || ! node ) {
			return;
		}

		if ( typeof window.IntersectionObserver === 'undefined' ) {
			setIsNear( true );
			return;
		}

		let timer;
		let isIntersecting = false;
		// Whether the element is in view itself, not just near it.
		const isInView = () => {
			const rect = node.getBoundingClientRect();
			const bounds = root
				? root.getBoundingClientRect()
				: {
						bottom: window.innerHeight,
						left: 0,
						right: window.innerWidth,
						top: 0,
					};

			return (
				rect.right > bounds.left &&
				rect.left < bounds.right &&
				rect.bottom > bounds.top &&
				rect.top < bounds.bottom
			);
		};
		// Started again by every scroll, so it only runs out once the
		// scrolling stops. What is in view goes first, and what is only near
		// it a moment later, behind it in the queue.
		const wait = () => {
			window.clearTimeout( timer );

			if ( ! isIntersecting ) {
				return;
			}

			timer = window.setTimeout( () => {
				if ( isInView() ) {
					setIsNear( true );
					return;
				}

				timer = window.setTimeout(
					() => setIsNear( true ),
					PREVIEW_AHEAD_MS
				);
			}, PREVIEW_SETTLE_MS );
		};
		const observer = new window.IntersectionObserver(
			( entries ) => {
				isIntersecting = entries[ entries.length - 1 ].isIntersecting;
				wait();
			},
			{ root, rootMargin: PREVIEW_MARGIN }
		);
		const scroller = root || window;

		observer.observe( node );
		scroller.addEventListener( 'scroll', wait, { passive: true } );

		return () => {
			window.clearTimeout( timer );
			observer.disconnect();
			scroller.removeEventListener( 'scroll', wait );
		};
	}, [ isNear, ref, rootRef ] );

	return isNear;
}

/**
 * A section design: its preview, and its name with "Add" underneath.
 *
 * Shared with the chat, which marks the design it has added.
 *
 * @param {Object}   props            Component props.
 * @param {boolean}  props.isSelected Whether the design has been added.
 * @param {Function} props.onPick     Called with the pattern.
 * @param {Object}   props.pattern    Block pattern.
 * @param {Function} props.Preview    Renders the preview.
 * @param {Object}   props.scrollRef  Scroll area ref, to render the preview
 *                                    only once it comes near view.
 * @return {Element} The design.
 */
export function SectionDesignCard( {
	isSelected = false,
	onPick,
	pattern,
	Preview,
	scrollRef,
} ) {
	const ref = useRef();
	const isNearView = useHasBeenNearView( ref, scrollRef );
	const title = getPatternTitle( pattern );
	const description = getPatternDescription( pattern );

	return (
		<li className="cnl-section-picker__item" ref={ ref }>
			<button
				aria-label={ sprintf(
					/* translators: %s: section design name. */
					__( 'Add %s' ),
					title
				) }
				aria-pressed={ isSelected || undefined }
				className={ `cnl-design-picker__card cnl-section-picker__card${
					isSelected ? ' is-selected' : ''
				}` }
				onClick={ () => onPick( pattern ) }
				title={ description || undefined }
				type="button"
			>
				<span className="cnl-design-picker__preview cnl-section-picker__preview">
					{ isNearView && (
						<Preview
							content={ getPatternContent( pattern ) }
							description={ title }
						/>
					) }
				</span>
				<span className="cnl-design-picker__card-footer">
					<span className="cnl-design-picker__name">{ title }</span>
					<span
						aria-hidden
						className="cnl-design-picker__action cnl-section-picker__add"
					>
						<Icon
							icon={ isSelected ? checkIcon : plusIcon }
							size={ 16 }
						/>
						{ isSelected ? __( 'Added' ) : __( 'Add' ) }
					</span>
				</span>
			</button>
		</li>
	);
}

function DesignGrid( { onPick, patterns, Preview, scrollRef } ) {
	return (
		<ul className="cnl-section-picker__grid" role="list">
			{ patterns.map( ( pattern ) => (
				<SectionDesignCard
					key={ pattern.name }
					onPick={ onPick }
					pattern={ pattern }
					Preview={ Preview }
					scrollRef={ scrollRef }
				/>
			) ) }
		</ul>
	);
}

/**
 * One way to start a section, as a card with an icon, a name and a few words
 * on what it gives you.
 *
 * @param {Object}   props             Component props.
 * @param {string}   props.description What starting this way gives you.
 * @param {Object}   props.icon        Icon.
 * @param {boolean}  props.isPressed   Whether it is the choice showing below,
 *                                     if it is a choice rather than an action.
 * @param {string}   props.label       Name.
 * @param {Function} props.onClick     Called when picked.
 * @return {Element} The card.
 */
function StartOption( { description, icon, isPressed, label, onClick } ) {
	return (
		<li>
			<button
				aria-pressed={ isPressed }
				className={ `cnl-section-picker__start${ isPressed ? ' is-pressed' : '' }` }
				onClick={ onClick }
				type="button"
			>
				<span aria-hidden className="cnl-section-picker__start-icon">
					<Icon icon={ icon } />
				</span>
				<span className="cnl-section-picker__start-text">
					<span className="cnl-section-picker__start-label">
						{ label }
					</span>
					<span className="cnl-section-picker__start-description">
						{ description }
					</span>
				</span>
			</button>
		</li>
	);
}

/**
 * The ways to start, above everything else: designs or templates, which swap
 * what shows below, and a blank section, which is added straight away.
 *
 * @param {Object}   props              Component props.
 * @param {boolean}  props.hasTemplates Whether there are templates to offer.
 * @param {string}   props.mode         What shows below.
 * @param {Function} props.onModeChange Called with the mode picked.
 * @param {Function} props.onStartBlank Called to add an empty section.
 * @return {Element} The cards.
 */
function StartOptions( { hasTemplates, mode, onModeChange, onStartBlank } ) {
	return (
		<ul
			aria-label={ __( 'How to start' ) }
			className="cnl-section-picker__starts"
			role="list"
		>
			<StartOption
				description={ __( 'Predesigned sections you can customize' ) }
				icon={ brushIcon }
				isPressed={ mode === DESIGNS_MODE }
				label={ __( 'Designs' ) }
				onClick={ () => onModeChange( DESIGNS_MODE ) }
			/>
			{ hasTemplates && (
				<StartOption
					description={ __(
						'Starting points to fill with your content'
					) }
					icon={ layoutIcon }
					isPressed={ mode === LAYOUTS_MODE }
					label={ __( 'Templates' ) }
					onClick={ () => onModeChange( LAYOUTS_MODE ) }
				/>
			) }
			<StartOption
				description={ __(
					'An empty section to build however you like'
				) }
				icon={ plusIcon }
				label={ __( 'Start blank' ) }
				onClick={ onStartBlank }
			/>
		</ul>
	);
}

/**
 * The heading over search results.
 *
 * @param {number}  count         How many matched.
 * @param {string}  search        What was typed.
 * @param {boolean} isLayoutsMode Whether templates were searched.
 * @return {string} The heading.
 */
function getResultsLabel( count, search, isLayoutsMode ) {
	if ( count ) {
		return isLayoutsMode
			? sprintf(
					/* translators: %d: number of section templates. */
					_n( '%d template', '%d templates', count ),
					count
				)
			: sprintf(
					/* translators: %d: number of section designs. */
					_n( '%d design', '%d designs', count ),
					count
				);
	}

	return isLayoutsMode
		? sprintf(
				/* translators: %s: what was searched for. */
				__( 'No templates match “%s”' ),
				search.trim()
			)
		: sprintf(
				/* translators: %s: what was searched for. */
				__( 'No designs match “%s”' ),
				search.trim()
			);
}

/**
 * Follow which group is in view as the designs scroll, and jump to a group.
 *
 * A jump holds the group jumped to until the designs are scrolled by hand, so
 * the groups scrolled past on the way don't flicker through, and a short group
 * near the end, which can't reach the top, still shows as the one picked.
 *
 * @param {Object}   scrollRef Scroll area ref.
 * @param {Object[]} groups    Groups shown.
 * @param {string}   idPrefix  Prefix of each group's element ID.
 * @return {Array} `[ activeGroup, jumpTo ]`.
 */
function useActiveGroup( scrollRef, groups, idPrefix ) {
	const [ activeGroup, setActiveGroup ] = useState( null );
	const isJumpingRef = useRef( false );

	useEffect( () => {
		const container = scrollRef.current;

		if ( ! container || ! groups.length ) {
			return;
		}

		let frame;
		const update = () => {
			frame = null;

			if ( isJumpingRef.current ) {
				return;
			}

			const top = container.getBoundingClientRect().top + ACTIVE_OFFSET;
			const isAtEnd =
				container.scrollTop + container.clientHeight >=
				container.scrollHeight - 1;
			let active = groups[ 0 ].name;

			if ( isAtEnd && container.scrollTop > 0 ) {
				active = groups[ groups.length - 1 ].name;
			} else {
				groups.forEach( ( group ) => {
					const node = document.getElementById(
						`${ idPrefix }-${ group.name }`
					);

					if ( node && node.getBoundingClientRect().top <= top ) {
						active = group.name;
					}
				} );
			}

			setActiveGroup( active );
		};
		const onScroll = () => {
			if ( ! frame ) {
				frame = window.requestAnimationFrame( update );
			}
		};
		const onScrollByHand = () => {
			isJumpingRef.current = false;
		};

		update();
		container.addEventListener( 'scroll', onScroll, { passive: true } );
		SCROLL_BY_HAND_EVENTS.forEach( ( type ) =>
			container.addEventListener( type, onScrollByHand, {
				passive: true,
			} )
		);

		return () => {
			container.removeEventListener( 'scroll', onScroll );
			SCROLL_BY_HAND_EVENTS.forEach( ( type ) =>
				container.removeEventListener( type, onScrollByHand )
			);

			if ( frame ) {
				window.cancelAnimationFrame( frame );
			}
		};
	}, [ groups, idPrefix, scrollRef ] );

	const jumpTo = ( name ) => {
		isJumpingRef.current = true;
		setActiveGroup( name );
		document
			.getElementById( `${ idPrefix }-${ name }` )
			?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
	};

	return [ activeGroup, jumpTo ];
}

/**
 * How many designs show in each row, remembered as a user preference.
 *
 * @return {Array} `[ perRow, setPerRow ]`.
 */
function usePerRow() {
	const perRow = useSelect(
		( select ) =>
			select( preferencesStore ).get(
				PREFERENCES_SCOPE,
				PER_ROW_PREFERENCE
			) || DEFAULT_PER_ROW,
		[]
	);
	const { set } = useDispatch( preferencesStore );

	return [
		perRow,
		( value ) => set( PREFERENCES_SCOPE, PER_ROW_PREFERENCE, value ),
	];
}

/**
 * Whether the picker shows designs or layouts, remembered as a user
 * preference.
 *
 * @return {Array} `[ mode, setMode ]`.
 */
function useMode() {
	const mode = useSelect(
		( select ) =>
			select( preferencesStore ).get(
				PREFERENCES_SCOPE,
				MODE_PREFERENCE
			) || DESIGNS_MODE,
		[]
	);
	const { set } = useDispatch( preferencesStore );

	return [
		mode,
		( value ) => set( PREFERENCES_SCOPE, MODE_PREFERENCE, value ),
	];
}

/**
 * The "Add a section" modal.
 *
 * @param {Object}   props                    Component props.
 * @param {string}   props.placement          Where the section will go, as a
 *                                            sentence.
 * @param {Function} props.Preview            Renders a design's preview from
 *                                            `{ content, description }`.
 * @param {Function} props.onClose            Called to close without adding.
 * @param {Function} props.onPick             Called with the picked pattern.
 * @param {Function} props.onStartFromScratch Called to add an empty section.
 * @return {Element} The modal.
 */
export function SectionPicker( {
	placement,
	Preview,
	onClose,
	onPick,
	onStartFromScratch,
} ) {
	const { groups, isLoading, layoutGroups, layouts, patterns } =
		useSectionDesigns();
	const [ search, setSearch ] = useState( '' );
	const [ perRow, setPerRow ] = usePerRow();
	const [ preferredMode, setMode ] = useMode();
	const scrollRef = useRef();
	const idPrefix = `cnl-section-picker-${ useId().replace( /:/g, '' ) }`;
	const hasLayouts = layouts.length > 0;
	const isLayoutsMode = hasLayouts && preferredMode === LAYOUTS_MODE;
	const shownPatterns = isLayoutsMode ? layouts : patterns;
	const modeGroups = isLayoutsMode ? layoutGroups : groups;
	const isSearching = !! search.trim();
	const results = useMemo(
		() =>
			isSearching ? searchSectionDesigns( shownPatterns, search ) : [],
		[ isSearching, shownPatterns, search ]
	);
	const shownGroups = isSearching ? [] : modeGroups;
	const [ activeGroup, jumpTo ] = useActiveGroup(
		scrollRef,
		shownGroups,
		idPrefix
	);

	const switchMode = ( value ) => {
		setMode( value );

		if ( scrollRef.current ) {
			scrollRef.current.scrollTop = 0;
		}
	};

	let body;

	if ( isLoading && ! patterns.length && ! layouts.length ) {
		body = (
			<div aria-hidden className="cnl-section-picker__grid">
				{ [ 0, 1, 2 ].map( ( key ) => (
					<Skeleton
						className="cnl-section-picker__skeleton"
						key={ key }
					/>
				) ) }
			</div>
		);
	} else if ( isSearching ) {
		body = (
			<section
				aria-labelledby={ `${ idPrefix }-results` }
				className="cnl-section-picker__group"
			>
				<GroupHeading
					id={ `${ idPrefix }-results` }
					label={ getResultsLabel(
						results.length,
						search,
						isLayoutsMode
					) }
				/>
				{ ! results.length && hasLayouts && (
					<Button
						className="cnl-section-picker__other-mode"
						onClick={ () =>
							switchMode(
								isLayoutsMode ? DESIGNS_MODE : LAYOUTS_MODE
							)
						}
						variant="link"
					>
						{ isLayoutsMode
							? __( 'Search designs instead' )
							: __( 'Search templates instead' ) }
					</Button>
				) }
				{ results.length > 0 && (
					<DesignGrid
						onPick={ onPick }
						patterns={ results }
						Preview={ Preview }
						scrollRef={ scrollRef }
					/>
				) }
			</section>
		);
	} else if ( ! modeGroups.length ) {
		body = (
			<Text className="cnl-design-picker__empty" variant="body-md">
				{ __(
					'Your theme has no section designs to offer, so start blank.'
				) }
			</Text>
		);
	} else {
		body = modeGroups.map( ( group ) => (
			<section
				aria-labelledby={ `${ idPrefix }-${ group.name }` }
				className="cnl-section-picker__group"
				key={ group.name }
			>
				<GroupHeading
					description={ group.description }
					id={ `${ idPrefix }-${ group.name }` }
					label={ group.label }
				/>
				<DesignGrid
					onPick={ onPick }
					patterns={ group.patterns }
					Preview={ Preview }
					scrollRef={ scrollRef }
				/>
			</section>
		) );
	}

	return (
		<DesignPicker
			actions={ [
				<ToggleGroupControl
					__next40pxDefaultSize
					hideLabelFromVision
					isBlock={ false }
					key="per-row"
					label={ __( 'Designs per row' ) }
					onChange={ ( value ) => setPerRow( Number( value ) ) }
					value={ String( perRow ) }
				>
					<ToggleGroupControlOptionIcon
						icon={ <GridShapeIcon columns={ 3 } rows={ 2 } /> }
						label={ __( 'Three per row' ) }
						value="3"
					/>
					<ToggleGroupControlOptionIcon
						icon={ <GridShapeIcon columns={ 2 } rows={ 2 } /> }
						label={ __( 'Two per row' ) }
						value="2"
					/>
				</ToggleGroupControl>,
				<SearchControl
					className="cnl-section-picker__search"
					key="search"
					label={
						isLayoutsMode
							? __( 'Search section templates' )
							: __( 'Search section designs' )
					}
					onChange={ setSearch }
					placeholder={
						isLayoutsMode
							? __( 'Search templates…' )
							: __( 'Search designs…' )
					}
					value={ search }
				/>,
			] }
			className="cnl-section-picker"
			mainClassName={ `is-${ perRow }-per-row` }
			mainRef={ scrollRef }
			nav={
				<DesignPickerNav
					current={ activeGroup }
					isDisabled={ isSearching }
					items={ modeGroups.map( ( group ) => ( {
						label: group.label,
						value: group.name,
					} ) ) }
					label={ __( 'Kinds of section' ) }
					onSelect={ jumpTo }
				/>
			}
			onClose={ onClose }
			subtitle={ [ __( 'Choose how to start.' ), placement ]
				.filter( Boolean )
				.join( ' ' ) }
			title={ __( 'Add a section' ) }
		>
			<StartOptions
				hasTemplates={ hasLayouts }
				mode={ isLayoutsMode ? LAYOUTS_MODE : DESIGNS_MODE }
				onModeChange={ switchMode }
				onStartBlank={ onStartFromScratch }
			/>
			{ body }
		</DesignPicker>
	);
}
