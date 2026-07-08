# E2E Test Infra: Chatwork Sticker Chrome Extension

## Test Philosophy
- Opaque-box, requirement-driven. Mocks necessary browser and extension APIs to execute and verify content script logic in a Node environment.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|:---:|:---:|:---:|
| 1 | Recents & Favorites Storage | R1. Tabs System & Persistent Storage | 5 | 5 | ✓ |
| 2 | Keyboard Navigation | R2. Keyboard Navigation & Search Focus | 5 | 5 | ✓ |
| 3 | Random Sticker Insertion | R3. Random Sticker Insertion | 5 | 5 | ✓ |
| 4 | Lazy Loading & Image Error | R4. Lazy Loading & Image Error Handling | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner**: Node.js script executing test files located in `test/`. Runs with `npm run test`.
- **Mock Environment**: `test/mock-env.js` providing basic JSDOM-like mocks for window, document, DOM elements, Event, MutationObserver, chrome.storage.local, chrome.runtime, and fetch.
- **Directory Layout**:
  - `test/mock-env.js`: Browser and extension API mocks.
  - `test/run-tests.js`: Test execution runner reporting results.
  - `test/suite.js`: Test cases covering Tiers 1-4.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|---|---|---|
| 1 | Daily Chat Interaction | Open panel, search sticker, navigate via arrow keys, select and insert | Medium |
| 2 | Favorite and Reuse | Toggle favorite on a sticker, filter by Favorite tab, insert sticker | Medium |
| 3 | Cache Eviction & Recovery | Insert multiple stickers, verify recents list grows and truncates at 20 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total: 20 cases)
- Tier 2: ≥5 boundary conditions/corner cases per feature (Total: 20 cases)
- Tier 3: pairwise combinations of major features
- Tier 4: ≥5 realistic application scenarios
