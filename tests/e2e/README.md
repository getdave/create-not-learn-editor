# End-to-end tests

Playwright tests that drive the editor in a real browser against the `wp-env` tests site.

## How they are organised

- `smoke.spec.js` is one quick pass through every main screen. It fails if a screen doesn't load or the page throws an error. Run it first when something looks broken.
- `views/` checks what each screen shows when it opens, one file per area.
- `interactions/` checks what happens when you do something, such as adding a page, customising a menu or discarding a change. Again, one file per area.
- `utils/` holds the shared `test` fixture and helpers. Import `test` and `expect` from `./utils` rather than from `@playwright/test`.

The areas are `home`, `pages`, `add-page`, `menus`, `design`, `advanced` (Layouts, Site parts and Sections) and `block-editor`, plus `site-canvas` for the Preview and Edit canvas shared by Home, Pages and Design.

## Running them

Start the environment and build the plugin first.

```sh
npm run build
npm run wp-env start -- --auto-port
```

Then run all of them, or one group.

```sh
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:views
npm run test:e2e:interactions
```

Playwright matches file paths, so you can also run one area or one test.

```sh
npx playwright test menus                      # views/menus and interactions/menus
npx playwright test views/pages
npx playwright test -g "deletes a menu"
```

The base URL comes from `wp-env status`. Set `WP_BASE_URL` to point somewhere else.

## Writing tests

- Each test should check one view or one interaction. If its name needs an "and", it is probably two tests.
- Set up data over REST with the `rest` fixture rather than through the UI. `rest.createPage()`, `rest.createPattern()` and `rest.createNavigationMenu()` delete what they make when the test ends. Use `rest.deleteLater()` for things a test makes through the UI, and `rest.onCleanup()` to put back anything else it changes.
- Open screens directly with `visitEditor( page, '/route' )`. Only click through the sidebar when the navigation is what is being tested.
- The global setup logs in once and shares the session with every test.
- Tests run one at a time, because they share one WordPress site.
