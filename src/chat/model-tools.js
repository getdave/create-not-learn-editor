/**
 * What a language model is told and offered when one answers the chat. See
 * `model.js`.
 *
 * Kept free of React and WordPress packages so it can be tested on its own.
 */

/*
 * Our own tools. Each shows the picker a skill shows, so the model decides
 * what to show and people still make the change by picking, as they do
 * without a model. Their names start with `cnl_`, which the system
 * instruction tells the model to prefer. See
 * `cnl_editor_agentic_editor_system_instruction()`.
 *
 * `page` adds a `page` input naming the page a skill works on, for skills
 * that otherwise use the page that is open.
 *
 * Adding a page or a section can show a design the model has written, from
 * the `WRITTEN_DESIGN` inputs, first among the theme's. See
 * `written-designs.js`. The tools with an `action` rather than a `skill`
 * only read, and the model carries on after them.
 */
const PAGE_INPUT = {
	type: 'string',
	description:
		'Title of the page to work on, only if the user named a page other than the one that is open.',
};

const WRITTEN_DESIGN = {
	based_on: {
		type: 'string',
		description:
			'Name of the design, from cnl_get_designs, that `content` rewrites.',
	},
	content: {
		type: 'string',
		description:
			'Block markup for a design written for the user: the content of the `based_on` design from cnl_get_design, with its words rewritten for what the user asked. Keep its blocks, attributes, class names and image URLs.',
	},
	design_name: {
		type: 'string',
		description:
			'A short name for the written design, like "Sock puppet shop".',
	},
};

export const MODEL_TOOLS = [
	{
		name: 'cnl_show_looks',
		skill: 'look',
		description:
			'Show the looks the theme comes with, each of which changes the colors, fonts and spacing of the whole site together, for the user to pick one.',
	},
	{
		name: 'cnl_show_colors',
		skill: 'colors',
		description:
			'Show the color palettes for the whole site, for the user to pick one.',
	},
	{
		name: 'cnl_show_fonts',
		skill: 'fonts',
		description:
			'Show the font pairings for the whole site, for the user to pick one.',
	},
	{
		name: 'cnl_set_site_title',
		skill: 'site-title',
		description:
			'Change the site title. Puts the new title in for the user to check and save, or asks for one.',
		properties: {
			name: {
				type: 'string',
				description: 'The new site title, if the user gave one.',
			},
		},
		getParams: ( { name } ) => ( { name: name || '' } ),
	},
	{
		name: 'cnl_show_logo',
		skill: 'logo',
		description:
			'Show the site logo, for the user to upload, replace or remove it.',
	},
	{
		name: 'cnl_show_header_layouts',
		skill: 'header',
		description:
			'Show the layouts for the header at the top of every page, for the user to pick one.',
	},
	{
		name: 'cnl_show_footer_layouts',
		skill: 'footer',
		description:
			'Show the layouts for the footer at the bottom of every page, for the user to pick one.',
	},
	{
		name: 'cnl_edit_menu',
		skill: 'menu',
		description:
			'Show the site menu, for the user to reorder, rename, add or remove its links.',
	},
	{
		name: 'cnl_add_page',
		skill: 'add-page',
		description:
			'Add a new page. Shows page designs that suit its title, for the user to pick one, or asks for a title. With `content`, shows the design written for the user first.',
		properties: {
			title: {
				type: 'string',
				description: 'Title of the new page, if the user gave one.',
			},
			...WRITTEN_DESIGN,
		},
		getParams: ( { title } ) => ( { title: title || '' } ),
	},
	{
		name: 'cnl_add_section',
		skill: 'add-section',
		description:
			'Add a section to a page. Shows section designs, for the user to pick one, which is added straight away. With `content`, shows the design written for the user first.',
		properties: {
			kind: {
				type: 'string',
				description:
					'What the section is for, like "testimonials" or "contact", if the user said.',
			},
			page: PAGE_INPUT,
			...WRITTEN_DESIGN,
		},
		getParams: ( { kind } ) => ( { search: kind || '' } ),
	},
	{
		name: 'cnl_change_section_design',
		skill: 'section-design',
		description:
			'Change the layout or colors of a section already on a page. Shows the choices for the section the user has selected, or asks which section.',
		properties: {
			focus: {
				type: 'string',
				enum: [ 'color', 'layout', 'both' ],
				description:
					'Whether the user asked about its colors, its layout, or neither in particular.',
			},
			page: PAGE_INPUT,
		},
		getParams: ( { focus } ) => ( {
			focus: [ 'color', 'layout' ].includes( focus ) ? focus : 'both',
		} ),
	},
	{
		name: 'cnl_get_designs',
		action: 'list-designs',
		description:
			'List the designs for a whole page or for a section, to choose one to rewrite for the user.',
		properties: {
			kind: {
				type: 'string',
				enum: [ 'page', 'section' ],
				description: 'Designs for a whole page, or for a section.',
			},
			search: {
				type: 'string',
				description:
					'Words for what the design is for, like "contact", to list designs that suit it first.',
			},
		},
	},
	{
		name: 'cnl_get_design',
		action: 'read-design',
		description:
			'Read the block markup of a design from cnl_get_designs, to rewrite its words for the user.',
		properties: {
			name: {
				type: 'string',
				description: 'Name of the design.',
			},
		},
	},
	{
		name: 'cnl_undo_last_change',
		skill: 'undo',
		description:
			'Undo the last change the user kept from a picker in this chat.',
	},
	{
		name: 'cnl_offer_to_close',
		skill: 'exit',
		description:
			'Offer to close the chat, when the user says they are done.',
	},
];

/**
 * @param {string} name Tool name.
 * @return {?Object} One of our tools, or `undefined`.
 */
export function getModelTool( name ) {
	return MODEL_TOOLS.find( ( tool ) => tool.name === name );
}

/**
 * Our tools, as the chat endpoint declares them to the model.
 *
 * @return {Object[]} `{ name, description, inputSchema }` items.
 */
export function getModelToolDeclarations() {
	return MODEL_TOOLS.map( ( { name, description, properties = {} } ) => ( {
		name,
		description,
		inputSchema: { type: 'object', properties },
	} ) );
}

/**
 * What a skill is asked for when the model calls our tool: its params, and
 * the request it reads a page's name from, as if the user had typed it.
 *
 * @param {Object} tool  One of our tools.
 * @param {Object} args  What the model called it with.
 * @param {string} typed What the user last typed.
 * @return {Object} `{ params, text }`.
 */
export function getSkillRequest( tool, args, typed ) {
	const input = args && typeof args === 'object' ? args : {};
	const page = typeof input.page === 'string' ? input.page.trim() : '';

	return {
		params: tool.getParams ? tool.getParams( input ) : {},
		text: page ? `${ typed } on the ${ page } page` : typed,
	};
}

/*
 * Script tags, embedding tags, inline event handlers and `javascript:` URLs,
 * as Agentic Editor's own chat looks for them. A call carrying any of them,
 * or a raw HTML block, isn't run: Agentic Editor asks first, and this chat
 * has nowhere to ask.
 */
const SCRIPT_LIKE =
	/<\s*(?:script|iframe|object|embed)\b|<[^>]*[\s/"']on[a-z]+\s*=|javascript\s*:/i;
const RAW_HTML_BLOCKS = [ 'core/html', 'core/freeform' ];

/**
 * @param {*}      value What a tool was called with, or part of it.
 * @param {number} depth How deep it is.
 * @return {boolean} Whether it carries markup that can run a script.
 */
export function carriesScript( value, depth = 0 ) {
	if ( depth > 64 ) {
		return true;
	}

	if ( typeof value === 'string' ) {
		return SCRIPT_LIKE.test( value );
	}

	if ( Array.isArray( value ) ) {
		return value.some( ( item ) => carriesScript( item, depth + 1 ) );
	}

	if ( value && typeof value === 'object' ) {
		if ( RAW_HTML_BLOCKS.includes( value.name ) ) {
			return true;
		}

		return Object.values( value ).some( ( item ) =>
			carriesScript( item, depth + 1 )
		);
	}

	return false;
}

/**
 * The conversation as the chat endpoint replays it to the model.
 *
 * A model's turn is replayed as it happened, from the `wire` it left on its
 * first message, so the model sees its own tool calls. Its other messages
 * are part of that and are skipped. Anything the chat said by itself, like
 * the reply to a choice or confirming a kept pick, is replayed as plain text
 * from the assistant, joined to the turn before it so the two sides keep
 * taking turns.
 *
 * @param {Object[]} messages The chat's messages.
 * @return {Object[]} Messages for the chat endpoint.
 */
export function buildHistory( messages ) {
	const history = [];

	const add = ( message ) => {
		const last = history[ history.length - 1 ];

		if ( last?.role === 'user' && message.role === 'user' ) {
			history[ history.length - 1 ] = {
				role: 'user',
				content: `${ last.content }\n\n${ message.content }`,
			};
			return;
		}

		if ( last?.role === 'assistant' && message.role === 'assistant' ) {
			history[ history.length - 1 ] = {
				role: 'assistant',
				parts: [ ...last.parts, ...message.parts ],
			};
			return;
		}

		history.push( message );
	};

	for ( const message of messages ) {
		if ( message.wire ) {
			message.wire.forEach( add );
		} else if ( message.fromModel || message.status === 'error' ) {
			continue;
		} else if ( message.role === 'user' && message.text ) {
			add( { role: 'user', content: message.text } );
		} else if ( message.role === 'assistant' && message.text ) {
			add( { role: 'assistant', parts: [ { text: message.text } ] } );
		}
	}

	return history;
}
