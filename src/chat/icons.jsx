/**
 * The chat's own icon, which `@wordpress/icons` has nothing for. Drawn on the
 * same 24px grid.
 */

const SVG_PROPS = {
	viewBox: '0 0 24 24',
	xmlns: 'http://www.w3.org/2000/svg',
};

// Two four-pointed sparkles, the usual sign of an assistant.
export const sparkleIcon = (
	<svg { ...SVG_PROPS } fill="currentColor">
		<path d="M10 3.5c.3 0 .6.2.7.5l1.1 3.3c.4 1.2 1.3 2.1 2.5 2.5l3.3 1.1c.3.1.5.4.5.7s-.2.6-.5.7l-3.3 1.1c-1.2.4-2.1 1.3-2.5 2.5L10.7 19c-.1.3-.4.5-.7.5s-.6-.2-.7-.5l-1.1-3.3c-.4-1.2-1.3-2.1-2.5-2.5L2.4 12.1c-.3-.1-.5-.4-.5-.7s.2-.6.5-.7l3.3-1.1c1.2-.4 2.1-1.3 2.5-2.5L9.3 4c.1-.3.4-.5.7-.5z" />
		<path d="M18 2c.2 0 .4.1.5.3l.4 1.1c.1.4.4.7.8.8l1.1.4c.2.1.3.3.3.5s-.1.4-.3.5l-1.1.4c-.4.1-.7.4-.8.8l-.4 1.1c-.1.2-.3.3-.5.3s-.4-.1-.5-.3l-.4-1.1c-.1-.4-.4-.7-.8-.8l-1.1-.4c-.2-.1-.3-.3-.3-.5s.1-.4.3-.5l1.1-.4c.4-.1.7-.4.8-.8l.4-1.1c.1-.2.3-.3.5-.3z" />
	</svg>
);
