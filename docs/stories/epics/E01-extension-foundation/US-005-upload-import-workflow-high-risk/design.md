# US-005 Upload Import Workflow High-Risk Design

## Domain Model

- `chatwork_upload_config_v1`: latest observed Chatwork upload endpoint,
  method, non-file form fields, file field name, and observation timestamp.
- `sticker_imported_v1`: imported sticker records keyed by unique `previewId`.

## Application Flow

1. Background service worker observes Chatwork gateway upload requests through
   `chrome.webRequest.onBeforeRequest`.
2. Popup reads the selected image as a data URL and sends it to the active
   Chatwork content script.
3. Content script builds `FormData` from the observed upload config or default
   Chatwork upload endpoint.
4. Content script uploads using `fetch` with `credentials: "include"`.
5. Content script parses `file_id`, stores the imported sticker, clears cache,
   reloads sticker data, and refreshes the picker.

## Interface Contract

- Popup to content message: `upload_chatwork_sticker_file`.
- Payload: `{ file: { name, type, dataUrl }, metadata: { name, tags, pack } }`.
- Success response: `{ status: "success", ok: true, sticker }`.
- Error response: `{ status: "error", error }` or duplicate result.

## Data Model

No database tables. All extension state stays in `chrome.storage.local`.

## UI / Platform Impact

Manifest gains a MV3 background service worker and `webRequest` permission.
Popup gains a file input and `Upload sticker` action.

## Observability

The latest observed upload config is stored under `chatwork_upload_config_v1`.
No file bytes are persisted by the observer.

## Alternatives Considered

1. DOM watcher after user upload. Rejected because it still requires manual
   upload and was the wrong workflow.
2. Hard-code only `gateway/upload_file.php`. Kept as fallback, but paired with
   network observation so field names and endpoint can follow Chatwork changes.
