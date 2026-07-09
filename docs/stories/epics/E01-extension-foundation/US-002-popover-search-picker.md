# US-002 Popover Search Sticker Picker

## Status

implemented

## Lane

normal

## Product Contract

Phase 2 slice of `docs/product/extension-roadmap.md`: the Chatwork sticker picker
must feel anchored to the chat toolbar and let users quickly search existing
stickers without covering the main chat history like a centered modal.

## Relevant Product Docs

- `docs/product/extension-roadmap.md`

## Acceptance Criteria

- Picker opens as a popover positioned near the sticker toolbar button and
  stays inside the viewport, with its left edge anchored to the button whenever
  space permits.
- Closing and reopening the picker preserves the rendered sticker DOM instead
  of recreating every tile and image.
- Picker includes a search input that filters by `name`, `tags`, `pack`,
  `previewId`, and `source`.
- Search empty state is clear and does not expose preview markup or raw alt text.
- `Esc` closes the picker and outside click still closes it.
- Sticker insertion still appends the selected preview markup to Chatwork input.
- Existing broken-image placeholder behavior remains intact.
- The first 20 sticker images are preloaded before the picker opens.
- Remaining images are requested only when they enter or approach the visible
  grid viewport, with at most five image requests active concurrently.
- A loading indicator is shown while each image is queued or loading.
- Broken sticker IDs persist across page refreshes and are cleared only by an
  explicit cache clear or data reload.

## Design Notes

- UI surface: Chrome MV3 content script on `www.chatwork.com`.
- Data source: normalized sticker records already produced by US-001.
- Persistence: broken preview IDs are retained across page refreshes; favorite
  and recent persistence is covered by the picker-enhancements story.
- Image loading: a five-request queue prioritizes the first 20 stickers, then
  receives additional work from a grid-rooted `IntersectionObserver`.
- Broken image state is stored in `chrome.storage.local` under
  `sticker_broken_preview_ids_v1`.

## Validation

When updating durable proof status, use numeric booleans:
`_harness/bin/harness-cli story update --id US-002-popover-search-picker --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer       | Expected proof |
| ----------- | -------------- |
| Unit        | `npm run validate:data` |
| Integration | `npm run validate` |
| E2E         | Manual Chatwork smoke test through Chrome DevTools when available |
| Platform    | Manual load-unpacked reload smoke test when available |
| Release     | Not required |

## Harness Delta

None expected.

## Evidence

- 2026-07-09 image-loading follow-up: the first 20 stickers are queued before
  open, later stickers are scheduled by a grid-rooted `IntersectionObserver`,
  and the shared queue is capped at five active image requests.
- Loading tiles show an animated indicator; failed preview IDs persist in
  `chrome.storage.local` and explicit clear/reload actions remove that state.
- `npm test` passed 68/68, including preload scheduling, loading indicator,
  concurrency limit, viewport observation, and broken-ID persistence coverage.
- `npm run validate` passed; data validation checked 158 items across 7 files
  with the existing suspicious external URL warning.
- 2026-07-09 follow-up: opening the picker now only changes visibility and
  position; automated regression coverage verifies tile identity is preserved
  across close/open and the panel left edge anchors to the sticker button.
- `npm run validate` passed.
- `npm run validate:data` reported 157 sticker items across 6 files and 1
  suspicious external URL warning in `data/20241212.json[1]`.
- Chrome CDP was available at `127.0.0.1:9222`; extension reload on
  `chrome://extensions` clicked the `LocDT` reload button.
- Chatwork CDP smoke could not validate this new bundle because the unpacked
  extension is currently loaded from `/home/locdt/chatworkEmojii-v2`, and
  syncing there from this sandbox failed with `Read-only file system`.
- Local-source CDP injection smoke on the Chatwork tab passed: 157 tiles, 72
  placeholders, 0 preview leaks, search narrowed `2034466880` to 1 result,
  no-match empty state rendered, insert appended `[preview id=2034466880
  ht=150]`, and `Esc` closed the picker.
