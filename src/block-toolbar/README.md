# Block toolbar

Core's block toolbar, reworked along the lines of [Gutenberg's proposal for it](https://github.com/WordPress/gutenberg/issues/85204), from outside core rather than as a toolbar of our own. Core's toolbar stays, with its slots, focus handling and Alt+F10. Its own pieces are restyled or hidden by the stylesheet, and what stands in for them is filled into its slots.

It applies wherever core shows a block toolbar in the editor: the full-screen editor and the site canvas's Edit mode.

- **The block's name** beside its icon, with a chevron, as the way to transform it. Core's switcher, labelled by the stylesheet from its own `aria-label`. Its block styles move to the options menu, so where there is nothing to transform into, as in a locked section where core's menu holds only styles, the name is a label: no chevron, and it doesn't open.
- **Movers as one compact cluster**: the drag handle and arrows side by side, close together and quieter than the other tools until pointed at or focused. The proposal draws them full size; that took too much room, so each is narrower but keeps the toolbar's full height as its target.
- **A Layout menu and "+"** for containers (blocks with layout support): block width and how the content lines up, each showing what's in use, and a quick inserter that adds a block as the container's last child.
- **An options menu** in place of core's "⋮": the style controls that left the toolbar (text alignment, block width, text size), text and background colours, a formatting fallback, Styles (the block's styles, like a button's Fill and Outline, then, after a divider, copying and pasting styles), inserting, the clipboard, Group and Create pattern, and More. More holds core's own items, like Lock, Rename, Hide and Edit as HTML, and anything plugins add to core's menu. Text alignment, size, colours and Styles, copying and pasting included, show wherever the block's content can be changed, in a locked section too, as a word processor offers them; block width only where the block can be moved. Text color and Background color show for any block whose colour support has them, so one button or card can differ from the rest. Each offers the theme's colours, then black and white, each marked when it would leave the block's text hard to read, and Custom, which opens core's colour picker by the options button. Sections the block has nothing for are left out, and for a block with none, like an image locked to its content, the button stays but is disabled. It can still be focused, so it is found where it always is, but it does not open.
- **Trash**, at the end.
- **The parent selector outside the toolbar**, to the left, in a box of its own, so the toolbar stays lined up with the block, as the proposal draws it: the select-parent button, its tooltip naming the parent, and from two levels deep "···" before it, which lists every block the selected one sits in, from the outermost down, each nested a rule further. The toolbar only moves in when the parent selector would be cut off at the canvas's edge.
- **Formatting with a text selection**: core's format group leaves the toolbar's row and floats by the selected text, below it when the toolbar is in the way. It is drawn a size down from the block toolbar, as the proposal draws it, so the two are easy to tell apart: 32px buttons in a 40px bar, an active format filled in, and "More" as ⋮ after a divider. Bold and italic are also in the options menu for formatting before typing.
- **Icons must be recognisable or labelled**: an icon-only button that isn't one people know from across the web (link, bold, italic, trash) moves into the options menu, named, under the block's name. This takes in third-party buttons as well as core's.

Multiple selection keeps core's toolbar and menu.

## Files

| File | What it does |
| --- | --- |
| `index.jsx` | `registerBlockToolbar()`, called from app init. The `editor.BlockEdit` filter that fills the selected block's toolbar. Start here. |
| `options-menu.jsx` | The options menu. |
| `layout-menu.jsx` | A container's Layout menu and "+". |
| `parent-selector.jsx` | The parent selector and the list of blocks further up. |
| `toolbar-menu.jsx` | A `@wordpress/ui` menu opened from a button on core's toolbar. See below. |
| `core-menu-items.jsx` | Core's and plugins' options menu items, and the toolbar's unlabelled icon buttons, read for the options menu. |
| `colors.jsx` | The Text color and Background color flyouts and the Custom colour picker. Which colour is in use, and what a choice saves, are in `src/editor-extensions/color-details.js`. |
| `alignment.js` | A block's text alignment and width choices. |
| `block-actions.js` | Copy, cut, and copy and paste styles. |
| `shortcuts.js` | Keyboard shortcuts in the form the menus show them. |
| `use-floating-format-toolbar.js` | Floats the format group by the text selection. |
| `name-menu.js` | Keeps the block's name as a label when its menu would be empty without its styles. |
| `use-parent-selector-fit.js` | Moves the toolbar in when the parent selector would be cut off. |
| `toolbar-keyboard.js` | Arrow keys through the toolbar's visible items. |
| `_style.scss` | The toolbar's look, and what it hides. |

## Working with core's toolbar

- **Fills go in `BlockControls` groups, not `__unstableBlockToolbarLastItem`.** That slot renders its fills again, from scratch, on every click in the toolbar, so a menu in it closes as soon as it opens. `BlockControls` slots portal their fills and keep their state.
- **Menus can't use `Menu.Trigger`.** Base UI puts tabbable focus guards beside a menu's trigger and where its popup is rendered from. Core's toolbar sees anything tabbable that isn't one of its items as a custom control, falls back to a plain toolbar and renders again, which unmounts the menu. `ToolbarMenu` uses core's `ToolbarButton` as the button and renders the menu, without a trigger, from the end of the document.
- **Hidden items break core's arrow keys.** Core moves focus through every toolbar item, hidden or not, and stops at the first hidden one. `toolbar-keyboard.js` steps over them.
- **Core's own menu items are clicked, not redrawn.** They keep state, like the Rename modal they open, so `core-menu-items.jsx` renders core's menu slots out of sight and the options menu lists what is in them. An item that opens something calls `useLeaveFocus()` first, so the menu doesn't take focus back as it closes.

## Drift canaries

These are core's markup and words, not APIs, so an upstream change can break them silently:

- The style controls the toolbar hides, the format buttons that mark the format group, and the icons counted as well known are found by their English `aria-label`s (`$style-controls`, `$format-buttons` and `$well-known` in `_style.scss`). A reworded label shows the control again.
- Core's items that sit at the top of the options menu, Group and Create pattern, and their icons, are matched by their words.
- The block's name is core's switcher's `aria-label`, shown through CSS. Its styles are hidden by core's `block-editor-block-switcher__styles__menugroup` class.
- The layout relies on core's toolbar classes: `__block-controls`, `__slot`, `has-parent`, `block-editor-block-parent-selector` and the mover's.
