# US-005 Upload Import Workflow

## Status

implemented

## Lane

high-risk

## Product Contract

Phase 4 slice of `docs/product/extension-roadmap.md`: the extension must upload
image files to Chatwork from the popup, parse the returned uploaded file
metadata, and turn it into sticker data that can be reused by the picker without
manual upload-plus-JSON/script edits.

## Relevant Product Docs

- `docs/product/extension-roadmap.md`

## Acceptance Criteria

- Background network observer records the current Chatwork upload request
  template from `chrome.webRequest`.
- Popup exposes a file picker and upload action for the active Chatwork tab.
- Content script uploads the selected file to Chatwork using the active session
  and learned/default upload request template.
- Upload response parsing extracts Chatwork `file_id`, then generates `previewId`, `id`, `url`,
  `height`, `name`, `tags`, `pack`, `createdAt`, and `source`.
- Imported stickers are stored in extension data storage and appear in the
  picker without editing static JSON or `data/file_list.json`.
- Duplicate `previewId` imports are ignored/rejected without adding another
  record.
- Existing static `data/` sticker loading and favorites/recents continue to
  work.

## Design Notes

- Commands: popup sends selected file payload to content script; content script
  uploads to Chatwork and writes imported sticker records into
  `chrome.storage.local`.
- Queries: content script merges imported sticker records after static `data/`
  files are loaded or when upload import reloads data.
- API: popup sends `reload_sticker_data` and `upload_chatwork_sticker_file`;
  background stores `chatwork_upload_config_v1` from `webRequest`.
- Tables: none.
- Domain rules: `previewId` is unique across static and imported sticker data.
- UI surfaces: Chrome MV3 popup, background service worker, and Chatwork content
  script.

## Validation

When updating durable proof status, use numeric booleans:
`_harness/bin/harness-cli story update --id US-005-upload-import-workflow --unit 1 --integration 1 --e2e 1 --platform 0`.

| Layer       | Expected proof |
| ----------- | -------------- |
| Unit        | `npm run test` |
| Integration | `npm run validate` |
| E2E         | Local browser-like upload/import smoke in `npm run test`; Chrome CDP/live Chatwork smoke when browser access is available |
| Platform    | Manual load-unpacked sync/reload smoke when browser access is available |
| Release     | Not required for this slice |

## Harness Delta

None planned.

## Evidence

- `npm run test` passed 61/61 tests, including upload response parsing, upload
  request construction from observed network config, duplicate rejection, cache
  reload coverage, and a local E2E smoke from observed upload config through
  popup upload, imported storage/cache, picker render, and sticker insertion.
- `npm run test` covers the current Chatwork signed upload flow:
  `get_upload_file_info_sig_v4.php`, signed storage POST, and
  `upload_file_finish.php`.
- `npm run validate` passed: `validate:data` checked sticker data with the
  existing suspicious external URL warning, and JS syntax checks passed,
  including `scripts/background.js`.
- `_harness/bin/harness-cli story verify US-005-upload-import-workflow` passed.
- Live Chrome/Chatwork smoke ran against
  `https://www.chatwork.com/#!rid232079630`: load-unpacked source was synced to
  `/tmp/chatworkEmojii-e2e`, loaded as extension
  `legdabcfeojbmgpjijbelafcdacgnhin`, native Chatwork upload revealed the signed
  upload contract, and popup/content upload imported `file_id=2104954595` into
  `sticker_imported_v1`; cache reloaded to 159 items. Live picker visual proof
  was not clean because the older extension `bjejgmomdmkepfnhbahogpbffpphehlf`
  was still installed in the same Chrome profile and owned the existing
  `#_sticker` UI.
