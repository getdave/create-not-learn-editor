/**
 * The "Add a section" picker: every section design the site offers, grouped
 * by what it is for, in one modal.
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
	SearchControl,
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The segmented control is still experimental in @wordpress/components and has no @wordpress/ui equivalent yet. */
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	createElement as el,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { plus as plusIcon } from '@wordpress/icons';
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
	StartFromScratch,
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

// How far ahead of the visible area a card starts rendering its preview.
const PREVIEW_MARGIN = '400px 0px';

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
 * Whether an element has come near the visible part of a scroll area. Stays
 * true once it has, so a preview is not thrown away when scrolled past.
 *
 * @param {Object} ref     Element ref.
 * @param {Object} rootRef Scroll area ref.
 * @return {boolean} Whether it is near view.
 */
function useHasBeenNearView( ref, rootRef ) {
	const [ isNear, setIsNear ] = useState( false );

	useEffect( () => {
		const node = ref.current;

		if ( isNear || ! node ) {
			return;
		}

		if ( typeof window.IntersectionObserver === 'undefined' ) {
			setIsNear( true );
			return;
		}

		const observer = new window.IntersectionObserver(
			( entries ) => {
				if ( entries.some( ( entry ) => entry.isIntersecting ) ) {
					setIsNear( true );
				}
			},
			{ root: rootRef.current, rootMargin: PREVIEW_MARGIN }
		);

		observer.observe( node );

		return () => observer.disconnect();
	}, [ isNear, ref, rootRef ] );

	return isNear;
}

function DesignCard( { onPick, pattern, Preview, scrollRef } ) {
	const ref = useRef();
	const isNearView = useHasBeenNearView( ref, scrollRef );
	const title = getPatternTitle( pattern );
	const description = getPatternDescription( pattern );

	return el(
		'li',
		{ className: 'cnl-section-picker__item', ref },
		el(
			'button',
			{
				'aria-label': sprintf(
					/* translators: %s: section design name. */
					__( 'Add %s' ),
					title
				),
				className: 'cnl-design-picker__card cnl-section-picker__card',
				onClick: () => onPick( pattern ),
				title: description || undefined,
				type: 'button',
			},
			el(
				'span',
				{
					className:
						'cnl-design-picker__preview cnl-section-picker__preview',
				},
				isNearView &&
					el( Preview, {
						content: getPatternContent( pattern ),
						description: title,
					} )
			),
			el(
				'span',
				{ className: 'cnl-design-picker__card-footer' },
				el( 'span', { className: 'cnl-design-picker__name' }, title ),
				el(
					'span',
					{
						'aria-hidden': true,
						className:
							'cnl-design-picker__action cnl-section-picker__add',
					},
					el( Icon, { icon: plusIcon, size: 16 } ),
					__( 'Add' )
				)
			)
		)
	);
}

function DesignGrid( { onPick, patterns, Preview, scrollRef } ) {
	return el(
		'ul',
		{ className: 'cnl-section-picker__grid', role: 'list' },
		patterns.map( ( pattern ) =>
			el( DesignCard, {
				key: pattern.name,
				onPick,
				pattern,
				Preview,
				scrollRef,
			} )
		)
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
	const { groups, isLoading, patterns } = useSectionDesigns();
	const [ search, setSearch ] = useState( '' );
	const [ perRow, setPerRow ] = usePerRow();
	const scrollRef = useRef();
	const idPrefix = `cnl-section-picker-${ useId().replace( /:/g, '' ) }`;
	const isSearching = !! search.trim();
	const results = useMemo(
		() => ( isSearching ? searchSectionDesigns( patterns, search ) : [] ),
		[ isSearching, patterns, search ]
	);
	const shownGroups = isSearching ? [] : groups;
	const [ activeGroup, jumpTo ] = useActiveGroup(
		scrollRef,
		shownGroups,
		idPrefix
	);

	let body;

	if ( isLoading && ! patterns.length ) {
		body = el(
			'div',
			{ 'aria-hidden': true, className: 'cnl-section-picker__grid' },
			[ 0, 1, 2 ].map( ( key ) =>
				el( Skeleton, {
					className: 'cnl-section-picker__skeleton',
					key,
				} )
			)
		);
	} else if ( isSearching ) {
		body = el(
			'section',
			{
				'aria-labelledby': `${ idPrefix }-results`,
				className: 'cnl-section-picker__group',
			},
			el( GroupHeading, {
				id: `${ idPrefix }-results`,
				label: results.length
					? sprintf(
							/* translators: %d: number of section designs. */
							_n( '%d design', '%d designs', results.length ),
							results.length
						)
					: sprintf(
							/* translators: %s: what was searched for. */
							__( 'No designs match “%s”' ),
							search.trim()
						),
			} ),
			results.length > 0 &&
				el( DesignGrid, {
					onPick,
					patterns: results,
					Preview,
					scrollRef,
				} )
		);
	} else if ( ! groups.length ) {
		body = el(
			Text,
			{ className: 'cnl-design-picker__empty', variant: 'body-md' },
			__(
				'Your theme has no section designs to offer, so start from scratch.'
			)
		);
	} else {
		body = groups.map( ( group ) =>
			el(
				'section',
				{
					'aria-labelledby': `${ idPrefix }-${ group.name }`,
					className: 'cnl-section-picker__group',
					key: group.name,
				},
				el( GroupHeading, {
					description: group.description,
					id: `${ idPrefix }-${ group.name }`,
					label: group.label,
				} ),
				el( DesignGrid, {
					onPick,
					patterns: group.patterns,
					Preview,
					scrollRef,
				} )
			)
		);
	}

	return el(
		DesignPicker,
		{
			actions: [
				el(
					ToggleGroupControl,
					{
						__next40pxDefaultSize: true,
						hideLabelFromVision: true,
						isBlock: false,
						key: 'per-row',
						label: __( 'Designs per row' ),
						onChange: ( value ) => setPerRow( Number( value ) ),
						value: String( perRow ),
					},
					el( ToggleGroupControlOptionIcon, {
						icon: el( GridShapeIcon, { columns: 3, rows: 2 } ),
						label: __( 'Three per row' ),
						value: '3',
					} ),
					el( ToggleGroupControlOptionIcon, {
						icon: el( GridShapeIcon, { columns: 2, rows: 2 } ),
						label: __( 'Two per row' ),
						value: '2',
					} )
				),
				el( SearchControl, {
					className: 'cnl-section-picker__search',
					key: 'search',
					label: __( 'Search section designs' ),
					onChange: setSearch,
					placeholder: __( 'Search designs…' ),
					value: search,
				} ),
			],
			className: 'cnl-section-picker',
			mainClassName: `is-${ perRow }-per-row`,
			mainRef: scrollRef,
			nav: el( DesignPickerNav, {
				current: activeGroup,
				isDisabled: isSearching,
				items: groups.map( ( group ) => ( {
					label: group.label,
					value: group.name,
				} ) ),
				label: __( 'Kinds of section' ),
				onSelect: jumpTo,
			} ),
			onClose,
			subtitle: [ __( 'Choose a design to get started.' ), placement ]
				.filter( Boolean )
				.join( ' ' ),
			title: __( 'Add a section' ),
		},
		el( StartFromScratch, {
			description: __( 'Build your section on a blank canvas' ),
			onClick: onStartFromScratch,
		} ),
		body
	);
}
