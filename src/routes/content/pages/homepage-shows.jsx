/**
 * The homepage's choice of what visitors see first.
 */

/**
 * Internal dependencies
 */
import {
	__,
	checkIcon,
	coreDataStore,
	Icon,
	memo,
	pageIcon,
	postListIcon,
	Stack,
	Text,
	useDispatch,
	useSelect,
} from '../../../wordpress-packages';

function getHomepageOptions() {
	return [
		{
			description: __( 'The sections you add below' ),
			icon: pageIcon,
			label: __( 'This page' ),
			value: 'page',
		},
		{
			description: __( 'Your newest blog posts, newest first' ),
			icon: postListIcon,
			label: __( 'Your latest posts' ),
			value: 'posts',
		},
	];
}

/**
 * What visitors see first: this page, or the latest posts. It is WordPress's
 * Reading setting, kept on the homepage itself so the choice sits where it
 * takes effect. Like the layout, it is saved with the rest of the changes.
 *
 * @return {Element} The homepage choice.
 */
function HomepageShows() {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const showOnFront = useSelect(
		( selectStore ) =>
			selectStore( coreDataStore ).getEditedEntityRecord( 'root', 'site' )
				?.show_on_front,
		[]
	);

	return (
		<section
			aria-label={ __( 'Your homepage shows' ) }
			className="cnl-homepage-shows"
		>
			<Stack direction="column" gap="xs">
				<h3 className="cnl-page-sections__title">
					{ __( 'Your homepage shows' ) }
				</h3>
				<Text className="cnl-page-sections__hint" variant="body-sm">
					{ __( 'What visitors see first when they arrive.' ) }
				</Text>
			</Stack>
			<ul className="cnl-homepage-shows__options" role="list">
				{ getHomepageOptions().map( ( option ) => {
					const isSelected = showOnFront === option.value;

					return (
						<li key={ option.value }>
							<button
								aria-pressed={ isSelected }
								className="cnl-homepage-shows__option"
								onClick={ () =>
									editEntityRecord(
										'root',
										'site',
										undefined,
										{
											show_on_front: option.value,
										}
									)
								}
								type="button"
							>
								<Icon
									className="cnl-homepage-shows__icon"
									icon={ option.icon }
								/>
								<span className="cnl-homepage-shows__text">
									<span className="cnl-homepage-shows__label">
										{ option.label }
									</span>
									<span className="cnl-homepage-shows__description">
										{ option.description }
									</span>
								</span>
								{ isSelected && (
									<Icon
										className="cnl-homepage-shows__check"
										icon={ checkIcon }
										size={ 20 }
									/>
								) }
							</button>
						</li>
					);
				} ) }
			</ul>
		</section>
	);
}

export const MemoizedHomepageShows = memo( HomepageShows );
