# Create Not Learn Editor

A standalone WordPress plugin that provides an experimental site editor using the Extensible Site Editor framework exposed by the released Gutenberg plugin.

## Requirements

- WordPress 7.0 or newer.
- PHP 7.4 or newer.
- Gutenberg plugin 23.5.1 or newer.

The plugin declares `Requires Plugins: gutenberg` and also checks `GUTENBERG_VERSION` at runtime because WordPress plugin dependencies do not support minimum dependency versions.

## Development

```sh
npm install
npm run build
npm run wp-env start
```

The local environment uses WordPress 7.0 and installs the released Gutenberg 23.5.1 zip. The plugin appears under Appearance > Create Not Learn and opens at `/wp-admin/admin.php?page=create-not-learn-editor`.

## Scripts

- `npm run dev` watches and rebuilds development assets.
- `npm run start` is an alias for the same watcher.
- `npm run build` builds production assets.
- `npm run lint:js` runs JavaScript linting.
- `npm run lint:css` runs stylesheet linting.
- `npm run plugin-zip` creates an installable plugin zip.
- `npm run wp-env` proxies to `wp-env`.

## First Slice

- Full-page boot shell mirroring Gutenberg's `site-editor-v2` experiment page setup.
- Boot-powered SPA shell using `@wordpress/boot`.
- Plugin-owned route modules for Home, Content, Edit, and New routes.
- Home route with preview and explicit setup action.
- Content route with public REST-backed post types.
- List and preview routes for supported post types.
- Existing content edit routes use the boot framework canvas.
- New content uses an embedded wp-admin editor bridge for the first slice.
- Explicit setup action creates or reuses Home, sets it as the static homepage, and creates a default navigation menu only after the user chooses it.
