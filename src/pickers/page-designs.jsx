/**
 * The page designs offered by "Add a page".
 *
 * Shared by the Add a page modal and the chat. Each caller passes the preview
 * component that works where it is, as with the section picker.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads it from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo, useRef } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	check as checkIcon,
	chevronLeft as chevronLeftIcon,
	chevronRight as chevronRightIcon,
} from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	EMPTY_ARRAY,
	getPageLayoutKinds,
	getPatternDescription,
	getPatternPreviewContent,
	getPatternTitle,
	isPageLayoutPattern,
} from '../routes/content/page-layouts';
import { usePreviewBlocks } from './preview-blocks';
import { PagePreviewLoading, useHasPreviewDrawn } from './preview-loading';

/**
 * The theme's whole-page designs, and the kinds of page it sorts them into.
 *
 * @return {Object} `{ isResolving, kinds, patterns }`.
 */
export function usePageLayoutPatterns() {
	const { categories, isResolving, patterns } = useSelect( ( select ) => {
		const store = select( coreDataStore );

		return {
			categories: store.getBlockPatternCategories?.() || EMPTY_ARRAY,
			isResolving: store.isResolving?.( 'getBlockPatterns' ) || false,
			patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
		};
	}, [] );

	return useMemo(
		() => ( {
			isResolving,
			kinds: getPageLayoutKinds( patterns, categories ),
			patterns: patterns.filter( isPageLayoutPattern ),
		} ),
		[ categories, isResolving, patterns ]
	);
}

/*
 * The whole card picks the design. The preview scrolls on its own, so the
 * layer over it that takes the click hands the wheel on to it, and the
 * preview still scrolls under the pointer.
 */
export function PageLayoutCard( {
	isSelected = false,
	onSelect,
	pageTemplateContent,
	pattern,
	Preview,
} ) {
	const scrollerRef = useRef();
	const previewContent = getPatternPreviewContent(
		pattern,
		pageTemplateContent
	);
	const previewBlocks = usePreviewBlocks( previewContent );
	const hasDrawn = useHasPreviewDrawn( scrollerRef );
	const title = getPatternTitle( pattern );
	const description = getPatternDescription( pattern );

	return (
		<div
			className={ `cnl-design-picker__card cnl-add-page-layout-card${
				isSelected ? ' is-selected' : ''
			}` }
			title={ description || undefined }
		>
			<div className="cnl-design-picker__preview cnl-add-page-layout-card__preview">
				<div
					className="cnl-add-page-layout-preview-page"
					ref={ scrollerRef }
				>
					{ previewContent && Preview && (
						<Preview
							blocks={ previewBlocks }
							description={ title }
						/>
					) }
				</div>
				{ ! hasDrawn && <PagePreviewLoading /> }
				<button
					aria-label={ sprintf(
						/* translators: %s: page design name. */
						__( 'Use the “%s” design' ),
						title
					) }
					aria-pressed={ isSelected || undefined }
					className="cnl-add-page-layout-card__pick"
					onClick={ () => onSelect( pattern ) }
					onWheel={ ( event ) => {
						scrollerRef.current?.scrollBy( {
							left: event.deltaX,
							top: event.deltaY,
						} );
					} }
					tabIndex={ -1 }
					type="button"
				/>
			</div>
			<div className="cnl-design-picker__card-footer">
				<span className="cnl-design-picker__name">{ title }</span>
				<button
					aria-pressed={ isSelected || undefined }
					className="cnl-design-picker__action"
					onClick={ () => onSelect( pattern ) }
					type="button"
				>
					{ isSelected ? __( 'Chosen' ) : __( 'Use design' ) }
					<Icon
						icon={
							// eslint-disable-next-line no-nested-ternary
							isSelected
								? checkIcon
								: document.documentElement.dir === 'rtl'
									? chevronLeftIcon
									: chevronRightIcon
						}
						size={ 16 }
					/>
				</button>
			</div>
		</div>
	);
}
