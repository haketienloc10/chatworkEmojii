const path = require('path');
const fs = require('fs');
const vm = require('vm');

// 1. Ensure mock environment is loaded and global variables are set
require('./mock-env');

// Registry for tests
const tests = [];
global.test = function(name, fn) {
  tests.push({ name, fn });
};

// Helper for assertions
global.assert = {
  ok(value, msg) {
    if (!value) throw new Error(`Assertion failed: expected truthy, got ${value}. ${msg || ''}`);
  },
  equal(actual, expected, msg) {
    if (actual !== expected) {
      const actStr = actual && typeof actual === 'object' && actual.tagName ? `${actual.tagName}#${actual.id || ''}.${actual.className || ''}` : String(actual);
      const expStr = expected && typeof expected === 'object' && expected.tagName ? `${expected.tagName}#${expected.id || ''}.${expected.className || ''}` : String(expected);
      throw new Error(`Assertion failed: expected ${expStr}, got ${actStr}. ${msg || ''}`);
    }
  },
  deepEqual(actual, expected, msg) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new Error(`Assertion failed: expected ${expStr}, got ${actStr}. ${msg || ''}`);
    }
  }
};

// 2. Load and evaluate content.js
const contentScriptPath = path.resolve(__dirname, '../scripts/content.js');
let contentScriptCode = fs.readFileSync(contentScriptPath, 'utf8');

// Expose script-scoped variables to the global context for tracking and validation in tests
contentScriptCode = contentScriptCode.replace(
  'const brokenStickerPreviewIds = new Set();',
  'global.brokenStickerPreviewIds = new Set(); var brokenStickerPreviewIds = global.brokenStickerPreviewIds;'
);
contentScriptCode = contentScriptCode.replace(
  'let currentStickers = [];',
  'global.currentStickers = []; var currentStickers = global.currentStickers;'
);
contentScriptCode = contentScriptCode.replace(
  'let stickerSearchQuery = "";',
  'global.stickerSearchQuery = ""; var stickerSearchQuery = global.stickerSearchQuery;'
);
contentScriptCode = contentScriptCode.replace(
  'let stickerSearchRenderTimer = null;',
  'global.stickerSearchRenderTimer = null; var stickerSearchRenderTimer = global.stickerSearchRenderTimer;'
);
contentScriptCode = contentScriptCode.replace(
  'let activeTab = "all";',
  'global.activeTab = "all"; var activeTab = global.activeTab;'
);
contentScriptCode = contentScriptCode.replace(
  'let favorites = new Set();',
  'global.favorites = new Set(); var favorites = global.favorites;'
);
contentScriptCode = contentScriptCode.replace(
  'let recents = [];',
  'global.recents = []; var recents = global.recents;'
);

// Evaluate code in global context
vm.runInThisContext(contentScriptCode);

// 3. Load background.js in an isolated scope so service-worker listeners are registered.
const backgroundScriptPath = path.resolve(__dirname, '../scripts/background.js');
const backgroundScriptCode = fs.readFileSync(backgroundScriptPath, 'utf8');
vm.runInThisContext(`(() => {\n${backgroundScriptCode}\n})();`);

// 4. Load popup.js so popup dashboard helpers can be tested in the same mock context
const popupScriptPath = path.resolve(__dirname, '../scripts/popup.js');
const popupScriptCode = fs.readFileSync(popupScriptPath, 'utf8');
vm.runInThisContext(popupScriptCode);

// 5. Load only the pure settings ordering helper, without registering Options-page listeners.
const settingsScriptPath = path.resolve(__dirname, '../scripts/settings.js');
const settingsScriptCode = fs.readFileSync(settingsScriptPath, 'utf8');
const settingsOrderHelper = settingsScriptCode.slice(
  settingsScriptCode.indexOf('function nextOrder'),
  settingsScriptCode.indexOf('function moveOrder')
);
vm.runInThisContext(`${settingsOrderHelper}\nglobal.settingsNextOrder = nextOrder;`);

// 6. Load suite.js which registers the tests
require('./suite');

// 7. Run tests sequentially
async function runAllTests() {
  console.log(`\n==================================================`);
  console.log(`🚀 Starting Chatwork Sticker Extension E2E Test Suite`);
  console.log(`==================================================`);
  console.log(`Found ${tests.length} tests to execute.\n`);
  
  let passedCount = 0;
  let failedCount = 0;
  const originalFetch = global.fetch;
  
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const testNum = i + 1;
    try {
      // Restore original fetch to prevent pollution
      global.fetch = originalFetch;
      
      // Complete reset for test isolation
      global.resetDOM();
      await chrome.storage.local.clear();
      localStorage.clear();
      
      // Let's initialize the extension
      global.addStickerButton();
      global.preloadStickerPanel();
      
      // Since preloadStickerPanel uses asynchronous fetch and storage calls, we wait a few ticks
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log(`[${testNum}/${tests.length}] ⏳ Running: ${t.name}`);
      
      await t.fn();
      
      console.log(`[${testNum}/${tests.length}] ✅ Passed: ${t.name}`);
      passedCount++;
    } catch (err) {
      console.error(`[${testNum}/${tests.length}] ❌ Failed: ${t.name}`);
      console.error(err.stack || err);
      failedCount++;
    }
  }
  
  console.log(`\n==================================================`);
  console.log(`📊 E2E Test Suite Results Summary:`);
  console.log(`==================================================`);
  console.log(`Total Run:  ${tests.length}`);
  console.log(`Passed:     ${passedCount}`);
  console.log(`Failed:     ${failedCount}`);
  console.log(`==================================================\n`);
  
  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run the tests
runAllTests().catch(err => {
  console.error("Unhandle test runner error:", err);
  process.exit(1);
});
