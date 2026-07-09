# US-005 Upload Import Workflow High-Risk Overview

## Current Behavior

Sticker additions still depend on Chatwork-hosted `file_id` values. The prior
US-005 direction imported metadata after an image was already uploaded, which
still required the user to perform the upload step outside the extension.

## Target Behavior

The popup lets the user select an image file and upload it to Chatwork through
the active Chatwork tab/session. The extension parses the upload response
`file_id`, creates the sticker metadata, stores it in `chrome.storage.local`,
and reloads picker data.

## Affected Users

- Maintainer/user adding new Chatwork stickers.

## Affected Product Docs

- `docs/product/extension-roadmap.md`
- `docs/stories/epics/E01-extension-foundation/US-005-upload-import-workflow.md`

## Non-Goals

- Uploading files to any server other than Chatwork.
- Sending a Chatwork message automatically after upload.
- Persisting uploaded stickers into static `data/*.json` files.
