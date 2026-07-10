# US-006 Quick Reactions Bar

## Status

implemented

## Lane

normal

## Product Contract

When enabled, the final position of the Chatwork toolbar shows up to eight valid
stickers for one-click insertion. The list prioritizes recent stickers, then
favorites, and falls back to the available local collection. The setting is
local-only and persists in `chrome.storage.local`; it sends neither chat content
nor telemetry.

## Relevant Product Docs

- `docs/product/extension-growth-proposal.md`
- `docs/product/extension-growth-plan.md`

## Acceptance Criteria

- [x] Popup toggle persists `quick_reactions_enabled` across extension/page reloads.
- [x] Bar renders at most eight non-broken stickers in the final, right-aligned
  toolbar position when enabled, without occupying the text input area.
- [x] A quick-reaction click inserts the intended sticker and updates recents.
- [x] The bar prioritizes recent stickers, then favorites, without duplicate `previewId` values.
- [x] Disabled state removes the bar without affecting favorites, recents, or sticker cache.
- [x] Each quick-reaction control has an accessible label and reduced-motion does not introduce animation.

## Design Notes

- Storage: `quick_reactions_enabled` in `chrome.storage.local`, default `true`.
- UI surfaces: content-script container at the final position of the Chatwork
  toolbar; checkbox in the extension popup.
- Selection rule: recent -> favorite -> all valid current stickers, deduplicated by `previewId`, maximum eight.
- No provider, network request, telemetry, pack sync, or Chatwork upload-protocol change is part of this story.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | `npm run test` covers selection, insertion, persistence, and disabled state. |
| Integration | `npm run validate`. |
| E2E | Manual Chatwork smoke for enable/disable and one-click insertion. |
| Platform | Reload unpacked extension smoke when Chrome is available. |
| Release | Not required. |

## Harness Delta

None expected.

## Evidence

- `npm run test`: 76/76 pass, including quick-reaction selection, one-click
  insertion, recents update, local persistence, and disabled-state coverage.
- `npm run validate`: pass. `validate:data` reports one pre-existing suspicious
  external sticker URL warning; JavaScript syntax checks pass.
- `_harness/bin/harness-cli story verify US-006-quick-reactions-bar`: pass.
- Manual Chatwork and unpacked-extension smoke were not run in this task.
- 2026-07-10: moved the bar from the text-input area into the last, right-aligned
  toolbar position so it remains to the right of existing Chatwork controls.
