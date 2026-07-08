# Original User Request

## Initial Request — 2026-07-08T06:01:00Z

Build Phase 2 & 3 enhancements for the Chatwork Sticker Chrome Extension, introducing Tabs (All, Recent, Favorite) with persistent local storage, random sticker insertion, advanced keyboard navigation, and lazy-loaded images, ready for production use.

Working directory: /home/locdt/chatworkEmojii
Integrity mode: benchmark

## Requirements

### R1. Tabs System & Persistent Storage
The extension must introduce tabs (`All`, `Recent`, `Favorite`) in the sticker picker panel.
- The `Recent` list must track and display up to 20 recently inserted stickers (most recent first).
- The `Favorite` list must display stickers that the user has favorited (by clicking a star/pin button on the sticker tile).
- Favorites and Recents must be persistently stored and retrieved using the Chrome extension storage API (`chrome.storage.local`).
- The sticker cache itself (data loaded from files) should be stored in `chrome.storage.local` instead of `localStorage` for extension consistency, matching Phase 2 roadmap.

### R2. Keyboard Navigation & Search Focus
The extension must support advanced keyboard navigation when the sticker picker panel is open:
- Pressing `/` must focus the search input.
- Arrow keys (Up, Down, Left, Right) must move the active focus/highlight state among the sticker tiles in the grid.
- Pressing `Enter` must insert the currently focused sticker, close the picker, and return focus to Chatwork's chat textarea.
- Pressing `Escape` must close the picker.

### R3. Random Sticker Insertion
The extension must place a "Random" sticker button in the picker header. Clicking it must pick a random sticker from the currently active tab (or all stickers if no search/filter matches), insert it, and close the picker.

### R4. Lazy Loading & Image Error Handling
The sticker grid must lazy-load images to prevent loading hundreds of images simultaneously. Image error handling (replacing broken images with a placeholder) must remain functional under lazy-loaded conditions.

### R5. Automated Verification Suite
Implement a Node-based unit/integration test suite (e.g. using Jest or a custom node script with JSDOM/mocks) that programmatically verifies:
- Saving, retrieving, and updating Recents and Favorites using mocked `chrome.storage.local`.
- Toggling favorites and adding/truncating recents.
- Search input focusing on `/`, grid navigation on Arrow keys, and insertion on `Enter`.
- Random sticker selection.

## Acceptance Criteria

### Storage & Functional Behavior
- [ ] Recents list stores up to 20 unique items. Inserting a sticker pushes it to the top of Recents; if already in Recents, it moves to the top.
- [ ] Clicking the favorite star/pin icon on a sticker toggles its favorite status. Favorited stickers appear in the `Favorite` tab.
- [ ] User preferences, recents, and favorites persist across page reloads using `chrome.storage.local`.

### Keyboard & UI Behavior
- [ ] Arrow keys highlight/focus sticker tiles in the grid sequentially.
- [ ] Pressing `Enter` inserts the highlighted sticker and closes the panel.
- [ ] Pressing `/` focuses the search input when panel is open.
- [ ] Random button picks a sticker from the currently active tab, inserts it, and closes the panel.
- [ ] Images load lazily (only when in/near viewport).
- [ ] Broken images render a disabled placeholder instead of broken image icon or alt text.

### Verification
- [ ] The automated test suite runs successfully with `npm run test` or a custom test script.
- [ ] `npm run validate` runs successfully without any errors or warnings.
