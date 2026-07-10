# 0003 Local Sticker Management State

Date: 2026-07-10

## Status

Accepted

## Context

Settings must allow a user to hide, reorder, restore, and eventually remove
imported stickers without changing bundled `data/*.json` or transmitting
Chatwork data.

## Decision

Store versioned, user-owned management preferences in `chrome.storage.local`.
The picker derives its visible order from the cached source list plus these
preferences. Deletion first writes a trash snapshot; permanent deletion only
removes matching imported records after explicit confirmation in Settings.

## Alternatives Considered

1. Edit bundled JSON for individual preferences: rejected because it changes
   source data and cannot preserve per-user choices.
2. Immediately delete every selected sticker: rejected because bundled records
   cannot be safely recovered and imported records need an undo period.

## Consequences

Positive:

- Cache reloads preserve hides, trash entries, and custom ordering.
- No sticker metadata leaves the browser.

Tradeoffs:

- The Settings page must reconcile preferences with source records at render
  time.

## Follow-Up

- Keep sync between devices and remote pack sharing out of scope.
