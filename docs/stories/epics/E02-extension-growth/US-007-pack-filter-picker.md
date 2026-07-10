# US-007 Pack Filter Picker

## Status

implemented

## Lane

normal

## Product Contract

The picker exposes local pack chips, including `All packs`, so a user can limit
the visible stickers to one metadata pack. The selected pack combines with the
existing All/Recent/Favorite tab and search query. It does not create new pack
records, persist selection, send telemetry, or make network requests.

## Relevant Product Docs

- `docs/product/extension-growth-proposal.md`
- `docs/product/extension-growth-plan.md`

## Acceptance Criteria

- [x] Picker renders an `All packs` chip and one accessible chip for every non-empty current sticker pack.
- [x] Selecting a pack filters results alongside the active tab and search query, with existing empty state retained.
- [x] Switching or clearing a pack filter reuses cached tile and image DOM nodes.
- [x] Pack chips expose accessible names and pressed state.
- [x] The All grid receives the remaining viewport-bounded panel height and scrolls instead of being clipped by the pack-filter row.
- [x] Switching picker tabs or pack chips keeps the popup open, including when
  Chatwork replaces the toolbar; selecting a sticker still closes it.

## Design Notes

- Filter state is picker-local (`selectedPack`) and intentionally not persisted.
- Pack options derive from normalized current stickers; no local pack manager or new storage schema is introduced.
- Result filtering order is tab, pack, broken-image exclusion, then search.
- `positionStickerPanel` gives the flex panel a definite, viewport-bounded height
  so the grid's existing vertical scroll container can occupy remaining space.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | `npm run test` covers pack/search composition, empty state, accessibility state, and tile reuse. |
| Integration | `npm run validate`. |
| E2E | Manual Chatwork smoke for selecting/clearing a pack filter when available. |
| Platform | Unpacked extension reload smoke when available. |
| Release | Not required. |

## Harness Delta

None expected.

## Evidence

- `npm run test`: 77/77 pass, including pack/search composition, empty state,
  pressed accessibility state, cached tile reuse, and fixed panel height for
  scrollable All results.
- `npm run validate`: pass. `validate:data` reports one pre-existing suspicious
  external URL warning in `data/20241212.json`; JavaScript syntax checks pass.
- `_harness/bin/harness-cli story verify US-007-pack-filter-picker`: pass.
- `npm run test`: 78/78 pass, including regression coverage that replacing the
  Chatwork toolbar after switching picker tabs does not close the popup.
- `npm run test`: 78/78 pass after the pack-chip click regression fix. The test
  runtime now preserves the browser event path when a handler replaces its
  clicked node, and verifies that selecting a pack keeps the picker open.
- `npm run validate`: pass; `validate:data` retains the known suspicious URL
  warning in `data/20241212.json`.
- Manual Chatwork and unpacked-extension smoke were not run in this task.
