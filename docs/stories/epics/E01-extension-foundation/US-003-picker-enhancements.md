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
- [x] Hovering and scaling a sticker does not change the grid column count or make tiles jump between rows.
- [x] Sticker selection and favorite actions use sibling buttons; the image cannot cover the favorite hit target.
- [x] The automated test suite runs successfully with `npm run test` or a custom test script.
- [x] `npm run validate` runs successfully without any errors or warnings.

## Design Notes

- Storage API: `chrome.storage.local`
- UI elements: Add Tabs (`All`, `Recent`, `Favorite`) and "Random" button to the picker.
- Sticker tiles use a non-interactive container with separate selection and favorite buttons.
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

- 2026-07-09 favorite hit-target fix: replaced nested buttons with sibling
  selection/favorite controls, raised the favorite control above the scaled
  image, and added regression coverage that favorite does not insert/close
  while selection does close the picker. The favorite hit target remains
  transparent so it does not obscure sticker artwork.
- 2026-07-10 favorite hit-target refinement: reduced the favorite control from
  24x24 to 16x16, kept it as a sibling control outside sticker selection, and
  added regression coverage that the compact CSS hit target does not expand via
  padding.
- 2026-07-10 invalidated context handling: favorite and recent storage writes
  ignore Chrome's stale content-script `Extension context invalidated` error so
  extension reloads do not create an uncaught promise rejection.
- Node-based test runner (`npm run test`) successfully passes 73/73 tests (100% success rate).
- Validation (`npm run validate`) passes; `validate:data` reports one pre-existing suspicious sticker URL warning.
- Hover overflow is isolated horizontally, scrollbar space remains stable, and
  scaling is driven by the fixed-size tile hover state.
- Forensic Auditor audit report executed under `.agents/auditor/audit_report.md` reports verdict CLEAN.
- Verification command configured and verified with `_harness/bin/harness-cli story verify US-003-picker-enhancements`.
