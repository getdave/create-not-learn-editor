# Create Not Learn Editor

Create Not Learn Editor is a standalone WordPress plugin that experiments with a focused, extensible site-editing experience.

The plugin is intentionally not part of the Gutenberg repository. It consumes released WordPress and Gutenberg packages, declares the released Gutenberg plugin as a WordPress plugin dependency, and can be installed like a normal plugin.

## Why This Exists

WordPress core and Gutenberg are moving toward a more extensible Site Editor architecture. Gutenberg currently includes an experimental full-page editor at:

```text
/wp-admin/admin.php?page=site-editor-v2
```

This project mirrors that experiment from the outside, as a plugin. The goal is to learn what can be built by composing the public packages and runtime exposed by the released Gutenberg plugin, without requiring a Gutenberg checkout, patch, submodule, or custom core build.

That matters because a standalone plugin is easier to install, evaluate, ship, and iterate on. It also keeps the experiment honest: if the editor cannot be built from released packages and plugin APIs, that is useful information.

## What It Does Today

The first slice provides a full-page editor shell under:

```text
/wp-admin/admin.php?page=create-not-learn-editor
```

The editor appears in the WordPress admin menu at:

```text
Appearance > Create Not Learn
```

The shell mirrors Gutenberg's `site-editor-v2` experiment setup:

- It registers a hidden admin page.
- It intercepts `admin_init` and renders a standalone full-page HTML document.
- It avoids the normal wp-admin wrapper, sidebar, and footer.
- It uses the Gutenberg `@wordpress/boot` package for the editor frame.
- It uses `@wordpress/route` route modules for navigation.
- It imports WordPress packages from `@wordpress/*` modules and relies on generated asset metadata for runtime dependencies.
- It preserves extension points for route, menu, and boot dependency registration.

The current routes are:

- `/` for the Home route.
- `/types/$type` for a content type landing route.
- `/types/$type/list/$view` for content lists.
- `/types/$type/edit/$id` for editing existing content.
- `/types/$type/new` for creating new content.

Home and Content currently include visible placeholder canvases. They are deliberately simple surfaces so the boot frame, routing, menu, and content list behavior can be developed before replacing the placeholders with richer previews.

## Site Mutations Are Explicit

The editor does not automatically create pages, navigation, or homepage settings when it loads.

The setup behavior is behind an explicit action:

```text
POST /wp-json/create-not-learn-editor/v1/setup-defaults
```

That action creates or reuses a Home page, sets it as the static homepage, and ensures a basic Navigation menu exists. It is intended to be idempotent.

## Requirements

- WordPress 7.0 or newer.
- PHP 7.4 or newer.
- Gutenberg plugin 23.5.1 or newer.

The plugin header declares:

```text
Requires Plugins: gutenberg
```

WordPress plugin dependencies do not support minimum dependency versions, so the plugin also checks `GUTENBERG_VERSION >= 23.5.1` at runtime. If Gutenberg is missing or too old, the editor page is not registered and an admin notice is shown.

## Development

Install dependencies:

```sh
npm install
```

Start the local WordPress environment:

```sh
WP_ENV_PORT="<dev-port>" WP_ENV_TESTS_PORT="<test-port>" npm run wp-env start
```

Use available non-default local ports for `WP_ENV_PORT` and `WP_ENV_TESTS_PORT`.

The local environment uses WordPress 7.0 and installs Gutenberg 23.5.1 from the released plugin zip.

Run the development build watcher:

```sh
npm run dev
```

Create production assets:

```sh
npm run build
```

Create an installable plugin zip:

```sh
npm run plugin-zip
```

Generated `build/` assets and plugin zips are intentionally ignored by git. The source repo is the canonical state; build artifacts are generated when needed.

## Scripts

- `npm run dev` watches and rebuilds development assets.
- `npm run start` is an alias for the same watcher.
- `npm run build` builds production assets.
- `npm run lint:js` runs JavaScript linting.
- `npm run lint:css` runs stylesheet linting.
- `npm run plugin-zip` creates an installable plugin zip.
- `npm run wp-env` proxies to `wp-env`.

## Verification

Before handing off functional changes, run:

```sh
npm run build
npm run lint:js
npm run lint:css
find . -path ./node_modules -prune -o -path ./build -prune -o -name '*.php' -print | xargs -n1 php -l
```

When checking runtime behavior, start `wp-env` with explicit local ports and visit:

```text
http://localhost:<dev-port>/wp-admin/admin.php?page=create-not-learn-editor
```

## Repository Shape

- `create-not-learn-editor.php` is the plugin entry point.
- `includes/` contains PHP bootstrap, dependency checks, admin page rendering, REST endpoints, and setup behavior.
- `src/` contains JavaScript route modules, content surfaces, settings helpers, and styles.
- `routes/` contains thin `@wordpress/build` entry wrappers for the editor routes.
- `@wordpress/build` creates the browser bundles and asset metadata under `build/`.
- `.wp-env.json` defines the local WordPress and Gutenberg plugin environment.

## Current Design Constraints

- Do not depend on a local Gutenberg repository checkout.
- Do not copy source from Gutenberg into this plugin.
- Use published `@wordpress/*` packages and runtime modules from the released Gutenberg plugin.
- Import WordPress packages directly from `@wordpress/*`; do not access package APIs through `window.wp`.
- Keep automatic site changes out of editor load.
- Preserve PHP 7.4 compatibility.
- Keep the plugin installable on the latest WordPress release once Gutenberg is installed and active.
