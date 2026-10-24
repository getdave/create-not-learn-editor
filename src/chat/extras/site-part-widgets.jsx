/**
 * The header and footer in the chat, as the Header and Footer screens offer
 * them: what can be changed about one, each a row leading to its picker, and
 * the site's social links, edited with the screens' own list. Loaded by the
 * chat on demand, through the chat-extras module, as they read the part
 * from the editor the way the screens do.
 */

/**
 * Internal dependencies
 */
import {
	useSitePart,
	useSitePartContents,
	useSitePartLayouts,
} from '../../routes/site-part/data';
import {
	getSocialLinksDescription,
	useSocialLinks,
} from '../../routes/site-part/social-links';
import { SocialLinks } from '../../routes/site-part/social-links-editor';
import {
	Icon,
	Spinner,
	Text,
	__,
	chevronLeftIcon,
	chevronRightIcon,
	compassIcon,
	isRTL,
	layoutIcon,
	shareIcon,
	siteLogoIcon,
	useEffect,
	useRef,
} from '../../wordpress-packages';

function Loading() {
	return (
		<div className="cnl-editor-spinner">
			<Spinner />
		</div>
	);
}

/**
 * What can be changed about the header or footer, as the Header and Footer
 * screens list it: its layout, the site's name and logo, the menu and the
 * social links, each only when the part shows it. Each row asks the chat
 * for it, as one of the chat's own choices would.
 *
 * @param {Object}   props
 * @param {string}   props.area     `header` or `footer`.
 * @param {Function} props.onChoose Called with what to ask the chat.
 * @return {Element} The rows.
 */
export function SitePartOptions( { area, onChoose } ) {
	const { clientId, id, isEditorReady } = useSitePart( area );
	const contents = useSitePartContents( clientId );
	const layouts = useSitePartLayouts( area, id );
	const social = useSocialLinks( area );
	const isHeader = area === 'header';

	if ( ! isEditorReady ) {
		return <Loading />;
	}

	if ( ! clientId ) {
		return (
			<Text className="routes-styles__muted" variant="body-md">
				{ isHeader
					? __( 'Your homepage doesn’t have a header.' )
					: __( 'Your homepage doesn’t have a footer.' ) }
			</Text>
		);
	}

	const options = [];

	if ( ! layouts.hasResolved || layouts.layouts.length ) {
		options.push( {
			description: isHeader
				? __( 'Pick another look for the top of every page.' )
				: __( 'Pick another look for the bottom of every page.' ),
			icon: layoutIcon,
			request: isHeader
				? __( 'Change my header layout' )
				: __( 'Change my footer layout' ),
			title: __( 'Change layout' ),
		} );
	}

	if ( contents.hasSiteTitle ) {
		options.push( {
			description: __( 'The name of your site.' ),
			icon: siteLogoIcon,
			request: __( 'Change my site title' ),
			title: __( 'Change site name' ),
		} );
	}

	if ( contents.hasLogo ) {
		options.push( {
			description: __( 'The picture beside your site’s name.' ),
			icon: siteLogoIcon,
			request: __( 'Change my logo' ),
			title: __( 'Change logo' ),
		} );
	}

	if ( contents.showsMenu ) {
		options.push( {
			description: __( 'The links to your pages.' ),
			icon: compassIcon,
			request: __( 'Edit my menu' ),
			title: __( 'Edit menu' ),
		} );
	}

	if ( contents.hasSocialLinks && social.links ) {
		options.push( {
			description: getSocialLinksDescription(
				social.links,
				social.services
			),
			icon: shareIcon,
			request: isHeader
				? __( 'Change the social links in my header' )
				: __( 'Change the social links in my footer' ),
			title: __( 'Social links' ),
		} );
	}

	if ( ! options.length ) {
		return (
			<Text className="routes-styles__muted" variant="body-md">
				{ isHeader
					? __(
							'Your header has no name, logo, menu or social links, and your theme offers no other layouts for it.'
						)
					: __(
							'Your footer has no name, logo, menu or social links, and your theme offers no other layouts for it.'
						) }
			</Text>
		);
	}

	return (
		<div className="cnl-chat-suggestions__groups">
			{ options.map( ( option ) => (
				<button
					className="cnl-chat-suggestions__group"
					key={ option.title }
					onClick={ () => onChoose( option.request ) }
					type="button"
				>
					<span
						aria-hidden
						className="cnl-chat-suggestions__group-icon"
					>
						<Icon icon={ option.icon } size={ 20 } />
					</span>
					<span className="cnl-chat-suggestions__group-text">
						<span className="cnl-chat-suggestions__group-label">
							{ option.title }
						</span>
						<span className="cnl-chat-suggestions__group-hint">
							{ option.description }
						</span>
					</span>
					<Icon
						className="cnl-chat-suggestions__group-chevron"
						icon={ isRTL() ? chevronLeftIcon : chevronRightIcon }
						size={ 20 }
					/>
				</button>
			) ) }
		</div>
	);
}

/**
 * The site's social links, edited with the Header and Footer screens' list.
 * Typing an address changes the site straight away, as there; the chat's
 * button keeps it.
 *
 * @param {Object}   props
 * @param {string}   props.area   `header` or `footer`.
 * @param {Function} props.onPick Called with what the links are now, once
 *                                they change.
 * @return {Element} The links.
 */
export function SocialLinksWidget( { area, onPick } ) {
	const { links, services } = useSocialLinks( area );
	const initialRef = useRef();
	const current = links ? JSON.stringify( links ) : null;

	if ( current && initialRef.current === undefined ) {
		initialRef.current = current;
	}

	useEffect( () => {
		if ( current && current !== initialRef.current ) {
			onPick( getSocialLinksDescription( links, services ) );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ current ] );

	return (
		<div className="cnl-chat-social-links">
			<SocialLinks area={ area } />
		</div>
	);
}
