# Design

## Domain Model

`previewId` is the stable identity. `sticker_trash_v1` stores a metadata
snapshot, deletion timestamp, original pack, and original index. Hidden IDs and
custom order are arrays of `previewId`; pack preferences are keyed by source
pack name.

## Application Flow

Settings reads cache/imported records plus preferences, writes only local
preferences, then asks the active Chatwork content script to refresh. The
picker filters hidden, trashed, and hidden-pack records before tabs, search,
and Quick Reactions render.

## Interface Contract

`refresh_sticker_preferences` reloads local management state in a content
script and replies with the visible sticker count.

## Data Model

Keys: `sticker_popup_preferences_v1`, `sticker_custom_order_v1`,
`sticker_hidden_preview_ids_v1`, `sticker_trash_v1`,
`sticker_pinned_preview_ids_v1`, and `sticker_pack_preferences_v1`.
Trash is cleaned after 30 days only when Settings is opened; permanent removal
is limited to imported records and requires confirmation.

## UI / Platform Impact

The MV3 options page is the management surface. Its sticker manager uses a
responsive grid with truncated metadata and wrapped per-card ordering controls,
so selection and ordering preserve their existing behavior without horizontal
overflow. Popup remains compact and opens Settings; it immediately applies saved
visibility controls.

## Observability

No telemetry or remote logging. UI status text communicates local mutations.

## Alternatives Considered

1. Put management UI in the popup: rejected because bulk selection and keyboard
   operations do not fit the quick-action surface.
