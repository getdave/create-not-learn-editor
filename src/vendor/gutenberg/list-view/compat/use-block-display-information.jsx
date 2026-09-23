import { __ } from '@wordpress/i18n';

export { useBlockDisplayInformation as default } from '@wordpress/block-editor';
export { useBlockDisplayInformation } from '@wordpress/block-editor';

export function getPositionTypeLabel( attributes ) {
	const positionType = attributes?.style?.position?.type;

	if ( positionType === 'sticky' ) {
		return __( 'Sticky' );
	}

	if ( positionType === 'fixed' ) {
		return __( 'Fixed' );
	}

	return null;
}
