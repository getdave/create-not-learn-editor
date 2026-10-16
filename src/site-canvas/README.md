# Site canvas

The canvas beside Home, Pages and Design. A Browse | Edit toggle at the left of its toolbar switches between looking at the site and changing it. While editing, a Compose button beside it steps back to work on the page's sections, and undo and redo follow it.

- **Browse**, the default. The saved site in an iframe, as visitors see it. Links can be followed to other pages.
- **Edit**. The page in core's editor, with our own layer over it. Pointing at a section picks how to edit it, and nothing on the page can be clicked until one way is chosen. See "Edit's section layer" below. Each section made of other blocks starts content-only. A layout, like Single Post, opens unlocked, as its sections are mostly a post's title, image and content. "Open in full editor", in the toolbar's More options menu, opens the full-screen editor for anything the canvas doesn't suit.
- **Compose**. The same editor zoomed out, with the same section layer as Edit over it. Sections are dragged to reorder the page, a ghost of the section following the pointer, and a section's layout, colours and place on the page (move, duplicate, delete, add a section) change without leaving. Anything else, like Edit content, Add, a bin, Freeform or a double click, zooms back into Edit and does it there. It is editing from further away, so the toggle stays on Edit. The Compose button, or Escape with nothing picked, returns to Edit.

The mode is shared by every canvas, so it carries over from page to page and screen to screen. It lives in a small data store (`mode.js`), because app init and each route are built separately. Nothing is saved, so every visit starts in Browse.

Moving to Browse with unsaved changes asks to save or discard them, because the preview only shows what is saved. Moving between Edit and Compose never asks: they are the same editor.

## Files

| File | What it does |
| --- | --- |
| `site-canvas.js` | `SiteCanvas`: the toolbar, the editor, the preview laid over it, Edit's section layer and the Compose layer. |
| `use-site-canvas.js` | `useSiteCanvas()`: the canvas's state and the rules for moving between modes. |
| `mode.js` | The shared mode: `useCanvasMode()`, `getCanvasMode()`, `setCanvasMode()`. |
| `toolbar.js` | The Browse \| Edit toggle, the Compose button (labelled "Zoom out"), undo and redo, the preview's history and device, and the More options menu, with the way to the full-screen editor. |
| `zoom-controls.jsx` | Compose from the canvas itself: a zoom in and zoom out pair in its corner, as on a map, and a pinch on a trackpad, or Ctrl or ⌘ with the scroll wheel. One gesture moves one step. |
| `use-section-lock.js` | In Edit, every section of a page or post made of other blocks starts content-only, with core's own lock, kept in the editor's settings rather than the page. A layout's sections aren't locked: they are mostly a post's title, image and content, so there would be nothing left to change. |
| `edit-section-controls.js` | Core's unlock button said as "Edit" and "Done", and core's "Shuffle styles" hidden, in Edit. |
| `use-canvas-styles.js` | `useCanvasStyles()`: styles kept in the editor's canvas while wanted, put back when the editor swaps its iframe. Used by Compose and Edit's section layer. |
| `icons.js` | An icon for a page built from stacked sections, for the empty page in Compose, and a zoom-out magnifier for Compose's button. |
| `section-modes/` | Edit's section layer. See below. |
| `compose/` | Compose. See below. |

## Edit's section layer

Pointing at a section in Edit outlines it, names it in a tab, tints it and lays a bar over it. The header and footer are named "shown on every page", and stay where they are.

- **Add**, at the bar's start: a heading, paragraph, button or image, put last in the section, inside the groups that only wrap its content, then straight into Edit content with the caret in it, or the picture selected. An image is chosen from the media library first. A section that is a single block gets it straight after, as a section of its own.
- **Edit design**: a panel of the section's layouts, each drawn with its own content, as a carousel showing up to four at once and moving along one at a time, so none is left on its own, opening with the one in use in view (a section with only one shows it, picked), and its colours from the theme's section styles, shown as Design's colour palettes are. A header or footer offers its designs instead. Every item gets a bin, and "Restore removed" puts back what was taken out. Reset puts back how the section was when the panel opened, even after Freeform. The panel sits inside the section, at the top of it that is in view, and follows it as it scrolls. A section too small to hold it has it outside, under it if it fits in view, else over it. A click anywhere else on the page closes it.
  - **Freeform**, from "Need more control? Edit freeform" under the layouts: core's own unlock for the section, for core's full block tools. Back returns to the panel.
- **Edit content**: clicks reach the section, so its words and pictures can be changed, with core's own tools, Replace for a picture among them, and Remove, added to the end of core's toolbar. Restore on the small bar puts back what was removed. Nothing is laid over the section: no bins, and the small bar naming the mode sits outside it. Core's toolbar never shows for the section's own block.
- **Move up, move down, duplicate and delete**, at the bar's end. Deleting offers Undo.
- **Add section**, on the section's top and bottom edges, opens the section picker for that gap.

A page with nothing in it shows a placeholder across the canvas instead: the design system's empty state in a dotted box, with **Add a section**, which opens the section picker, and **Start blank**, which adds a blank section and opens it in Edit content, ready to type.

A double click on a section opens it in Edit content, with the caret where the click landed, or the block there selected when it has no text, like a picture.

Leaving a mode, with Done editing or Escape, leaves the section picked: outlined, named and with its bar, untinted, as if still pointed at, ready for the other mode. A click picks the section it lands on, and a section added from the section picker is picked and brought into view. Pointing at another section shows its bar, the picked one keeping its outline and name. Escape again, or a click off the sections, un-picks it.

Only one section is in a mode at a time. Done editing, a click on another section, or Escape leaves it, the section staying picked. From Freeform, Escape steps back to the panel first. The bar and the panel follow a tall section as it scrolls.

In Edit content and Freeform, the section has a bar with Done editing, and Restore and Back to Edit design when they apply. Its mode is named for assistive technology only. In a big section the bar is the size of the bar over a section pointed at, in the middle of whichever of its top and bottom edges is in view. A small section has a smaller bar outside it, under its bottom edge or over its top, so it never covers what is being edited.

Changes rewrite the blocks around an item with core's `replaceInnerBlocks`, which a content-only section doesn't turn down, so they are undone like any other edit. Compose's Edit opens what was picked in Edit content.

| File | What it does |
| --- | --- |
| `section-modes-layer.jsx` | The layer: what is pointed at, the mode, and everything drawn over the canvas. |
| `section-chrome.jsx` | The tab, the bar with Add, the two modes and the section's moves, and the small bar naming the mode. |
| `layouts-panel.jsx` | Edit design's panel. |
| `use-canvas-events.js` | The section under the pointer, and the clicks kept off the page, watched from inside the canvas. |
| `use-section-items.js` | Removing, putting back and adding items. |
| `empty-page.jsx` | The placeholder on a page with nothing in it. |
| `use-section-drag.js` | Dragging a section to reorder the page, in Compose. |
| `use-variations.js` | A section's layouts and colours, or a header's or footer's designs, for Edit design's panel. |
| `remove-control.jsx` | Remove on core's block toolbar, in Edit content. |
| `items.js` | A section's items, and where a new one goes. Pure functions. |

## Compose

Core's zoom-out is used for its zoom alone. Core can't scale the canvas without also turning on the rest of its zoom-out mode, so the section layer keeps every click off the canvas, and the stylesheet hides core's zoom-out tools. The layer is the same one as Edit's, kept mounted between the two, so what is picked carries over. See "Edit's section layer" above.

| File | What it does |
| --- | --- |
| `use-compose-zoom.js` | Zooms the editor out and back in. Widens the editor to a desktop's width while core measures it, so the page is laid out as on a desktop and shrinks to fit. |
| `use-compose-structure.js` | The page's sections, the blocks of core's section root, and what the template adds around them, like the header, title and footer. |
| `use-block-rects.js` | Where those blocks are on screen, measured every frame, and scrolling the canvas to one. |
| `section-styles.js` | The theme's section styles, as a section's colours. |

A section's layouts come from `src/layouts/variants/`: arrangements of the same content, worked out from the shape of the section's blocks, so they work for theme patterns as well as our layouts. Its colours are the theme's section styles. A header's or footer's designs are the theme's patterns for its area, applied as core's Design panel does.

On the Pages screen, the sidebar's "On this page" list shows only in Compose, and points at and picks the same sections as the layer.
