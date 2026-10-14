# Site canvas

The canvas beside Home, Pages and Design. A Browse | Edit toggle at the left of its toolbar switches between looking at the site and changing it. While editing, a Compose button beside it steps back to work on the page's sections.

- **Browse**, the default. The saved site in an iframe, as visitors see it. Links can be followed to other pages.
- **Edit**. The page in core's editor. Each section made of other blocks starts content-only, so its words and images can be changed, and "Edit" on its toolbar unlocks it. "Open in full editor", in the toolbar's More options menu, opens the full-screen editor for anything the canvas doesn't suit.
- **Compose**. The same editor zoomed out, with our own layer over it for working on the page's sections. It is editing from further away, so the toggle stays on Edit. The Compose button, or Escape with nothing picked, returns to Edit.

The mode is shared by every canvas, so it carries over from page to page and screen to screen. It lives in a small data store (`mode.js`), because app init and each route are built separately. Nothing is saved, so every visit starts in Browse.

Moving to Browse with unsaved changes asks to save or discard them, because the preview only shows what is saved. Moving between Edit and Compose never asks: they are the same editor.

## Files

| File | What it does |
| --- | --- |
| `site-canvas.js` | `SiteCanvas`: the toolbar, the editor, the preview laid over it, and the Compose layer. |
| `use-site-canvas.js` | `useSiteCanvas()`: the canvas's state and the rules for moving between modes. |
| `mode.js` | The shared mode: `useCanvasMode()`, `getCanvasMode()`, `setCanvasMode()`. |
| `toolbar.js` | The Browse \| Edit toggle, the Compose button, the preview's history and device, and the More options menu, with the way to the full-screen editor. |
| `use-section-lock.js` | In Edit, every section made of other blocks starts content-only, with core's own lock, kept in the editor's settings rather than the page. |
| `edit-section-controls.js` | A section's Layout and Color on core's block toolbar in Edit, and core's unlock button said as "Edit" and "Done". |
| `section-outline.js` | In Edit, the section pointed at, and the section holding the selection, outlined and named as Compose does, a step thicker than core's outlines around blocks. Core's outline around the page's content as a whole is hidden in their favour. Drawn inside the editor's content region, whose isolated stacking is the only place it can sit under core's block toolbars, and lets every click through. |
| `use-canvas-styles.js` | `useCanvasStyles()`: styles kept in the editor's canvas while wanted, put back when the editor swaps its iframe. Used by Compose and the section outlines. |
| `icons.js` | An icon for a page built from stacked sections, for the empty page in Compose. Compose's button uses the editor's own zoom-out icon. |
| `compose/` | Compose. See below. |

## Compose

Core's zoom-out is used for its zoom alone. Core can't scale the canvas without also turning on the rest of its zoom-out mode, so the Compose layer takes every click, key and scroll over the canvas, and core's own zoom-out tools never come up.

| File | What it does |
| --- | --- |
| `use-compose-zoom.js` | Zooms the editor out and back in. Widens the editor to a desktop's width while core measures it, so the page is laid out as on a desktop and shrinks to fit. |
| `use-compose-structure.js` | The sections Compose works on, the blocks of core's section root, and what the template adds around them, like the header, title and footer. |
| `use-block-rects.js` | Where those blocks are on screen, measured every frame. |
| `compose-layer.js` | The layer: outlines to point at and pick, the "+" between sections, the box to add one after the last, the empty page, dragging to reorder, and double-clicking a block to open it in Edit. What the template adds around the page, like the header, title and footer, is always marked in the purple the Pages sidebar uses for it, so the page's own sections stand apart. |
| `section-toolbar.js` | The toolbar over what is picked: move, remove, layout, colours and Edit for a section; design and Edit for a header or footer, in purple. |
| `variation-menu.js` | The dropdown of layouts, colours or designs, each drawn as it would look. |
| `section-styles.js` | The theme's section styles, as a section's colours. |

A section's layouts come from `src/layouts/variants.js`: arrangements of the same content, for sections built from our layouts. Its colours are the theme's section styles, and the control is hidden when the theme has none. A header's or footer's designs are the theme's patterns for its area, applied as core's Design panel does.

Changes go straight to the editor's blocks, so they are undone like any other edit. On the Pages screen, the sidebar's "On this page" list shows only in Compose, and points at and picks the same sections as the layer.
