# Overview

## Current Behavior

The popup owns quick controls while the Chatwork picker renders every cached
sticker except broken images.

## Target Behavior

An extension Settings page manages popup visibility, personal sticker order,
soft deletion and restoration, pack visibility/metadata, preferences backup,
and broken-image review. Picker and Quick Reactions immediately omit trashed or
hidden stickers.

## Affected Users

- Extension user.

## Affected Product Docs

- `docs/product/settings-and-sticker-management-proposal.md`

## Non-Goals

- Cross-device sync, telemetry, remote sharing, or Chatwork upload protocol
  changes.
