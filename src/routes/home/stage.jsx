/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import ScreenLinks from '../../screen-links';
import { MODE_EDIT, setCanvasMode } from '../../site-canvas/mode';
import { FROM_SITE_SEARCH } from '../../site-trail';
import {
	Link,
	Stack,
	Text,
	__,
	brushIcon,
	coreDataStore,
	decodeEntities,
	footerIcon,
	headerIcon,
	homeIcon,
	pagesIcon,
	siteLogoIcon,
	useSelect,
} from '../../wordpress-packages';

/*
 * Places to start working on the site. People don't build a site in any set
 * order, so these are offered as equal choices rather than numbered steps,
 * and nothing is marked done. Each screen's breadcrumbs lead back here.
 */
function getStartLinks() {
	return [
		{
			description: __( 'Make the first page visitors see your own.' ),
			icon: homeIcon,
			// The homepage opened up on the Pages screen, where what it shows,
			// its sections and its layout all live. `home` stands for it there
			// (`HOMEPAGE` in the Pages screen), whatever it shows.
			onSelect: () => setCanvasMode( MODE_EDIT ),
			search: { postId: 'home', previewId: 'home', ...FROM_SITE_SEARCH },
			title: __( 'Your homepage' ),
			to: '/types/page/list/all',
		},
		{
			description: __( 'Add pages like About and Contact.' ),
			icon: pagesIcon,
			search: FROM_SITE_SEARCH,
			title: __( 'Pages & menu' ),
			to: '/types/page/list/default',
		},
		{
			description: __( 'Name your site and add a logo.' ),
			icon: siteLogoIcon,
			search: FROM_SITE_SEARCH,
			title: __( 'Name & logo' ),
			to: '/design/identity',
		},
		{
			// Design leads with whole-site looks and links on to Colors and
			// Fonts, so one row covers both without adding to the choices here.
			description: __( 'Pick the look of your whole site.' ),
			icon: brushIcon,
			search: FROM_SITE_SEARCH,
			title: __( 'Colors & fonts' ),
			to: '/design',
		},
		{
			description: __( 'Choose how the top of every page looks.' ),
			icon: headerIcon,
			search: FROM_SITE_SEARCH,
			title: __( 'Header' ),
			to: '/design/header',
		},
		{
			description: __( 'Choose how the bottom of every page looks.' ),
			icon: footerIcon,
			search: FROM_SITE_SEARCH,
			title: __( 'Footer' ),
			to: '/design/footer',
		},
	];
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
					'Tip: follow links on the page to visit the rest of your site. Switch to Edit to change what is on it, or Compose to add and arrange its sections.'
				) }
			</Text>
		</div>
	);
}
