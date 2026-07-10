# US-008 Local Usage Baseline

## Status

implemented

## Lane

normal

## Product Contract

The extension records only local, aggregate daily usage counters so a user can
assess sticker usage without sending telemetry. The popup presents the latest
seven days and can clear these counters without changing sticker data or
preferences.

## Relevant Product Docs

- `docs/product/extension-growth-proposal.md`
- `docs/product/extension-growth-plan.md`

## Acceptance Criteria

- [x] Local metrics count sticker insertions, Quick Reactions insertions,
  favorite reuse, pack-filter selections, and successful imports by day.
- [x] Metrics contain no Chatwork message content, sticker identifiers, room
  identifiers, account identifiers, or network telemetry.
- [x] The popup shows the latest seven days' insertions, Quick Reactions rate,
  pack-filter selections, and imports.
- [x] The popup can clear only local usage metrics while preserving cache,
  favorites, recents, imported stickers, and preferences.
- [x] Metrics are schema-versioned and prune buckets older than 90 days.

## Design Notes

- Storage: `sticker_usage_metrics_v1` is `{ version: 1, days: { YYYY-MM-DD:
  counters } }` in `chrome.storage.local`.
- Writes are serialized in the content script to avoid losing rapid successive
  clicks. Each bucket stores only numeric aggregate counters.
- No new permissions, external provider, messaging payload, or network request
  is introduced.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | `npm run test` covers counters, retention, seven-day summary, and scoped deletion. |
| Integration | `npm run validate`. |
| E2E | Manual popup and Chatwork smoke when available. |
| Platform | Unpacked extension reload smoke when available. |
| Release | Not required. |

## Harness Delta

None expected.

## Evidence

- `npm run test`: 81/81 pass, including aggregate-only counters, 90-day
  retention, seven-day summary, and scoped deletion.
- `npm run validate`: pass. `validate:data` retains one pre-existing suspicious
  external URL warning in `data/20241212.json`; JavaScript syntax checks pass.
