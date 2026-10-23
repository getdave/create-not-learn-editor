# Site canvas

The canvas beside Home, Pages and Design. A Browse | Edit toggle at the left of its toolbar switches between looking at the site and changing it. While editing, a Compose button beside it steps back to work on the page's sections, and undo and redo follow it.

- **Browse**, the default. The saved site in an iframe, as visitors see it. Links can be followed to other pages. Because it looks just like Edit, it hints at Edit where someone reaches for a change: the page's words have the arrow, not the text cursor, a section rested on for a moment is outlined faintly with an Edit tag (purple for the header and footer), a click on anything that isn't a link or button highlights its section the same way, and a second click on it asks "Want to change this?". Edit from the tag or the question, or a double click, opens Edit with that section picked. See "Browse's hints" below.
- **Edit**. The page in core's editor, with our own layer over it. Pointing at a section picks how to edit it, and nothing on the page can be clicked until one way is chosen. See "Edit's section layer" below. Each section made of other blocks starts content-only. A layout, like Single Post, opens unlocked, as its sections are mostly a post's title, image and content. "Open in full editor", in the toolbar's More options menu, opens the full-screen editor for anything the canvas doesn't suit.
- **Compose**. The same editor zoomed out, with the same section layer as Edit over it. Sections are dragged to reorder the page, a ghost of the section following the pointer, and a section's layout, colours and place on the page (move, duplicate, delete, add a section) change without leaving. Anything else, like Edit content, Add, More control or a double click, zooms back into Edit and does it there. It is editing from further away, so the toggle stays on Edit. The Compose button, or Escape with nothing picked, returns to Edit.

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
| `browse-hints.jsx` | Browse's hints that the page is changed in Edit, laid over the preview. |
| `preview-blocks.js` | Finding, in the editor, the block a spot in the preview shows. |
| `use-section-lock.js` | In Edit, every section of a page or post made of other blocks starts content-only, with core's own lock, kept in the editor's settings rather than the page. A layout's sections aren't locked: they are mostly a post's title, image and content, so there would be nothing left to change. |
| `edit-section-controls.js` | Core's unlock button said as "Edit" and "Done", and core's "Shuffle styles" hidden, in Edit. |
| `part-spotlight.js` | `useEditorSpotlight()`: a header or footer brought forward on the canvas, the rest of the page faded and dimmed. Shared by Edit's section layer and the Header and Footer screens. |
| `use-canvas-styles.js` | `useCanvasStyles()`: styles kept in the editor's canvas while wanted, put back when the editor swaps its iframe. Used by Compose and Edit's section layer. |
| `icons.js` | An icon for a page built from stacked sections, for the empty page in Compose, and a zoom-out magnifier for Compose's button. |
| `section-modes/` | Edit's section layer. See below. |
| `compose/` | Compose. See below. |

## Browse's hints

The preview is the front end, which doesn't know the editor's blocks. Previews name each block on its outermost element, as `data-cnl-block` (`cnl_editor_name_preview_block()` in `includes/preview-frame.php`). A spot on the page then has a path of named blocks above it, and following that path down the editor's tree, which has the same blocks in the same order, finds the section it is in. A synced pattern has no element of its own, so the editor's are looked through. Where the two part ways, like a list of posts repeating its blocks, the path stops at the last block both have.

Edit, from the tag or the question, selects the section in core, and Edit's section layer picks the section of a block selected, as it does for one the section picker adds.

## Edit's section layer

Pointing at a section in Edit outlines it, names it in a tab, tints it and lays a bar over it. The header and footer are named "shown on every page", and stay where they are.

A header or footer in a mode, Edit design, Edit content or Freeform, is put in the spotlight, the rest of the page faded and dimmed behind a dark backdrop, as on the Header and Footer screens (`part-spotlight.js`), so it looks the same however it is reached.

A canvas about one part of the site, like the Header and Footer screens', passes it as `focusId`. The layer then offers only that part, picked from the start so its bar shows straight away, and the rest of the page can't be pointed at or clicked.

- **Add**, at the bar's start: a heading, paragraph, button or image, put last in the section, inside the groups that only wrap its content, then straight into Edit content with the caret in it, or the picture selected. An image is chosen from the media library first. A section that is a single block gets it straight after, as a section of its own.
- **Edit design**: the bar's buttons give way, in the same place, to the section's design choices: **Layout**, **Colour**, **Width** and **More control**, each shown only when there is something to choose. Picking one drills into it in the same bar, with **Back** ("Back to Edit design" in its tooltip) leading out again. Colours, shown as Design's colour palettes are, the theme's own first as a swatch of the page's colours that reads "Default" while pointed at or focused, and widths sit in the bar's row. Layouts, each drawn with the section's own content, open in a tray under it, as a carousel showing up to four at once and moving along one at a time, so none is left on its own, opening with the one in use in view. A header or footer offers its designs as its layouts, and the same colours, put on its outermost block so they show on every page; its designs are drawn, and go in, with the colour it has. Colours set on a block win over a picked one and are never taken away behind anyone's back, so a section with colours set on its own block is offered none (colours that only repeat the page's own count as Default), and a section with text colours set inside is offered only the colours that text can still be read on. The last colour, **Custom**, is a swatch like the others (a colour wheel, or the section's own colours once it has them) and picks nothing by itself: it opens a tray under the colours, so custom colours are there for people who look for them without being offered up front. Clicking it again, picking another colour, or Escape closes the tray; Back still leads out to Edit design. The tray holds the section's own **Background**, **Text** and **Button** colours, each opening core's colour palette: the theme's colours first, then pure black and white (unless the palette has them), then any colour. Headings and links take the text colour, and button words whichever of the section's colours reads on the button, or the palette's best when neither does. They are saved on the section's own block with core's colour settings, palette colours by preset. A section whose own colours fit those three, however they were set, shows them as Custom, so they can be changed or swapped for another option.
  Whatever is picked goes in at once, and there is nothing to confirm: Back at the top level, Escape or a click anywhere else, on the page or anywhere in the editor, steps out with the change kept, and undo takes it back. Escape steps back a level at a time, from a choice to the choices, then out. The bar sits at the top of the section in view, as the bar over it did, and follows it as it scrolls. A section too short to hold it, with its tray, has it outside, under it if it fits in view, else over it, so what is picked can be seen.
  - **More control** is Freeform: core's own unlock for the section, for core's full block tools, a header's or footer's too. Like Edit content, it is left with Done editing, Escape or a click elsewhere, not back to Edit design.

While core has a section open, in Freeform or a header's or footer's Edit content, it fades the rest of the page. It expects the section selected, and fades that too until something in it is, but the layer never selects a section's own block, so the layer keeps the section clear itself.
- **Edit content**: clicks reach the section, so its words and pictures can be changed, with core's own tools, Replace for a picture among them, and Remove, added to the end of core's toolbar. Restore on the small bar puts back what was removed. Nothing is laid over the section: no bins, and the small bar naming the mode sits outside it. Core's toolbar never shows for the section's own block. A header or footer is opened with core's own unlock, its blocks locked to their content, the same on any page as on the Header and Footer screens.
- **Move up, move down, duplicate and delete**, at the bar's end. Deleting offers Undo.
- **Add section**, on the section's top and bottom edges, opens that gap in place: the sections move apart, the gap is marked out edge to edge in grey, square as a section is, and a dashed placeholder in it offers the designs and the templates as two carousels, shuffled each time with the theme's own designs first, and scrolled with their arrows, a trackpad or a mouse wheel, then **Start blank**, with **View all sections** to open the section picker for the same gap. Core's inserter between blocks is hidden while it is open. A design or template is added and picked. Blank is typed into straight away, in Edit content. Escape, the close button or a click on the page closes the gap. The gap is a margin the layer adds to the canvas, so nothing goes into the page until something is picked. The section's options menu and the empty page still open the section picker.

A page with nothing in it shows a placeholder across the canvas instead: the design system's empty state in a dotted box, with **Add a section**, which opens the section picker, and **Start blank**, which adds a blank section and opens it in Edit content, ready to type.

A double click on a section opens it in Edit content, with the caret where the click landed, or the block there selected when it has no text, like a picture.

Leaving a mode, with Done editing or Escape, leaves the section picked: outlined, named and with its bar, untinted, as if still pointed at, ready for the other mode. A click picks the section it lands on, and a section added from the section picker is picked and brought into view. Pointing at another section shows its bar, the picked one keeping its outline and name. Escape again, or a click off the sections, un-picks it.

Only one section is in a mode at a time. Done editing, a click on another section, or Escape leaves it, the section staying picked. From a design choice, Escape steps back to the choices first. The bars follow a tall section as it scrolls.

In Edit content and Freeform, the section has a bar with Done editing, and Restore when it applies. Its mode is named for assistive technology only. In a big section the bar is the size of the bar over a section pointed at, in the middle of whichever of its top and bottom edges is in view. A small section has a smaller bar outside it, under its bottom edge or over its top, so it never covers what is being edited.

Changes rewrite the blocks around an item with core's `replaceInnerBlocks`, which a content-only section doesn't turn down, so they are undone like any other edit. Compose's Edit opens what was picked in Edit content.

| File | What it does |
| --- | --- |
| `section-modes-layer.jsx` | The layer: what is pointed at, the mode, and everything drawn over the canvas. |
| `section-chrome.jsx` | The tab, the bar with Add, the two modes and the section's moves, and the small bar naming the mode. |
| `design-bar.jsx` | Edit design's bar: the design choices, and each one's options. |
| `use-canvas-events.js` | The section under the pointer, and the clicks kept off the page, watched from inside the canvas. |
| `use-section-items.js` | Removing, putting back and adding items. |
| `empty-page.jsx` | The placeholder on a page with nothing in it. |
| `use-section-drag.js` | Dragging a section to reorder the page, in Compose. |
| `use-variations.js` | A section's layouts and colours, or a header's or footer's designs and colours, for Edit design's bar. |
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
| `palette-colors.js` | Colour sets made from the theme's palette, for themes without section styles. |
| `section-colors.js` | The colours a section can take, from either, and putting one on. |

A section's layouts come from `src/layouts/variants/`: arrangements of the same content, worked out from the shape of the section's blocks, so they work for theme patterns as well as our layouts. Its colours are the theme's section styles, saved as core saves a block style. A theme without any gets sets made from its palette instead (soft, the page's colours swapped, and its strongest colours with readable text), saved with core's own colour settings by preset, so they follow the palette. A header's or footer's designs are the theme's patterns for its area, applied as core's Design panel does, and its colours are the same as a section's.

On the Pages screen, the sidebar's "On this page" list shows only in Compose, and points at and picks the same sections as the layer.
