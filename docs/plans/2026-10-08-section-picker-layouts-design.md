# Layouts in the "Add a section" picker

Date: 8 October 2026

## Why

In Canvas user testing, people judged the stock photos, fonts and copy in patterns rather than the shape of the section they wanted. [Layout Primitives](https://github.com/getdave/editor-layout-primitives) answers that with 10 plain layouts that preview as grey wireframes and insert as empty blocks. This brings its core set into the picker, and adds 20 more layouts built from the same blocks, for 30 in all.

## Decisions

- **A Designs / Layouts switch** sits under the picker's title, as a text segmented control. It opens in Designs and remembers the last choice in `preferencesStore` (`create-not-learn-editor` / `sectionPickerMode`). It applies on the Pages screen and in the editor, since both share `SectionPicker`.
- **Layouts mode** groups layouts by shape, with the same side list of groups as Designs. The groups are Banners, Text, Image and text, Columns, Images and Calls to action. "Start from scratch" stays above them. Search covers the current mode only. An empty search offers a link to search the other mode.
- **Only the five wireframed blocks** (heading, paragraph, image, button, cover) are used, so new layouts need no new wireframe code. The 20 new ones were generated with `createBlock()` and `serialize()`, so their markup is canonical.
- **Grids use a fixed column count.** In previews, core's grid formula assumes a smaller gap than the one it gets, so a grid with a minimum column width drops a column. The image grid and logo strip set only `columnCount`.
- **Ported, not depended on.** The core set's patterns, wireframes and empty-state CSS live in this plugin. The Canvas set and its preview alignment fix are left out because the prototype doesn't use Canvas.
- **Real block patterns.** Layouts are registered from PHP under the `cnl-layouts` category, so they go through the same path as designs. They arrive as content-only sections named after the layout, and "Edit section" unlocks them.
- **The name is "Layouts"**, even though the beginner vocabulary also uses "Layouts" for templates. Templates will be renamed later.

## Where things live

| Piece | File |
|---|---|
| Patterns | `patterns/layouts/*.html` (root blocks carry the `cnl-layout` class) |
| Registration, order and each layout's group | `includes/layouts.php` |
| Group names, labels and descriptions | `getLayoutGroups()` in `src/section-picker/groups.js` |
| Wireframe and empty-state CSS | `assets/layouts.css`, added to the editor settings' styles so it reaches preview and canvas iframes |
| Wireframes in previews | `src/layouts/`, an `editor.BlockEdit` filter registered from app init |
| Picker mode | `src/section-picker/section-picker.js`, `src/section-picker/patterns.js` |

Each layout is registered with `cnl-layouts` and a group category such as `cnl-layouts-banners`. Only `cnl-layouts` is a registered category, so core's inserter still lists every layout under one Layouts category.

## Known gaps

Carried over from Layout Primitives.

- Empty headings and paragraphs output empty tags on the front end, and an empty Cover renders as a grey dim.
- Wireframes also show in other read-only previews, such as the site preview, for layouts whose slots are still empty.
