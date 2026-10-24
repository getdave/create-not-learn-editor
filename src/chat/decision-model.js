/**
 * Asks a decision model, TypeSafe's Jev, which of the chat's pickers a
 * message asks for, when one is set up under Settings > Connectors.
 *
 * Jev can only pick from what it is shown, so it is shown the site's pages
 * and the open page's sections too, and picks which the message means at
 * the same time, as in "the photos bit on my About page looks too pale".
 * A section on a page that isn't open is only asked about once Jev has
 * picked that page, in a second request.
 *
 * It goes through this plugin's REST API, which keeps the API key on the
 * server, and only answers when Jev is sure. See
 * `includes/assistant-router.php`.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { parse } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { resolveSelect, select } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { namespace, settings } from '../settings';
import {
	getSectionSummary,
	getSectionTitle,
} from '../routes/content/pages/page-sections';
import {
	PAGES_QUERY,
	findTargetPage,
	getHomepageId,
	getPages,
} from './target-page';
import {
	getSectionIds,
	getSelectedSection,
	isEditingPage,
} from './target-section';

/**
 * A section as Jev is shown it, like "Our workshops: Columns · 3 images".
 *
 * @param {Object} block The section's block.
 * @return {string} What it is.
 */
function describeSection( block ) {
	const title = getSectionTitle( block );
	const summary = getSectionSummary( block );

	return summary && summary !== title ? `${ title }: ${ summary }` : title;
}

// Whitespace between blocks parses as an empty freeform block.
function isSomething( block ) {
	return block.name !== 'core/freeform' || block.originalContent?.trim();
}

/**
 * A page's top-level blocks as the editor has them once it opens the page:
 * a theme pattern a page refers to is replaced by the pattern's blocks, and
 * a pattern of one block takes the pattern's title as its name, as the
 * Pattern block does.
 *
 * @param {Object[]} blocks   Parsed blocks.
 * @param {Object[]} patterns The site's block patterns.
 * @return {Object[]} Its blocks, with patterns in place.
 */
function expandPatterns( blocks, patterns ) {
	return blocks.filter( isSomething ).flatMap( ( block ) => {
		const pattern =
			block.name === 'core/pattern' &&
			patterns.find( ( { name } ) => name === block.attributes.slug );

		if ( ! pattern ) {
			return [ block ];
		}

		const inner = parse( pattern.content ).filter( isSomething );

		if ( inner.length !== 1 || ! pattern.categories?.length ) {
			return inner;
		}

		const metadata = inner[ 0 ].attributes.metadata || {};

		return [
			{
				...inner[ 0 ],
				attributes: {
					...inner[ 0 ].attributes,
					metadata: {
						...metadata,
						name: metadata.name || pattern.title,
					},
				},
			},
		];
	} );
}

/**
 * The sections of a page that isn't open in the editor, from its content.
 *
 * @param {number} pageId The page.
 * @return {Promise<string[]>} Its sections, described, top to bottom.
 */
async function getPageSections( pageId ) {
	const [ patterns ] = await Promise.all( [
		resolveSelect( coreDataStore ).getBlockPatterns(),
		resolveSelect( coreDataStore ).getEntityRecord(
			'postType',
			'page',
			pageId
		),
	] );
	const page = select( coreDataStore ).getEditedEntityRecord(
		'postType',
		'page',
		pageId
	);
	const blocks =
		page?.blocks ||
		parse( typeof page?.content === 'string' ? page.content : '' );

	return expandPatterns( blocks, patterns || [] ).map( describeSection );
}

/**
 * The site's pages, which is open, and that page's sections as the editor
 * has them, for Jev to pick from.
 *
 * @return {Promise<Object>} `{ pages, sections, selectedSection }`.
 */
async function getPlaces() {
	await Promise.all( [
		resolveSelect( coreDataStore ).getEntityRecords(
			'postType',
			'page',
			PAGES_QUERY
		),
		resolveSelect( coreDataStore ).getEntityRecord( 'root', 'site' ),
	] );

	const open = findTargetPage();
	const homeId = getHomepageId( select );
	const pages = getPages()
		.filter( ( page ) => page.title )
		.map( ( { id, title } ) => ( {
			id,
			title,
			isHome: id === homeId,
			isOpen: id === open?.id,
		} ) );

	if ( ! isEditingPage( select, open?.id ) ) {
		return { pages, sections: [], selectedSection: null };
	}

	const sectionIds = getSectionIds( select );
	const selected = getSelectedSection( select, open.id );

	return {
		pages,
		sections: sectionIds.map( ( clientId ) =>
			describeSection( select( blockEditorStore ).getBlock( clientId ) )
		),
		selectedSection: selected ? sectionIds.indexOf( selected ) : null,
	};
}

/**
 * Ask Jev which section of a page that isn't open the message means.
 *
 * @param {string}   text         What was typed.
 * @param {Object[]} conversation The conversation before it.
 * @param {Object}   page         `{ id, title }`.
 * @return {Promise<?number>} The section's index, top first, or `null`.
 */
async function findSectionOnPage( text, conversation, page ) {
	const sections = await getPageSections( page.id );

	if ( ! sections.length ) {
		return null;
	}

	const { sectionIndex } = await apiFetch( {
		path: `/${ namespace }/assistant/route/section`,
		method: 'POST',
		data: { text, conversation, page: page.title, sections },
	} );

	return sectionIndex ?? null;
}

/**
 * Ask Jev what a message asks for.
 *
 * @param {string}   text                 What was typed.
 * @param {Object}   context              What it might refer to.
 * @param {Object[]} context.conversation The conversation before it, from
 *                                        `getRecentConversation()`.
 * @param {string}   context.picked       What was picked in the chat.
 * @return {Promise<?Object>} `{ skill, params }`, or `null` when there is
 *                            no decision model, or it isn't sure.
 */
export async function routeWithDecisionModel(
	text,
	{ conversation = [], picked = '' } = {}
) {
	if ( ! settings.assistantRouter ) {
		return null;
	}

	try {
		const { pages, sections, selectedSection } = await getPlaces();
		const route = await apiFetch( {
			path: `/${ namespace }/assistant/route`,
			method: 'POST',
			data: {
				text,
				conversation,
				picked,
				pages,
				sections,
				selectedSection,
			},
		} );

		if ( ! route?.skill ) {
			return null;
		}

		const params = { ...route.params };
		const page = pages.find( ( { id } ) => id === params.pageId );

		if ( page && ! page.isOpen ) {
			// Without it, the chat asks which section.
			const sectionIndex = await findSectionOnPage(
				text,
				conversation,
				page
			).catch( () => null );

			if ( sectionIndex !== null ) {
				params.sectionIndex = sectionIndex;
			}
		}

		return { skill: route.skill, params };
	} catch {
		// The language model can still answer.
		return null;
	}
}
