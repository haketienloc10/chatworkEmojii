# Project: Chatwork Sticker Chrome Extension (Phase 2 & 3 Enhancements)

## Architecture
- **Chrome MV3 Content Script (`scripts/content.js`)**: Runs in the context of `www.chatwork.com`, injects the sticker button into the Chatwork toolbar, handles panel open/close, search filtering, tab switching, keyboard navigation, and sticker injection.
- **Chrome Storage API (`chrome.storage.local`)**: Stores the sticker cache, user favorites list, and user recents list.
- **Node-based Automated Verification Suite**: A mock environment to verify content script logic, tab switching, keyboard inputs, search, storage persistence, and random sticker insertion.
- **Code Layout**:
  - `manifest.json`: Extension manifest and permissions (`storage`, `activeTab`, `scripting`).
  - `popup.html` & `scripts/popup.js`: Extension action popup for cache clearing.
  - `scripts/content.js`: Main logic for the extension.
  - `styles.css`: Styles for the sticker picker popover, tabs, grid, and elements.
  - `data/`: Normalized sticker files and index list (`file_list.json`).
  - `test/`: Automated verification suite.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Testing Track | Define test infrastructure, mock chrome API, and implement test coverage Tiers 1-4 | None | DONE |
| 2 | R1. Tabs & Persistent Storage | Implement Tabs (All, Recent, Favorite) and transition all caching/data storage to `chrome.storage.local` | M1 | DONE |
| 3 | R2. Keyboard Navigation | Focus search on `/`, navigate grid using arrow keys, select on `Enter`, close on `Escape` | M1, M2 | DONE |
| 4 | R3. Random Sticker Button | Insert a "Random" sticker button in picker header, picking from active tab or all stickers | M1, M2 | DONE |
| 5 | R4. Lazy Loading & Error Handling | Implement lazy loaded sticker images with custom image error handling and placeholder fallback | M1, M2 | DONE |
| 6 | Verification & Integration | Integrate and verify all phases via automated tests and validation scripts | M1, M2, M3, M4, M5 | DONE |

## Interface Contracts
### Storage API Contract
- `chrome.storage.local.get` / `set` for:
  - `sticker_cache_v2`: Array of normalized sticker items.
  - `sticker_favorites`: Array of sticker IDs (`previewId`s).
  - `sticker_recents`: Array of sticker IDs (`previewId`s) up to 20 items.
