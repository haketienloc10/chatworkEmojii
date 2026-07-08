## 2026-07-08T06:02:53Z

You are a worker agent for the E2E Testing Track of the Chatwork Sticker Chrome Extension.
Your working directory is /home/locdt/chatworkEmojii/.agents/worker_e2e/.

Objective:
1. Create a Node.js-based automated testing environment for the extension in the `test/` folder.
2. In `test/mock-env.js`, implement a lightweight browser and Chrome Extension mock environment. It must support:
   - DOM manipulation APIs (`document.createElement`, `document.querySelector`, `document.querySelectorAll`, `document.body.appendChild`, `document.readyState`, etc.)
   - Event listeners (`document.addEventListener`, `window.addEventListener`, etc.)
   - Dispatched events (`new Event('input')`, `element.dispatchEvent`)
   - `MutationObserver` mock
   - `chrome.storage.local` API mock (storing data in memory)
   - `chrome.runtime` APIs mock (e.g. `chrome.runtime.getURL`, `chrome.runtime.onMessage`)
   - Mocking `fetch` to read from the actual `data/file_list.json` and json files under `data/` using Node's `fs` module, so the mock loads the real sticker data.
3. Write `test/suite.js` which includes 4 tiers of tests:
   - Tier 1: Feature coverage. Verify:
     - Normalizing sticker URL and structures.
     - Loading stickers asynchronously from mocks.
     - Switching between tabs ("All", "Recent", "Favorite").
     - Adding a sticker to Recents (up to 20, unique, moving to top if re-inserted).
     - Toggling favorite status via the favorite star/pin icon, and listing them in the Favorite tab.
     - Focusing search input when '/' is pressed.
     - Highlight/focus navigation using Arrow keys.
     - Inserting sticker and closing panel on Enter.
     - Closing panel on Escape.
     - Clicking "Random" sticker button in header, picking a random sticker from active tab, inserting it, and closing the panel.
   - Tier 2: Boundary/corner cases:
     - Empty query search behavior (showing no stickers vs showing empty text).
     - Recents list truncation exactly at 20 items.
     - Random button selection when active tab is empty.
     - Broken image error handler (rendering a disabled placeholder tile instead of broken image).
   - Tier 3: Cross-feature combinations (e.g. keyboard navigation after switching tabs, searching while on favorite/recent tab, random selection from filtered results).
   - Tier 4: Real-world application scenarios (simulate actual sequence: open panel, search, arrow down twice, press enter).
4. Create a test runner script `test/run-tests.js` that loads `test/mock-env.js`, imports/executes the content script `scripts/content.js` (or simulates its functions) and runs the test suites, reporting results and exit codes.
5. Add a `"test"` script to `package.json` that runs `node test/run-tests.js`.
6. Write `TEST_READY.md` at the project root following the template specified in `_harness/HARNESS.md` / `PROJECT.md` showing the test runner command and coverage inventory.

Scope Boundaries:
- Do not edit any files in `scripts/` (e.g., `scripts/content.js`). You can only read them.
- Do not create external dependencies in `package.json` (no npm installs), use native Node.js libraries to implement mocks (e.g. mock JSDOM APIs yourself since we are in offline CODE_ONLY mode).
- Do not announce your completion to the user directly, write handoff.md and call send_message to report your progress and outputs to parent conversation ID: 67ed0b37-d437-4177-bf2d-c0d77fad1078.

Please read ORIGINAL_REQUEST.md, TEST_INFRA.md, package.json, and scripts/content.js first. Update your progress.md inside /home/locdt/chatworkEmojii/.agents/worker_e2e/ to heartbeat.
