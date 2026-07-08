# 0001 Use chrome.storage.local for Persistence

Date: 2026-07-08

## Status

Accepted

## Context

The Chatwork Sticker Chrome Extension needs to store:
- Normalized sticker caches (`sticker_cache_v2`).
- User favorites list (`sticker_favorites`).
- User recents list (`sticker_recents`).

Previously, sticker cache was stored in the page's `localStorage` context. However, page context `localStorage` is not private to the extension, can be cleared by the user or other scripts on the page, and is limited in size and scope. Furthermore, `chrome.storage.local` is the standard Chrome extension storage API, which allows sharing data between popup, background page, and content scripts securely.

## Decision

We will use `chrome.storage.local` for all extension state persistence:
- Caching sticker metadata loaded from `file_list.json`.
- Tracking user favorites list (array of `previewId`s).
- Tracking user recents list (array of `previewId`s, max 20).
- Reading/writing will be asynchronous, replacing the synchronous `localStorage.getItem` and `localStorage.setItem` calls.

## Alternatives Considered

1. **Continue using localStorage**: Rejected because `localStorage` is accessible by the page's host script (Chatwork), which could lead to conflicts, data clearing, or security/privacy issues.
2. **chrome.storage.sync**: Rejected because sync has very strict quota limits (e.g. 102KB total limit, max 8KB per item) which is too small for caching hundreds of sticker metadata records.

## Consequences

Positive:
- Secure and private storage isolated from the host page context.
- Consistent storage API usage across content script and popup.
- Higher storage limits suitable for large sticker caches.

Tradeoffs:
- `chrome.storage.local` is asynchronous, which requires adapting the data loading and rendering pipeline to be asynchronous.

## Follow-Up

- Modify `loadStickers` to be asynchronous using `chrome.storage.local.get` and `chrome.storage.local.set`.
- Modify `popup.js` to clear `chrome.storage.local` caches when requested.
- Create mocks for `chrome.storage.local` in the automated test suite.
