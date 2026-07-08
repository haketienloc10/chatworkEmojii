# Plan - Chatwork Sticker Chrome Extension Enhancements

This plan outlines the steps to implement Phase 2 & 3 enhancements for the Chatwork Sticker Chrome Extension.

## Lane & Complexity Assessment
- **Lane**: Normal (with stronger validation)
- **Complexity**: Medium. The main tasks are UI modifications, keyboard navigation, persistent storage via `chrome.storage.local`, and a Node-based automated verification suite.

## Steps

### Step 1: E2E and Unit Testing Track Initialization (M1)
- Create `TEST_INFRA.md` at the project root outlining the test approach and inventory.
- Implement the test runner and mocks for `chrome` API and JSDOM inside a test suite (using Jest or a custom node script).
- Create Tier 1-4 test cases to verify current and new requirements.
- Verify that `npm run test` executes successfully.

### Step 2: Implement Tabs & Storage (M2)
- Transition the `sticker_cache_v2` storage from `localStorage` to `chrome.storage.local`.
- Add tab layout (`All`, `Recent`, `Favorite`) at the top of the sticker picker panel.
- Implement logic for tracking and displaying up to 20 recently inserted stickers (most recent first).
- Implement toggling of favorite status via star/pin button on sticker tiles, persisting in `chrome.storage.local` under `sticker_favorites`.
- Update popup clearing logic to clear `chrome.storage.local` caches.

### Step 3: Implement Keyboard Navigation & Search Focus (M3)
- Focus search input when pressing `/` when the picker is open.
- Navigate tiles in the grid using Arrow keys (highlighting the currently active tile).
- Insert active tile and close picker on `Enter`.
- Close picker on `Escape`.

### Step 4: Implement Random Sticker Button (M4)
- Place "Random" sticker button in the picker header.
- On click, select a random sticker from the currently active tab (or all stickers if no matches) and insert it, then close the picker.

### Step 5: Implement Lazy Loading & Error Handling (M5)
- Lazy load images using an intersection observer or a layout-based lazy loader, since we want to avoid loading hundreds of images simultaneously.
- Verify broken image error placeholder renders a disabled placeholder.

### Step 6: Integration & Verification (M6)
- Run automated unit and integration tests.
- Run `npm run validate` to ensure format, lint, and types pass.
- Record trace and submit completion report to parent.
