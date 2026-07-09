# US-005 Upload Import Workflow High-Risk Validation

## Proof Strategy

Local proof covers parsing, request construction, popup/content messaging, cache
reload, and duplicate handling. Live provider proof requires loading the
extension in Chrome, observing a Chatwork upload config, and uploading a small
image from the popup in a real room.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Extract `file_id`; build upload request from observed config; build signed upload info request; build sticker metadata. |
| Integration | Popup sends file payload; content script uploads via mocked direct or signed Chatwork response; storage/cache update. |
| E2E | Local browser-like popup upload creates a reusable sticker that renders in the picker and can be inserted; live Chatwork smoke remains desired. |
| Platform | Load-unpacked MV3 service worker observes upload request and stores config. |
| Performance | Not required for this slice. |
| Logs/Audit | Upload config stored without file bytes. |

## Fixtures

- Mock upload response: `{"file_id":"9876543210"}`.
- Local E2E upload response: `{"file_id":"5550001112"}`.
- Signed upload fixture: `get_upload_file_info_sig_v4.php` returns a redirect
  containing `file_id=5550002223`, storage POST returns `204`, and
  `upload_file_finish.php` returns success.
- Mock image data URL: `data:image/gif;base64,R0lGODlhAQABAAAAACw=`.

## Commands

```text
npm run test
npm run validate
_harness/bin/harness-cli story verify US-005-upload-import-workflow
```

## Acceptance Evidence

- `npm run test` passed 58/58.
- `npm run validate` passed, including `node --check scripts/background.js`.
- `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"`
  passed.
- `npm run test` passed 61/61 with local E2E coverage for observed upload config,
  popup upload, direct and signed Chatwork upload paths, imported
  storage/cache, picker render, and sticker insertion.
- Live Chrome/Chatwork smoke imported `file_id=2104954595` through the signed
  upload path with load-unpacked extension `legdabcfeojbmgpjijbelafcdacgnhin`;
  live picker visual proof was noisy because an older extension copy was also
  installed in the same Chrome profile.
