/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import ScreenLinks from '../../screen-links';
import { getStartPlaces } from '../../start-places';
import { MODE_EDIT, setCanvasMode } from '../../site-canvas/mode';
import { FROM_SITE_SEARCH } from '../../site-trail';
import {
	Link,
	Stack,
	Text,
	__,
	coreDataStore,
	decodeEntities,
	useSelect,
} from '../../wordpress-packages';

/*
 * Where each place to start opens. People don't build a site in any set
 * order, so the places are offered as equal choices rather than numbered
 * steps, and nothing is marked done. Each screen's breadcrumbs lead back here.
 */
const START_ROUTES = {
	home: {
		// The homepage opened up on the Pages screen, where what it shows,
		// its sections and its layout all live. `home` stands for it there
		// (`HOMEPAGE` in the Pages screen), whatever it shows.
		onSelect: () => setCanvasMode( MODE_EDIT ),
		search: { postId: 'home', previewId: 'home', ...FROM_SITE_SEARCH },
		to: '/types/page/list/all',
	},
	pages: { to: '/types/page/list/default' },
	identity: { to: '/design/identity' },
	style: { to: '/design' },
	header: { to: '/design/header' },
	footer: { to: '/design/footer' },
};

function getStartLinks() {
	return getStartPlaces().map( ( place ) => ( {
		...place,
		search: FROM_SITE_SEARCH,
		...START_ROUTES[ place.id ],
	} ) );
}

export default function Stage() {
	const siteTitle = useSelect(
		( select ) =>
			select( coreDataStore ).getEntityRecord( 'root', 'site' )?.title,
		[]
	);
	const siteName = decodeEntities( siteTitle || settings.siteName || '' );

	return (
		<div className="cnl-editor-stage cnl-site-hub">
			<Stack direction="column" gap="xs">
				<Text render={ <h1 /> } variant="heading-lg">
					{ __( 'Your site' ) }
				</Text>
				<Text className="cnl-site-hub__meta" variant="body-sm">
					{ siteName || __( 'Untitled site' ) }
					{ settings.homeUrl && ' · ' }
					{ settings.homeUrl && (
						<Link href={ settings.homeUrl } openInNewTab>
							{ __( 'View site' ) }
						</Link>
					) }
				</Text>
			</Stack>
			<Stack direction="column" gap="sm">
				<Text render={ <h2 /> } variant="heading-sm">
					{ __( 'Where do you want to start?' ) }
				</Text>
				<ScreenLinks
					label={ __( 'Start working on your site' ) }
					links={ getStartLinks() }
				/>
			</Stack>
			<Text className="cnl-site-hub__hint" variant="body-sm">
				{ __(
					'Tip: follow links on the page to visit the rest of your site. Switch to Edit to change what is on it, then zoom out to add and arrange its sections.'
				) }
			</Text>
		</div>
	);
}
