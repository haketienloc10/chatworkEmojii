# US-001 Stabilize Sticker Foundation

## Status

implemented

## Lane

normal

## Product Contract

Phase 1 of `docs/product/extension-roadmap.md`: the Chatwork sticker extension
must render a stable sticker picker, handle broken images without exposing raw
preview markup, provide a local data validation command, and include practical
operator documentation.

## Relevant Product Docs

- `docs/product/extension-roadmap.md`

## Acceptance Criteria

- Sticker data loads through a normalized runtime shape with `previewId` and
  `height` derived from legacy items.
- Broken sticker images show a compact disabled placeholder and do not expose
  `[preview id=...]` alt text.
- Sticker data can be validated locally for parse errors, required fields,
  duplicate `id`/`previewId`, and suspicious URLs.
- README explains loading the unpacked extension, reloading after edits, clearing
  cache, validating data, and adding stickers.
- Content script no longer depends on jQuery for initialization.

## Design Notes

- UI surface: Chrome MV3 content script on `www.chatwork.com`.
- Data source: `data/file_list.json` and listed JSON files.
- Runtime compatibility: support existing `{ "url": "...", "id": "[preview ...]" }`
  records while exposing normalized fields in code.

## Validation

When updating durable proof status, use numeric booleans:
`_harness/bin/harness-cli story update --id US-001-stabilize-sticker-foundation --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer       | Expected proof |
| ----------- | -------------- |
| Unit        | `npm run validate:data` |
| Integration | `node --check scripts/content.js && node --check scripts/popup.js && node --check scripts/validate-data.js` |
| E2E         | Manual Chatwork smoke test when browser access is available |
| Platform    | Manual load unpacked extension smoke test when Chrome access is available |
| Release     | Not required |

## Harness Delta

None expected.

## Evidence

- `npm run validate` passed.
- `npm run validate:data` reported 157 sticker items across 6 files and 1
  suspicious external URL warning in `data/20241212.json[1]`.
- Chrome debug smoke test on `https://www.chatwork.com/#!rid232079630` passed
  after reloading extension `LocDT` from `/home/locdt/chatworkEmojii-v2`.
- First-open broken image smoke found 157 tiles, 72 disabled placeholders, 85
  remaining images, 0 broken visible images, 0 preview alt leaks, and 0 preview
  text leaks.
- Insert smoke appended `[preview id=2034466880 ht=150]` into the Chatwork
  textarea and restored the previous draft value.
- Direct sync to `/home/locdt/chatworkEmojii-v2` was blocked by sandbox
  `Read-only file system`; `scripts/sync-extension.sh` was validated against a
  writable `/tmp` target instead.
