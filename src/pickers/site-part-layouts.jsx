/**
 * The theme's layouts for the header or footer.
 *
 * Shared by the Header and Footer screens and the chat. Picking a layout swaps
 * the part's blocks for it as an unsaved change, which the canvas shows
 * straight away, and calls `onPick` with the layout's title.
 *
 * Each caller passes the preview component that works where it is, as with
 * the section picker. The layouts are in purple, as everything that changes
 * what every page shares is. See `src/global-scope`.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads it from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { parse as parseBlocks, serialize } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { useDispatch } from '@wordpress/data';
import { useMemo, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { check as checkIcon } from '@wordpress/icons';
import { Icon, Spinner, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { GlobalScope } from '../global-scope';
import {
	getPatternContent,
	getPatternTitle,
} from '../routes/content/page-layouts';
import {
	putLayoutFirst,
	useSitePartLayouts,
} from '../routes/site-part/layouts';

const NO_LAYOUTS = {
	footer: __( 'Your theme doesn’t offer any layouts for its footer.' ),
	header: __( 'Your theme doesn’t offer any layouts for its header.' ),
};

function LayoutCard( { isCurrent, onSelect, pattern, Preview } ) {
	const title = getPatternTitle( pattern );

	return (
		<li>
			<button
				aria-pressed={ isCurrent }
				className={ `cnl-site-part__layout${
					isCurrent ? ' is-current' : ''
				}` }
				onClick={ () => ! isCurrent && onSelect( pattern ) }
				type="button"
			>
				<span aria-hidden className="cnl-site-part__layout-preview">
					<Preview
						content={ getPatternContent( pattern ) }
						description={ title }
					/>
				</span>
				<span className="cnl-site-part__layout-footer">
					<span className="cnl-site-part__layout-title">
						{ title }
					</span>
					{ isCurrent && (
						<span className="cnl-site-part__layout-current">
							<Icon icon={ checkIcon } size={ 16 } />
							{ __( 'Current' ) }
						</span>
					) }
				</span>
			</button>
		</li>
	);
}

/**
 * The theme's layouts for the part.
 *
 * @param {Object}   props               Component props.
 * @param {string}   props.area          `header` or `footer`.
 * @param {string}   props.id            The part's template part ID.
 * @param {Function} props.onPick        Called with the layout's title once
 *                                       applied.
 * @param {Function} props.Preview       Renders a layout's preview from
 *                                       `{ content, description }`.
 * @param {Function} props.prepareBlocks Fills in a layout's blocks before
 *                                       they go in, like the Header and
 *                                       Footer screens carrying the site's
 *                                       social links over. Optional.
 * @return {Element} The layouts, or a note when the theme has none.
 */
export function SitePartLayouts( {
	area,
	id,
	onPick,
	Preview,
	prepareBlocks,
} ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { content, currentName, hasResolved, layouts } = useSitePartLayouts(
		area,
		id
	);
	/*
	 * The layout in use when the screen opens leads the list. Picking another
	 * leaves the order alone, so the list doesn't jump under the pointer.
	 */
	const leadRef = useRef();
	if ( leadRef.current === undefined && layouts.length && content ) {
		leadRef.current = currentName;
	}
	const lead = leadRef.current;
	const orderedLayouts = useMemo(
		() => putLayoutFirst( layouts, lead ),
		[ layouts, lead ]
	);

	if ( ! hasResolved ) {
		return (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	}

	if ( ! layouts.length ) {
		return (
			<Text className="routes-styles__muted" variant="body-md">
				{ NO_LAYOUTS[ area ] }
			</Text>
		);
	}

	const select = ( pattern ) => {
		const blocks = parseBlocks( getPatternContent( pattern ) );

		editEntityRecord( 'postType', 'wp_template_part', id, {
			blocks: prepareBlocks ? prepareBlocks( blocks ) : blocks,
			// A new function on every edit, as the editor does, so each
			// change makes the part dirty and gets its own undo level.
			content: ( { blocks: edited = [] } ) => serialize( edited ),
		} );
		onPick?.( getPatternTitle( pattern ) );
	};

	return (
		<GlobalScope>
			<ul
				aria-label={ __( 'Layouts' ) }
				className="cnl-site-part__layouts"
			>
				{ orderedLayouts.map( ( pattern ) => (
					<LayoutCard
						isCurrent={ pattern.name === currentName }
						key={ pattern.name }
						onSelect={ select }
						pattern={ pattern }
						Preview={ Preview }
					/>
				) ) }
			</ul>
		</GlobalScope>
	);
}
