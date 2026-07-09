# Agent Instructions

This is a standalone WordPress plugin repo for Create Not Learn Editor.

## Core Direction

- Keep this plugin independent from the Gutenberg repository.
- Do not add a Gutenberg checkout, submodule, source mount, or copied Gutenberg source.
- Consume released WordPress and Gutenberg packages.
- Preserve the plugin dependency on the released Gutenberg plugin.
- The editor should mirror Gutenberg's experimental `site-editor-v2` full-page setup where practical.

## Important Runtime Facts

- Plugin slug: `create-not-learn-editor`.
- Full-page admin URL: `/wp-admin/admin.php?page=create-not-learn-editor`.
- WordPress menu location: `Appearance > Create Not Learn`.
- Required Gutenberg version: `23.5.1` or newer.
- Minimum PHP version: `7.4`.
- WordPress dependency header must keep `Requires Plugins: gutenberg`.

## Build Artifacts

- `build/` is generated and ignored by git.
- `*.zip` plugin packages are generated and ignored by git.
- Do not commit `node_modules/`, `build/`, or plugin zip files.
- Run `npm run build` before runtime checks or `npm run plugin-zip`.

## Development Commands

Use these commands from the repo root:

```sh
npm install
npm run dev
npm run build
npm run lint:js
npm run lint:css
npm run plugin-zip
WP_ENV_PORT="<dev-port>" WP_ENV_TESTS_PORT="<test-port>" npm run wp-env start
```

`npm run dev` is the watch build. Stop it before finishing unless the user explicitly wants it left running.
Replace `<dev-port>` and `<test-port>` with available non-default local ports when starting `wp-env`.

## Verification Expectations

Before handing off code changes, run:

```sh
npm run build
npm run lint:js
npm run lint:css
find . -path ./node_modules -prune -o -path ./build -prune -o -name '*.php' -print | xargs -n1 php -l
```

For runtime checks, use wp-env:

```sh
WP_ENV_PORT="<dev-port>" WP_ENV_TESTS_PORT="<test-port>" npm run wp-env start
```

Then inspect:

```text
http://localhost:<dev-port>/wp-admin/admin.php?page=create-not-learn-editor
```

## Editor Architecture

- PHP full-page shell lives in `includes/admin-page.php`.
- Route modules live under `src/routes/`.
- Shared client settings live in `src/settings.js`.
- REST helpers live in `src/records.js`.
- WordPress globals are centralized in `src/wp-globals.js`.
- Styles live in `src/style.scss`.

The route modules are WordPress script modules. Classic WordPress packages such as components, element, i18n, api-fetch, and url should be accessed through `window.wp.*` helpers instead of imported directly from module files. Imports from script-module packages such as `@wordpress/route` are acceptable.

`webpack.config.js` intentionally preserves module exports for route and content entries. Do not remove the module library output or export preservation settings; without them, `@wordpress/boot` cannot import `route`, `stage`, or `canvas`, and the editor surfaces go blank.

## Site Mutation Rules

- Do not mutate site defaults when the editor loads.
- Keep homepage/navigation setup behind the explicit setup action.
- The setup action should remain idempotent.
- The setup endpoint is `POST /wp-json/create-not-learn-editor/v1/setup-defaults`.

## Git Rules

- Do not commit or push unless David explicitly asks.
- Never push without a separate explicit confirmation.
- Keep commits source-only unless David asks for generated artifacts.
- No GitHub remote is expected by default.
