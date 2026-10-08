# Add a section: modal picker

Replaces the sidebar section library on the Pages screen, and core's pattern inserter behind the editor's "Add section" menu item, with one modal picker. Modelled on the "Add a section" modal in Jamie Marsland's Gogh demo.

## Decisions

- **Entry points.** The Pages screen (the `+` gaps and "Add a section") and the editor's "Add section" section menu item both open the modal. Core's own inserters are left alone.
- **Quick start.** Only "Start from scratch", shown as a full-width strip above the first group. No "Paste HTML". "My sections" is left out for now.
- **Groups.** Core's pattern categories are remapped into purpose groups. Any other category, such as one the theme registers, goes into a "From {Theme}" catch-all at the end. Each design appears once, in the first group it matches. "Featured" is not a group.

  | Group | Subtitle | Core categories |
  | --- | --- | --- |
  | Introduce | Say who you are | `banner`, `about`, `team` |
  | Sell | Win people over | `call-to-action`, `services`, `testimonials` |
  | Showcase | Show off your work | `portfolio`, `gallery`, `media`, `videos`, `audio` |
  | Write | Words, quotes and lists | `text`, `columns`, `buttons` |
  | Posts | Share your latest writing | `posts` |
  | Get in touch | Help people reach you | `contact` |
  | From {Theme} | Designs from your theme | anything else |

  A future "Wireframes" group would be one more entry in the table.
- **Navigation.** One long scroll. The left list jumps to a group and highlights the group in view.
- **Picking.** Clicking a card adds the design straight away and closes the modal. From the Pages screen it goes at the gap clicked; from the editor, straight after the section whose menu was used. The subtitle says where it will go.
- **Start from scratch.** Adds an empty Group with a blank paragraph. From the editor, the cursor goes into the paragraph. From the Pages screen, the editor opens with the new section selected.
- **Search.** Matches titles, descriptions and keywords. Results replace the groups with a flat grid and a count. No results shows a message and the "Start from scratch" strip.

## Shape

- `src/section-picker/` holds the shared module: the group mapping and search (`groups.js`), the section pattern helpers moved from the Pages data module (`patterns.js`), the modal (`section-picker.js`) and its styles. It imports package by package, because the editor layer loads it from app init.
- The modal takes a `Preview` component. The Pages screen passes lazy-editor's `Preview`. The editor passes a `BlockPreview` wrapper, since lazy-editor can't be a static dependency of app init and the editor's settings are already in the block editor store.
- Previews mount only when their card nears the viewport, so the long scroll doesn't render every design up front.
- In the editor, the section menu item stores a request in `src/editor-layer/section-picker.js`, and `EditorLayer` renders the modal, because the menu item unmounts as the selection changes.

## Out of scope

- "My sections", "Paste HTML" and "Wireframes".
- Intercepting core's own block and pattern inserters.
