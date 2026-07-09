# chatworkEmojii

Chrome Manifest V3 extension that adds a custom sticker picker to Chatwork.

## Local Setup

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this repository folder.
5. Open or refresh `https://www.chatwork.com/`.

The sticker button is added near Chatwork's emoji toolbar button after the chat
input area is available.

## Reload After Edits

1. Go back to `chrome://extensions`.
2. Click reload on the `LocDT` extension card.
3. Refresh the Chatwork tab.

Content script and CSS changes require both the extension reload and the page
refresh.

## Sync Load-Unpacked Source

This repo contains Harness files that should not be part of the unpacked
extension folder. Sync the runtime extension files to the sibling folder before
reloading Chrome:

```bash
npm run sync:extension
```

The default target is `../chatworkEmojii-v2`. To sync elsewhere:

```bash
bash scripts/sync-extension.sh /path/to/extension-folder
```

## Popup Dashboard

Use the extension popup to check current sticker state:

- `Stickers`: cached sticker records loaded from `data/`.
- `Cache`: whether sticker metadata is currently cached.
- `Favorite`: saved favorite stickers.
- `Recent`: recently inserted stickers.

Click `Reload data` after changing files in `data/` while Chatwork is open.
Click `Clear sticker cache` to remove cached sticker metadata and broken-image
runtime state. Favorites and recents are kept.

The popup can upload a new sticker through the active Chatwork tab:

1. Open the Chatwork room where your session is active.
2. Open the extension popup and choose an image file.
3. Set `Name`, `Tags`, and `Pack`.
4. Click `Upload sticker`.

The extension observes Chatwork upload requests with `chrome.webRequest` and
stores the latest upload endpoint/template in `chrome.storage.local` under
`chatwork_upload_config_v1`. The popup sends the selected image to the content
script, which uploads it to Chatwork with the active session, parses the
returned `file_id`, saves the sticker under `sticker_imported_v1`, and reloads
`sticker_cache_v2`. Normal use does not require editing `data/*.json` or
`data/file_list.json`.

The content script stores loaded sticker data in `chrome.storage.local` under
`sticker_cache_v2`. Favorites and recents are also stored in
`chrome.storage.local`.

## Validate Data

Run:

```bash
npm run validate:data
```

The validator checks that:

- `data/file_list.json` points to JSON files.
- Each sticker file parses as an array.
- Each item has `id` and `url`.
- `id` matches `[preview id=<file_id> ht=<height>]`.
- `id` and parsed `previewId` are unique.
- URLs look like Chatwork preview/download URLs.

Warnings identify suspicious data that may still be intentional, such as old
external image URLs. Errors should be fixed before release.

## Add Static Stickers

Use this only for curated static packs. For normal Chatwork uploads, use the
popup `Upload sticker` control.

1. Add the sticker objects to a dated file in `data/`, or create a new dated
   file such as `YYYYMMDD.json`.
2. Keep the legacy fields for compatibility:

```json
{
  "url": "gateway/download_file.php?bin=1&file_id=1234567890&preview=1",
  "id": "[preview id=1234567890 ht=150]"
}
```

3. If a new file was created, add it to `data/file_list.json`.
4. Run `npm run validate:data`.
5. Reload the extension, refresh Chatwork, and clear sticker cache from the
   popup.

## Validation

Run all local checks:

```bash
npm run validate
```
