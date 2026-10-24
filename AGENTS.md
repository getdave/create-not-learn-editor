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
- `.wp-env/sources/` is generated and ignored by git; see wp-env Sources below.

## wp-env Sources

Always run wp-env through `npm run wp-env ...`, not the `wp-env` binary. `npm run wp-env` runs `scripts/wp-env.mjs`, which serves wp-env's downloads from a cache shared by every checkout before passing the command on.

- Every checkout gets its own wp-env work directory, so letting wp-env download for itself means WordPress, Gutenberg and two PHPUnit clones per checkout. That is enough traffic to get throttled by wordpress.org and GitHub. Don't point `.wp-env.json` back at download URLs.
- On `start`, the script fills the cache (`~/.cache/create-not-learn-editor/wp-env`, or `CNL_WP_ENV_CACHE`) with anything missing, then sets up `.wp-env/sources/`, which `.wp-env.json` points at. Gutenberg is a symlink into the cache. WordPress is copied into the checkout, because wp-env writes `wp-config.php` and uploads into it.
- Versions live in `scripts/wp-env.mjs`, not `.wp-env.json`. Each version downloads once; to change one, update its `key` with its URL.
- wp-env always runs `git fetch` in its PHPUnit clones. The script points them at a cached wordpress-develop clone, so that fetch stays local.
- Keep the environment to what the editor needs: WordPress, Gutenberg, this plugin and the Mainstay theme. Optional plugins such as [Canvas](https://github.com/Automattic/canvas) belong in a local, git-ignored `.wp-env.override.json`, as the README describes, not in `.wp-env.json`.

## Demo Theme and Site

- `themes/mainstay/` is a block theme built for this editor and the default theme on the `wp-env` development site. It is the only theme `.wp-env.json` adds; the tests site runs WordPress's bundled default theme, because wp-env doesn't activate themes. It is not part of the plugin and is not in the plugin zip.
- `.wp-env.json` runs `scripts/setup-demo-site.mjs` after start. It runs `scripts/demo-site/seed.php` once per site (guarded by the `cnl_demo_site_version` option) to activate Mainstay and add the Fernhouse demo pages, posts and menu. Keep it additive and idempotent: never overwrite content someone has changed. It only touches the development environment, not the tests site.
- Section colours in Compose come from the theme's `styles/sections/*.json` block style variations, which must set colours. Header and footer layouts are patterns with `Block Types: core/template-part/header` or `core/template-part/footer`.
- Bundled photos are CC0 (StockSnap) and fonts are OFL; credit new ones in `themes/mainstay/readme.txt`.

## Playground Demo

- The README's demo link opens WordPress Playground with `demos/blueprint.json`. Keep blueprints and other Playground demo files in `demos/`. The seed script stays in `scripts/demo-site/` because wp-env runs it too.
- The blueprint installs from the `playground-build` branch, which `.github/workflows/plugin-zip.yml` replaces on every push to `trunk`. Never commit to that branch by hand.
- Every other branch publishes a demo to the ref `refs/playground/<branch>`, which is neither a branch nor a tag, and a `v*` tag publishes a release demo to a `playground-v*` tag that also pins WordPress to the `scripts/wp-env.mjs` version. `scripts/playground-build.sh` generates their blueprints from `demos/blueprint.json`. Never create, push to or move `refs/playground/*` refs or `playground-v*` tags by hand. Keep the URLs in `demos/blueprint.json` pointing at `/playground-build/`, as that is what the script rewrites.
- Keep the blueprint's Gutenberg version in step with `.wp-env.json`.
- Anything the demo site needs at runtime must be in the plugin zip, the Mainstay theme, `scripts/demo-site/seed.php` or `demos/playground-canvas-fix.php`, as those are all the blueprint gets.
- `demos/playground-canvas-fix.php` is a demo-only must-use plugin that stops the edit canvas staying blank in Playground. See its docblock. It never ships in the plugin.

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
find . -path ./node_modules -prune -o -path ./build -prune -o -path ./.wp-env -prune -o -name '*.php' -print | xargs -n1 php -l
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
- The block toolbar's rework, after Gutenberg's proposal for it, lives in `src/block-toolbar/`. It works from outside core's toolbar, through its slots and a stylesheet; see its README before changing core's toolbar another way.
- Pickers used by more than one screen, and by the chat, live in `src/pickers/`. Change a picker there rather than copying it, so the screens and the chat stay the same.
- The chat lives in `src/chat/`. It sits in the stage, in place of the screen, or docked to the right of the canvas; a button in its header swaps the two while both are tried. Without a language model it answers from a script: `engine.js` matches requests and `skills.jsx` says what each one shows and saves. Because of that it has no message box, unless the `create-not-learn-editor_assistant_can_type` filter turns one on; people pick from its choices instead. With the Agentic Editor plugin and an AI connector, the box shows and a model answers what is typed (`model.js`). The model's own tools show the same pickers (`model-tools.js`), and Agentic Editor's tools change the canvas. Requests a picker answers in full skip the model when TypeSafe's Jev, a decision model whose key is set under Settings > Connectors, is sure of them (`router.js`, `decision-model.js`, `includes/assistant-router.php`). The script's keyword matching isn't used for what is typed then, as it can't tell "edit my menu" from "add a mobile menu". Choices are still answered from the script. See the README's "Connecting a language model". It is mounted from app init, so it and the pickers import package by package rather than through `src/wordpress-packages.js`. Only its ways in, the panel's frame and its placement load with app init. The panel's body (`panel.jsx`, and through it the skills and pickers) and the editor's section picker come from `packages/app-init-deferred`, a script module app init fetches once the page is idle (`src/app-init-deferred.js`); keep anything that isn't needed before the chat opens out of `index.jsx`. Pickers too big for that, because they reach the editor, like the menu editor, go in `packages/chat-extras`, a script module the chat imports the first time it needs one.
- The temporary vendored ListView bridge lives in `src/vendor/gutenberg/list-view/` and must be regenerated with `npm run sync:list-view`, not edited by hand.

Import WordPress packages from `@wordpress/*` modules instead of reading them from `window.wp`. Build assets are generated by `@wordpress/build`, which writes the dependency metadata PHP needs to enqueue package scripts and script modules.

Write components in JSX, not `createElement` calls. `@wordpress/build` only parses JSX in `.jsx` files, so any module containing JSX must use the `.jsx` extension; modules without JSX stay `.js`. The root `eslint.config.cjs` extends the `@wordpress/scripts` config so `.jsx` files are linted.

Root `routes/*` files should stay thin re-export wrappers around the source route modules. Do not put substantive route implementation in the wrappers unless the build tool requires it.

`@wordpress/build` bundles each route module separately, with its own copy of everything it imports. So screens that share source share one module: `routes/static` serves Design, Colors, Fonts, Name & logo and the Advanced lists, `routes/site-part` serves Header, Footer and Header & footer, and `routes/content` serves both content paths. `cnl_editor_get_routes()` maps each path to its module, and the screen is picked by path. Add a screen to one of these rather than giving it a wrapper of its own that bundles the same code again.

DataViews is the biggest package the editor uses, so it lives in its own script module, `packages/dataviews`, which screens load with `useDataViews()` from `src/use-dataviews.js` the first time they show a list. Don't import `@wordpress/dataviews` anywhere else.

Don't import `@wordpress/block-library` either: any import puts the whole library on every screen's page load. The editor's assets load and register WordPress's blocks; wait for `useEditorAssets()` before building blocks, as the Menus edit canvas does.

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
