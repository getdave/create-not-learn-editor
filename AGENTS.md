# Agent Instructions

This is a standalone WordPress plugin repo for Create Not Learn Editor.

## Core Direction

- Keep this plugin independent from the Gutenberg repository.
- Do not add a Gutenberg checkout, submodule, or source mount.
- Do not copy Gutenberg source except for the scripted, provenance-tracked ListView vendor bridge under `src/vendor/gutenberg/list-view/`.
- Consume released WordPress and Gutenberg packages.
- Preserve the plugin dependency on the released Gutenberg plugin.
- The editor should mirror Gutenberg's experimental `site-editor-v2` full-page setup where practical.

## Visual Parity Rules

- Do not artificially enlarge standard WordPress/Gutenberg component sizing to match screenshots that may show only part of a page or UI. Preserve proportional component sizing from the prototype or established WordPress defaults unless a full-context design explicitly requires otherwise.

## Important Runtime Facts

- Plugin slug: `create-not-learn-editor`.
- Full-page admin URL: `/wp-admin/admin.php?page=create-not-learn-editor`.
- WordPress menu location: `Appearance > Create Not Learn`.
- Required Gutenberg version: `24.0.0` or newer.
- Minimum PHP version: `7.4`.
- WordPress dependency header must keep `Requires Plugins: gutenberg`.

## Build Artifacts

- `build/` is generated and ignored by git.
- `*.zip` plugin packages are generated and ignored by git.
- Do not commit `node_modules/`, `build/`, or plugin zip files.
- Run `npm run build` before runtime checks or `npm run plugin-zip`.
- `.wp-env/plugins/canvas` is a generated local checkout and ignored by git; see Canvas Plugin in wp-env below.

## Canvas Plugin in wp-env

The `wp-env` instance auto-installs and activates the [Automattic/canvas](https://github.com/Automattic/canvas) plugin alongside Gutenberg on every start.

- Canvas ships no release zip and requires `npm ci && npm run build` before WordPress can activate it. wp-env only clones git-sourced plugins — it never builds them — so `scripts/ensure-canvas-plugin.mjs` clones/updates Canvas into `.wp-env/plugins/canvas` and builds it before `wp-env` runs. It skips the rebuild when the checked-out commit hasn't changed.
- The `npm run wp-env` script runs that ensure script first, then forwards to the real `wp-env` command (`"wp-env": "node scripts/ensure-canvas-plugin.mjs && wp-env"` in `package.json`). Always invoke wp-env through `npm run wp-env ...`, not the `wp-env` binary directly, or Canvas won't get built.
- `.wp-env.json` points its plugin entry at the local built copy (`./.wp-env/plugins/canvas`), not a bare `Automattic/canvas` or GitHub URL string — wp-env's git-source shorthand only clones, so pointing there directly reproduces the missing-build-assets failure.
- Canvas requires WordPress 7.1+, which is why `.wp-env.json` pins `core` to `https://wordpress.org/wordpress-7.1.zip`. Don't lower it back to 7.0 without also dropping Canvas.
- wp-env activates every entry in `"plugins"` as one `set -eo pipefail` batch — if any plugin fails to activate (including Canvas, if its build step is skipped), the whole `wp-env start` aborts and tears down, so the plugin listed after it (`.`, this plugin) never activates either. Keep Canvas's build step working, don't just drop it from the plugins list to "fix" a failed start.

## Development Commands

Use these commands from the repo root:

```sh
npm install
npm run dev
npm run build
npm run check:list-view
npm run lint:js
npm run lint:css
npm run plugin-zip
npm run wp-env start -- --auto-port
```

`npm run dev` is the watch build. Stop it before finishing unless the user explicitly wants it left running.

When developing, spin up a `wp-env` instance to preview changes rather than reasoning about behaviour from code alone. Pass the `--auto-port` flag when starting `wp-env` so it automatically picks available ports instead of colliding with other running environments; `wp-env start` prints the port it picked. Inspect the editor at:

```text
http://localhost:<port>/wp-admin/admin.php?page=create-not-learn-editor
```

## Verification Expectations

Before handing off code changes, run:

```sh
npm run build
npm run check:list-view
npm run lint:js
npm run lint:css
find . -path ./node_modules -prune -o -path ./build -prune -o -name '*.php' -print | xargs -n1 php -l
```

For runtime checks, use the `wp-env` instance from Development Commands above.

## Editor Architecture

- PHP full-page shell lives in `includes/admin-page.php`.
- Route implementations live under `src/routes/`.
- Build entry wrappers live under root `routes/` for `@wordpress/build`.
- Shared client settings live in `src/settings.js`.
- REST helpers live in `src/records.js`.
- Shared WordPress package imports are centralized in `src/wordpress-packages.js`.
- Styles live in `src/style.scss`.
- Customisations of the full-screen edit canvas live in the editor layer, `src/editor-layer/`. It hides, adds to and configures core's editor from outside rather than forking it; see its README before working around the editor another way.
- The temporary vendored ListView bridge lives in `src/vendor/gutenberg/list-view/` and must be regenerated with `npm run sync:list-view`, not edited by hand.

Import WordPress packages from `@wordpress/*` modules instead of reading them from `window.wp`. Build assets are generated by `@wordpress/build`, which writes the dependency metadata PHP needs to enqueue package scripts and script modules.

Root `routes/*` files should stay thin re-export wrappers around the source route modules. Do not put substantive route implementation in the wrappers unless the build tool requires it.

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
