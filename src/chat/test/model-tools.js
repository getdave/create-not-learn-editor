/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	MODEL_TOOLS,
	buildHistory,
	carriesScript,
	getModelTool,
	getModelToolDeclarations,
	getSkillRequest,
} from '../model-tools';

describe( 'getModelToolDeclarations', () => {
	test( 'declares every tool with an object schema', () => {
		const declarations = getModelToolDeclarations();

		expect( declarations ).toHaveLength( MODEL_TOOLS.length );
		declarations.forEach( ( declaration ) => {
			expect( declaration.name ).toMatch( /^cnl_[a-z_]+$/ );
			expect( declaration.description ).toBeTruthy();
			expect( declaration.inputSchema.type ).toBe( 'object' );
		} );
	} );
} );

describe( 'getSkillRequest', () => {
	test( 'passes the inputs a skill reads as its params', () => {
		expect(
			getSkillRequest(
				getModelTool( 'cnl_add_section' ),
				{ kind: 'testimonials' },
				'add some reviews'
			)
		).toEqual( {
			params: { search: 'testimonials' },
			text: 'add some reviews',
		} );
	} );

	test( 'names the page in the request, for the skill to find', () => {
		expect(
			getSkillRequest(
				getModelTool( 'cnl_change_section_design' ),
				{ focus: 'color', page: 'About' },
				'make it darker'
			)
		).toEqual( {
			params: { focus: 'color' },
			text: 'make it darker on the About page',
		} );
	} );

	test( 'falls back when the model leaves inputs out or makes them up', () => {
		expect(
			getSkillRequest(
				getModelTool( 'cnl_change_section_design' ),
				{ focus: 'shape' },
				'change it'
			).params
		).toEqual( { focus: 'both' } );
		expect(
			getSkillRequest( getModelTool( 'cnl_set_site_title' ), null, 'x' )
				.params
		).toEqual( { name: '' } );
	} );
} );

describe( 'carriesScript', () => {
	test.each( [
		[ '<script>alert(1)</script>' ],
		[ { content: '<img src=x onerror=alert(1)>' } ],
		[ { url: 'javascript:alert(1)' } ],
		[ { blocks: [ { name: 'core/html', attributes: {} } ] } ],
	] )( 'finds script in %j', ( args ) => {
		expect( carriesScript( args ) ).toBe( true );
	} );

	test( 'lets ordinary content through', () => {
		expect(
			carriesScript( {
				name: 'core/paragraph',
				attributes: {
					content: 'We are <strong>open</strong> on Sundays.',
				},
			} )
		).toBe( false );
	} );
} );

describe( 'buildHistory', () => {
	test( 'replays scripted replies as the assistant’s words', () => {
		expect(
			buildHistory( [
				{ role: 'user', text: 'Change my colors' },
				{ role: 'assistant', text: 'Here are the palettes.' },
				{ role: 'assistant', text: 'Done. Your site uses “Dusk”.' },
				{ role: 'user', text: 'Now make the header bigger' },
			] )
		).toEqual( [
			{ role: 'user', content: 'Change my colors' },
			{
				role: 'assistant',
				parts: [
					{ text: 'Here are the palettes.' },
					{ text: 'Done. Your site uses “Dusk”.' },
				],
			},
			{ role: 'user', content: 'Now make the header bigger' },
		] );
	} );

	test( 'replays a model’s turn from its wire, once', () => {
		const wire = [
			{
				role: 'assistant',
				parts: [
					{ functionCall: { id: '1', name: 'cnl_show_fonts' } },
				],
			},
			{
				role: 'tool',
				responses: [ { id: '1', name: 'cnl_show_fonts' } ],
			},
			{ role: 'assistant', parts: [ { text: 'Here are the fonts.' } ] },
		];

		expect(
			buildHistory( [
				{ role: 'user', text: 'Different fonts please' },
				{ fromModel: true, role: 'assistant', text: 'Sure.', wire },
				{
					fromModel: true,
					role: 'assistant',
					text: 'Here are the fonts.',
				},
				{ role: 'assistant', text: 'Done. Your site uses “Serif”.' },
				{ role: 'user', text: 'Thanks' },
			] )
		).toEqual( [
			{ role: 'user', content: 'Different fonts please' },
			wire[ 0 ],
			wire[ 1 ],
			{
				role: 'assistant',
				parts: [
					{ text: 'Here are the fonts.' },
					{ text: 'Done. Your site uses “Serif”.' },
				],
			},
			{ role: 'user', content: 'Thanks' },
		] );
	} );

	test( 'joins messages either side of a failed answer', () => {
		expect(
			buildHistory( [
				{ role: 'user', text: 'Hello' },
				{ fromModel: true, role: 'assistant', status: 'error' },
				{ role: 'user', text: 'Hello?' },
			] )
		).toEqual( [ { role: 'user', content: 'Hello\n\nHello?' } ] );
	} );
} );
