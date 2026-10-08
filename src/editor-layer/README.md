# Editor layer

Our customisations of the edit canvas, layered over Gutenberg's editor rather than built into it. The technique comes from Big Sky's Easy Mode.

The editor that boot renders for a full-screen edit route (`/types/$type/edit/$id`, templates, template parts) is core's own `@wordpress/editor` `Editor`, and it has few extension points. Rather than fork it or wait for slots, the layer leaves it mounted and working, and works around it from outside:

- **One React root at document level**, mounted by app init. It shares the default data registry with the editor, so it reads and drives `core/editor` and `core/block-editor` directly.
- **Portal hosts** in the editor's own regions, for chrome of our own.
- **A stylesheet** that hides the editor chrome we replace, rather than unmounting it.
- **A settings guard** that forces block editor settings and hands them back afterwards.

All of it is scoped to boot's full-screen edit canvas, so stage screens and preview canvases are never touched.

## Files

| File | What it does |
| --- | --- |
| `index.js` | `mountEditorLayer()`, called from `packages/app-init`. |
| `editor-layer.js` | `EditorLayer`, the composition root. Start here. |
| `canvas-mode.js` | `useIsEditCanvas()`: whether the full-screen edit canvas is on screen. |
| `portal-host.js` | `usePortalHost()` and `EDITOR_REGIONS`. |
| `settings-guard.js` | `useForcedBlockEditorSettings()`. |
| `section-wording.js` | `useSectionWording()`: core's pattern strings, said as sections while a page is open. |
| `style.scss` | The layer's stylesheet, loaded with app init. |

## Recipes

### Hide a piece of editor chrome

Add a rule inside the `body:has(#{$edit-canvas})` block in `style.scss`. Hide rather than unmount, so the editor underneath keeps working.

### Hide something only in a particular editor state

Publish the state as a data attribute on `.cnl-editor-layer` from `EditorLayer`, then key the rule off it with `:has()`. `data-selected-block` is the existing example: it holds the selected block's name, and hides core's "Edit original" while a template part is selected.

### Put our own UI into the editor

Portal into one of the editor's regions:

```js
const host = usePortalHost( EDITOR_REGIONS.headerToolbar, 'cnl-editor-layer__header-tool' );

return host && createPortal( el( OurButton ), host );
```

The host is appended as the region's last child, so it takes the region's layout. If the editor re-renders the region, a new host is appended. Give the host `display: contents` in `style.scss` if its contents should lay out as the region's own children.

To replace a piece of core's chrome rather than add to it, also hide the original in `style.scss`. To replace the whole header, hide `.editor-header` and portal into `EDITOR_REGIONS.header`.

Don't portal into core's toolbars (`.editor-document-tools`, the block toolbar). They treat any focusable element that isn't one of their own toolbar items as a reason to drop arrow key navigation, and a portal can't join their toolbar context. Portal next to them instead, as `headerToolbar` does.

### Force a block editor setting

Add it to `FORCED_BLOCK_EDITOR_SETTINGS` in `editor-layer.js`. For example, content-only editing:

```js
const FORCED_BLOCK_EDITOR_SETTINGS = { templateLock: 'contentOnly' };
```

The value is re-applied whenever the editor pushes its own settings over it, is not written until a rendering-mode swap has settled, and is handed back when the edit canvas closes. Nothing is written to user preferences.

### Change core's wording

Add the string to `SECTION_WORDING` in `section-wording.js`, or follow its pattern for a new vocabulary. Core's strings are swapped through `@wordpress/i18n`'s gettext filters, whole strings at a time, and only while the layer turns the filter on. A string with a context is keyed as context, `\u0004`, then text.

Core's strings aren't APIs either. If core rewords one, the swap stops silently and core's wording shows through.

## Drift canaries

These are core's rendered markup, not APIs, so an upstream change can break them silently:

- Boot's full-canvas class is matched by its CSS-module suffix, `__has-full-canvas`. It appears in `canvas-mode.js` and as `$edit-canvas` in `style.scss`.
- The region selectors in `EDITOR_REGIONS` rely on the editor's `interface-interface-skeleton__*` classes.
- The "Edit original" rule relies on the block toolbar's group structure.
- The rule hiding a section's "Detach" relies on core rendering it as the menu item right before its "Manage patterns" link, and finds that link by its URL.
