/**
 * Talks to the WordPress REST API as the logged-in admin, to set up what a
 * test needs and check what it saved without going through the UI.
 *
 * Anything made with a `create*` method is deleted again when the test ends.
 */
class RestClient {
	/**
	 * @param {import('@playwright/test').APIRequestContext} request
	 */
	constructor( request ) {
		this.request = request;
		this.cleanups = [];
	}

	async getNonce() {
		if ( ! this.nonce ) {
			const response = await this.request.get(
				'/wp-admin/admin-ajax.php?action=rest-nonce'
			);
			this.nonce = ( await response.text() ).trim();

			if ( ! response.ok() || this.nonce === '0' ) {
				throw new Error(
					'Unable to get a REST nonce. Is the session logged in?'
				);
			}
		}

		return this.nonce;
	}

	/**
	 * @param {string} path             Path under `/wp-json`.
	 * @param {Object} [options]
	 * @param {string} [options.method] HTTP method.
	 * @param {Object} [options.data]   JSON body.
	 * @param {Object} [options.params] Query parameters.
	 * @return {Promise<any>} The decoded response.
	 */
	async fetch( path, { method = 'GET', data, params } = {} ) {
		const response = await this.request.fetch( `/wp-json${ path }`, {
			data,
			headers: { 'X-WP-Nonce': await this.getNonce() },
			method,
			params,
		} );

		if ( ! response.ok() ) {
			throw new Error(
				`${ method } ${ path } failed (${ response.status() }): ${ await response.text() }`
			);
		}

		return response.json();
	}

	/**
	 * Run something when the test ends, such as putting back a setting.
	 *
	 * @param {Function} cleanup Async function to run.
	 */
	onCleanup( cleanup ) {
		this.cleanups.push( cleanup );
	}

	/**
	 * Delete a record when the test ends.
	 *
	 * @param {string} path The record's REST path.
	 */
	deleteLater( path ) {
		this.onCleanup( () =>
			this.fetch( path, { method: 'DELETE', params: { force: true } } )
		);
	}

	async cleanup() {
		for ( const cleanup of this.cleanups.reverse() ) {
			// Tests may have deleted the record themselves.
			await cleanup().catch( () => {} );
		}
		this.cleanups = [];
	}

	/**
	 * Make a page holding a paragraph, published unless told otherwise.
	 *
	 * @param {Object} [options]
	 * @param {string} [options.status]  Page status.
	 * @param {string} [options.title]   Page title.
	 * @param {string} [options.body]    Text of its paragraph.
	 * @param {string} [options.content] Block markup, used instead of `body`.
	 * @return {Promise<Object>} The page's `id`, `link`, `title` and `body`.
	 */
	async createPage( options = {} ) {
		const timestamp = Date.now();
		const title = options.title || `Test page ${ timestamp }`;
		const body = options.body || `Test page body ${ timestamp }`;
		const content =
			options.content ||
			`<!-- wp:paragraph --><p>${ body }</p><!-- /wp:paragraph -->`;
		const page = await this.fetch( '/wp/v2/pages', {
			data: { content, status: options.status || 'publish', title },
			method: 'POST',
		} );

		this.deleteLater( `/wp/v2/pages/${ page.id }` );

		return { body, id: page.id, link: page.link, title };
	}

	/**
	 * Make a blog post, published, from block markup.
	 *
	 * @param {Object} options
	 * @param {string} options.content Block markup.
	 * @param {string} [options.title] Post title.
	 * @return {Promise<Object>} The post's `id`, `link` and `title`.
	 */
	async createPost( { content, title = `Test post ${ Date.now() }` } ) {
		const post = await this.fetch( '/wp/v2/posts', {
			data: { content, status: 'publish', title },
			method: 'POST',
		} );

		this.deleteLater( `/wp/v2/posts/${ post.id }` );

		return { id: post.id, link: post.link, title };
	}

	/**
	 * Make a synced pattern, which the editor calls a section.
	 *
	 * @return {Promise<Object>} The pattern's `id`, `title` and `body`.
	 */
	async createPattern() {
		const timestamp = Date.now();
		const title = `Test section ${ timestamp }`;
		const body = `Test section body ${ timestamp }`;
		const pattern = await this.fetch( '/wp/v2/blocks', {
			data: {
				content: `<!-- wp:paragraph --><p>${ body }</p><!-- /wp:paragraph -->`,
				status: 'publish',
				title,
			},
			method: 'POST',
		} );

		this.deleteLater( `/wp/v2/blocks/${ pattern.id }` );

		return { body, id: pattern.id, title };
	}

	/**
	 * Make a navigation menu that is not shown anywhere on the site.
	 *
	 * A navigation block without a menu of its own shows the most recently
	 * published menu, and the theme's header has one. The menu is backdated
	 * so it doesn't take over the header while the test runs.
	 *
	 * @param {Object} [options]
	 * @param {string} [options.title]   Menu name.
	 * @param {string} [options.content] Block markup. Defaults to an automatic
	 *                                   list of every page.
	 * @return {Promise<Object>} The menu's `id` and `title`.
	 */
	async createNavigationMenu( options = {} ) {
		const title = options.title || `Test menu ${ Date.now() }`;
		const menu = await this.fetch( '/wp/v2/navigation', {
			data: {
				content: options.content ?? '<!-- wp:page-list /-->',
				date: '2001-01-01T00:00:00',
				status: 'publish',
				title,
			},
			method: 'POST',
		} );

		this.deleteLater( `/wp/v2/navigation/${ menu.id }` );

		return { id: menu.id, title };
	}

	/**
	 * The menu in the site's header: the one a header navigation block points
	 * at, or else the newest menu, which a navigation block without one shows.
	 *
	 * @return {Promise<number>} The menu's ID.
	 */
	async getMainMenuId() {
		const parts = await this.getNavigationTemplateParts();
		const header =
			parts.find( ( part ) => /header/i.test( part.title ) ) ||
			parts[ 0 ];
		const ref = header?.content.match( /"ref":(\d+)/ );

		if ( ref ) {
			return Number( ref[ 1 ] );
		}

		const [ newest ] = await this.fetch( '/wp/v2/navigation', {
			params: { _fields: 'id', order: 'desc', orderby: 'date' },
		} );

		return newest.id;
	}

	/**
	 * Template parts holding a navigation block, with their saved content.
	 *
	 * @return {Promise<Array<Object>>} Their `id`, `title` and `content`.
	 */
	async getNavigationTemplateParts() {
		const parts = await this.fetch( '/wp/v2/template-parts', {
			params: {
				_fields: 'id,title,content',
				context: 'edit',
				per_page: 100,
			},
		} );

		return parts
			.map( ( part ) => ( {
				content: part.content?.raw ?? part.content ?? '',
				id: part.id,
				title: part.title?.raw ?? part.title?.rendered ?? '',
			} ) )
			.filter( ( part ) => part.content.includes( 'wp:navigation' ) );
	}
}

module.exports = { RestClient };
