/**
 * Internal dependencies
 */
import {
	blockEditorStore,
	Button,
	createBlock,
	el,
	plusIcon,
	useDispatch,
	__,
	useSelect,
} from '../../wordpress-packages';

export default function NavigationListViewAppender( {
	blockCount,
	clientId,
	descriptionId,
	forwardedRef,
	setInsertedBlock,
	...props
} ) {
	const rootClientId = clientId || '';
	const { replaceInnerBlocks } = useDispatch( blockEditorStore );
	const blocks = useSelect(
		( select ) => select( blockEditorStore ).getBlocks( rootClientId ),
		[ rootClientId ]
	);
	const label = clientId
		? __( 'Add submenu link' )
		: __( 'Add link to menu' );

	return el( Button, {
		...props,
		'aria-describedby': descriptionId,
		'aria-label': label,
		className: 'routes-navigation-edit-list-view__appender',
		icon: plusIcon,
		onClick: () => {
			const newLink = createBlock( 'core/navigation-link', {
				label: '',
				url: '',
			} );
			const nextBlocks = [ ...blocks ];

			nextBlocks.splice( blockCount, 0, newLink );
			replaceInnerBlocks( rootClientId, nextBlocks, false );
			setInsertedBlock( newLink );
		},
		ref: forwardedRef,
		size: 'small',
		variant: 'tertiary',
	} );
}
