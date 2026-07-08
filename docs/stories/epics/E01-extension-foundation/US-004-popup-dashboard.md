# US-004 Popup Dashboard Controls

## Status

implemented

## Lane

normal

## Product Contract

Phase 4 slice of `docs/product/extension-roadmap.md`: the extension popup must
become a small operational dashboard instead of only a cache clear button.

## Relevant Product Docs

- `docs/product/extension-roadmap.md`

## Acceptance Criteria

- Popup shows cached sticker count, favorite count, recent count, and cache state from `chrome.storage.local`.
- Clear cache removes only cached sticker data and broken-image runtime state; it must not erase favorites or recents.
- Reload data asks the active Chatwork content script to reload sticker JSON and reports the refreshed sticker count.
- Popup reports a useful status message when no Chatwork content script is available.
- Popup keeps controls compact enough for the browser action popup.
- `npm run test` and `npm run validate` pass.

## Design Notes

- UI surface: Chrome MV3 action popup.
- Data source: `chrome.storage.local` keys `sticker_cache_v2`, `sticker_favorites`, and `sticker_recents`.
- Content script messages:
  - `clear_sticker_cache`
  - `reload_sticker_data`
- Domain rules:
  - Favorites and recents are user preferences and should survive a cache clear.
  - Sticker cache can be repopulated from extension JSON without reloading Chrome.

## Validation

When updating durable proof status, use numeric booleans:
`_harness/bin/harness-cli story update --id US-004-popup-dashboard --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer       | Expected proof |
| ----------- | -------------- |
| Unit        | `npm run test` |
| Integration | `npm run validate` |
| E2E         | Manual Chrome popup smoke test when available |
| Platform    | Manual load-unpacked reload smoke test when available |
| Release     | Not required |

## Harness Delta

None expected.

## Evidence

- `npm run test` passed 54/54 tests, including popup dashboard count rendering,
  clear-cache preference retention, and reload-data cache refresh coverage.
- `npm run validate` passed: `validate:data` checked 157 sticker items across 6
  files with the existing single suspicious external URL warning, and `check:js`
  passed for `scripts/content.js`, `scripts/popup.js`, and
  `scripts/validate-data.js`.
- Chrome CDP was reachable at `127.0.0.1:9222`; the live Chatwork tab had the
  sticker button and panel present.
- After the user synced the extension source to `/home/locdt/chatworkEmojii-v2`,
  Chrome CDP reloaded extension `bjejgmomdmkepfnhbahogpbffpphehlf`.
- Chatwork E2E smoke passed on the reloaded bundle: 157 picker tiles rendered,
  search narrowed to 1 result, favorite and recent counts updated, insert wrote
  `[preview id=2034466880 ht=150]`, no raw preview text leaked in the panel, and
  `Escape` closed the picker.
- Popup dashboard E2E smoke passed through `chrome-extension://.../popup.html`
  with the active Chatwork tab simulated: reload data reported 157 items, clear
  cache changed cache state to `Empty`, favorites/recents stayed at 1/1, and a
  second reload restored cache state to `Ready`.
