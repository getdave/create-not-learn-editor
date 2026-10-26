/**
 * Said the first time Manage all posts is clicked, on a section's Manage
 * posts menu, as it leaves the page for another screen: what posts are,
 * that the section lists them by itself, so they aren't written on the
 * page, and that the page's changes are kept. Going on to the posts' screen
 * means it has been read, so it isn't said again; Stay here, Escape or a
 * click outside leaves it to be said next time.
 */

/**
 * WordPress dependencies
 */
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	Modal,
	sprintf,
	useDispatch,
	useSelect,
} from '../../wordpress-packages';

const PREFERENCES_SCOPE = 'create-not-learn-editor';
const PREFERENCE_NAME = 'postsScreenExplained';

/**
 * @return {boolean} Whether the notice has been read.
 */
export function useHasReadPostsNotice() {
	return useSelect(
		( select ) =>
			Boolean(
				select( preferencesStore ).get(
					PREFERENCES_SCOPE,
					PREFERENCE_NAME
				)
			),
		[]
	);
}

/**
 * What the posts are and why the section brings them up, in words that
 * don't expect anyone to know WordPress: "posts" isn't an everyday word, so
 * it is explained before anything is said about them. Another type, like a
 * shop's products, is a word people know, and is only said to be listed.
 *
 * @param {string} type  The post type's name.
 * @param {string} label Its plural name, like Products.
 * @return {string[]} The notice's paragraphs.
 */
function getExplanation( type, label ) {
	if ( type === 'post' ) {
		return [
			__(
				'Posts are the news, stories and updates you publish over time, like the entries in a blog. Each one gets its own page on your site.'
			),
			__(
				'Your posts show up in this section by themselves, so there’s nothing to type here. To write a post or change one, go to Posts.'
			),
		];
	}

	return [
		sprintf(
			/* translators: 1: the posts' plural name, lowercase, like products. 2: their screen's name, like Products. */
			__(
				'Your %1$s show up in this section by themselves, so there’s nothing to type here. To add or change them, go to %2$s.'
			),
			label.toLowerCase(),
			label
		),
	];
}

/**
 * @param {Object}   props
 * @param {string}   props.type     The post type's name, like post.
 * @param {string}   props.label    Its plural name, like Posts, as its
 *                                  screen is titled.
 * @param {Function} props.onGo     Goes to the posts' screen.
 * @param {Function} props.onCancel Stays on the page.
 * @return {Element} The notice.
 */
export function PostsNotice( { label, onCancel, onGo, type } ) {
	const { set } = useDispatch( preferencesStore );

	return (
		<Modal
			className="cnl-section-modes__posts-notice"
			onRequestClose={ onCancel }
			size="small"
			title={ sprintf(
				/* translators: %s: the posts' plural name, lowercase, like posts. */
				__( 'This section shows your %s' ),
				label.toLowerCase()
			) }
		>
			{ getExplanation( type, label ).map( ( text ) => (
				<p key={ text }>{ text }</p>
			) ) }
			<p>
				{ sprintf(
					/* translators: %s: the posts' screen's name, like Posts. */
					__(
						'Your changes to this page are kept, and you can come back to it from %s.'
					),
					label
				) }
			</p>
			<div className="cnl-section-modes__posts-notice-actions">
				<Button onClick={ onCancel } variant="secondary">
					{ __( 'Stay here' ) }
				</Button>
				<Button
					onClick={ () => {
						set( PREFERENCES_SCOPE, PREFERENCE_NAME, true );
						onGo();
					} }
					variant="primary"
				>
					{ sprintf(
						/* translators: %s: the posts' screen's name, like Posts. */
						__( 'Go to %s' ),
						label
					) }
				</Button>
			</div>
		</Modal>
	);
}
