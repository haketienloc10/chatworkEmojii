# US-003 Picker Enhancements (Phase 2 & 3)

## Status

implemented

## Lane

normal

## Product Contract

The sticker picker panel must support tabs (All, Recent, Favorite), keyboard navigation (Focus search on `/`, grid navigation on arrows, select on `Enter`, close on `Escape`), random sticker insertion, lazy loading, and custom error handling, persistently backed by `chrome.storage.local`.

## Relevant Product Docs

- `docs/product/extension-roadmap.md`

## Acceptance Criteria

- [x] Recents list stores up to 20 unique items. Inserting a sticker pushes it to the top of Recents; if already in Recents, it moves to the top.
- [x] Clicking the favorite star/pin icon on a sticker toggles its favorite status. Favorited stickers appear in the `Favorite` tab.
- [x] User preferences, recents, and favorites persist across page reloads using `chrome.storage.local`.
- [x] Arrow keys highlight/focus sticker tiles in the grid sequentially.
- [x] Pressing `Enter` inserts the highlighted sticker and closes the panel.
- [x] Pressing `/` focuses the search input when panel is open.
- [x] Random button picks a sticker from the currently active tab, inserts it, and closes the panel.
- [x] Images load lazily (only when in/near viewport).
- [x] Broken images render a disabled placeholder instead of broken image icon or alt text.
- [x] The automated test suite runs successfully with `npm run test` or a custom test script.
- [x] `npm run validate` runs successfully without any errors or warnings.

## Design Notes

- Storage API: `chrome.storage.local`
- UI elements: Add Tabs (`All`, `Recent`, `Favorite`) and "Random" button to the picker.
- Keyboard support: Attach `keydown` listeners on the document/picker.
- Lazy-load: Use IntersectionObserver.

## Validation

When updating durable proof status, use numeric booleans:
`_harness/bin/harness-cli story update --id US-003-picker-enhancements --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer       | Expected proof |
| ----------- | -------------- |
| Unit        | Node-based test suite verifying recents, favorites, navigation, and random features |
| Integration | `npm run validate` |
| E2E         | Manual smoke test on Chatwork |
| Platform    | Unpacked extension load test |
| Release     | Not required |

## Harness Delta

None.

## Evidence

- Node-based test runner (`npm run test`) successfully passes 50/50 tests (100% success rate).
- Validations (`npm run validate`) pass with clean status.
- Forensic Auditor audit report executed under `.agents/auditor/audit_report.md` reports verdict CLEAN.
- Verification command configured and verified with `_harness/bin/harness-cli story verify US-003-picker-enhancements`.

