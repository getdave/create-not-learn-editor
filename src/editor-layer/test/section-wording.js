/**
 * WordPress dependencies
 */
import { __, _x } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { enableSectionWording, getSectionWording } from '../section-wording';

describe( 'getSectionWording', () => {
	it( 'says sections for patterns', () => {
		expect( getSectionWording( 'Patterns' ) ).toBe( 'Sections' );
		expect( getSectionWording( 'Edit pattern' ) ).toBe( 'Edit section' );
	} );

	it( 'matches strings with a context only in that context', () => {
		expect( getSectionWording( 'Pattern', 'block title' ) ).toBe(
			'Section'
		);
		expect( getSectionWording( 'Pattern', 'something else' ) ).toBe(
			undefined
		);
	} );

	it( 'keeps core wording it does not know', () => {
		expect( getSectionWording( 'Pattern Directory' ) ).toBe( undefined );
		expect( getSectionWording( 'constructor' ) ).toBe( undefined );
	} );
} );

describe( 'enableSectionWording', () => {
	it( 'swaps core wording until it is stopped', () => {
		expect( __( 'Patterns' ) ).toBe( 'Patterns' );

		const stop = enableSectionWording();

		expect( __( 'Patterns' ) ).toBe( 'Sections' );
		expect(
			_x( 'Add pattern', 'Generic label for pattern inserter button' )
		).toBe( 'Add section' );

		stop();

		expect( __( 'Patterns' ) ).toBe( 'Patterns' );
	} );

	it( 'leaves other text domains alone', () => {
		const stop = enableSectionWording();

		expect( __( 'Patterns', 'some-plugin' ) ).toBe( 'Patterns' );

		stop();
	} );
} );
