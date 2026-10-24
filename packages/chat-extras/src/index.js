/**
 * The chat's pickers that are too big to load with the page: they reach the
 * editor through `src/wordpress-packages`, which the chat, mounted from app
 * init, must not. The chat imports this module the first time it shows one.
 */
export { MenuWidget } from '../../../src/chat/extras/menu-widget';
export {
	SitePartOptions,
	SocialLinksWidget,
} from '../../../src/chat/extras/site-part-widgets';
