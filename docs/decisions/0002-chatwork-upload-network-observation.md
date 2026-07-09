# 0002 Chatwork Upload Network Observation

Date: 2026-07-08

## Status

Accepted

## Context

US-005 must stop requiring the user to manually upload an image and then edit
extension data. Chatwork owns the upload endpoint and request shape, so the
extension needs a way to follow the current browser upload behavior without
persisting file bytes or relying only on static guesses.

## Decision

Use a MV3 background service worker with `chrome.webRequest.onBeforeRequest` to
observe Chatwork gateway request metadata and store the latest upload template
and gateway token in `chrome.storage.local`. The popup sends a user-selected
file to the active Chatwork content script, which uploads with the active
session, parses `file_id`, and stores imported sticker metadata.

Only `gateway/upload_file.php` is persisted as a direct upload template.
Ordinary gateway requests may refresh the `_t` token, but must not replace the
upload URL or form fields. Stored templates are validated again by the content
script and invalid or stale URLs fall back to `gateway/upload_file.php` while
retaining a valid observed `_t` token.

As of the 2026-07-08 live Chrome smoke, Chatwork uses a signed storage upload
flow instead of returning `file_id` from `gateway/upload_file.php` directly:

1. `gateway/get_upload_file_info_sig_v4.php` returns signed storage fields and a
   redirect containing `file_id`.
2. The file bytes are POSTed to Chatwork's signed storage endpoint with the
   returned policy fields.
3. `gateway/upload_file_finish.php` finalizes the uploaded file.

The direct `gateway/upload_file.php` path remains a fallback for older observed
templates.

## Alternatives Considered

1. Import from rendered DOM after manual upload. Rejected because it still
   requires manual upload.
2. Hard-code Chatwork upload endpoint only. Rejected as the sole strategy
   because field names and endpoint details can drift.
3. Add a DevTools extension page to read the Network panel. Rejected because it
   would require a separate DevTools surface and would not provide a normal
   popup workflow.

## Consequences

Positive:

- The user can upload from the extension popup.
- The implementation can adapt when Chatwork changes upload form fields.
- File bytes are only sent during explicit user upload action.
- Current Chatwork signed uploads require storing the gateway `_t` token learned
  from ordinary gateway requests such as room-info refreshes.

Tradeoffs:

- Requires `webRequest` permission.
- Live Chatwork proof is still required to confirm the provider accepts the
  reconstructed request.
- Upload endpoint recognition is intentionally strict so query parameters such
  as `load_file_version` cannot misclassify room-info requests as uploads.

## Follow-Up

- Run a Chrome load-unpacked smoke with a live Chatwork room.
- Record the observed endpoint and whether default fallback is sufficient.
