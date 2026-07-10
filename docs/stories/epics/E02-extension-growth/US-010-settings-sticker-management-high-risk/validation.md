# Validation

## Proof Strategy

Automated tests prove filtering and ordering. Syntax/data validation proves the
extension package. Manual Chrome smoke remains needed for options-page drag UI.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | preference normalization, order, hide/trash filtering |
| Integration | popup/content storage behavior and package checks |
| E2E | Settings lifecycle in Chrome (manual) |
| Platform | Load-unpacked options page (manual) |

## Commands

```text
npm run test
npm run validate
```
