// E2E Test Suite for Chatwork Sticker Extension
// Tests are registered using global.test() and assert using global.assert.

// Helper to open the sticker panel and wait for render
async function openPanel() {
  const btn = document.querySelector("#_sticker");
  assert.ok(btn, "Sticker button should exist");
  btn.click();
  // Allow any requestAnimationFrame or microtasks to run
  await new Promise(resolve => setTimeout(resolve, 10));
}

// Helper to close the sticker panel
function closePanel() {
  global.closeStickerPanel();
}

// Helper to get visible sticker tiles
function getVisibleTiles() {
  const grid = document.querySelector('[data-role="sticker-results"]');
  if (!grid) return [];
  return Array.from(grid.querySelectorAll(".sticker-tile:not([disabled])"));
}

// Helper to get all sticker tiles (including disabled broken ones)
function getAllTiles() {
  const grid = document.querySelector('[data-role="sticker-results"]');
  if (!grid) return [];
  return Array.from(grid.querySelectorAll(".sticker-tile"));
}

// Helper to clear chat text area
function clearChat() {
  const chatInput = document.querySelector("#_chatText") || document.querySelector("textarea");
  if (chatInput) {
    chatInput.value = "";
  }
}

// Helper to get chat text area content
function getChatValue() {
  const chatInput = document.querySelector("#_chatText") || document.querySelector("textarea");
  return chatInput ? chatInput.value : "";
}

// Helper to trigger a search input event
async function triggerSearch(query) {
  const searchInput = document.querySelector("#stickerSearchInput");
  if (searchInput) {
    searchInput.value = query;
    const event = new Event("input", { bubbles: true });
    searchInput.dispatchEvent(event);
    // Allow debounce timer of 80ms in content.js to fire
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Helper to trigger keydown on active element
function triggerKeydown(key) {
  global.simulateKeydown(key);
}

// ==========================================
// TIER 1: FEATURE COVERAGE
// ==========================================

// --- FEATURE 1: RECENTS & FAVORITES STORAGE ---

test('Feature 1: Normalizing sticker URL and structures', () => {
  // Test normalizeSticker with standard items
  const item = {
    id: '[preview id=123 ht=100]',
    url: 'https://example.com/sticker.png',
    name: 'Test Sticker',
    tags: ['cool'],
    pack: 'test-pack'
  };
  const normalized = global.normalizeSticker(item);
  assert.ok(normalized, "Normalized object should exist");
  assert.equal(normalized.previewId, '123');
  assert.equal(normalized.height, 100);
  assert.equal(normalized.url, 'https://example.com/sticker.png');
  assert.equal(normalized.name, 'Test Sticker');
  assert.deepEqual(normalized.tags, ['cool']);
  assert.equal(normalized.pack, 'test-pack');
});

test('Feature 1: Loading stickers asynchronously from mocks', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  assert.ok(tiles.length > 0, "Should load stickers from file_list.json and pack files");
  const firstTile = tiles[0];
  assert.ok(firstTile.dataset.previewId, "Tiles should contain a previewId dataset attribute");
});

test('Feature 1: Switching between tabs (All, Recent, Favorite)', async () => {
  await openPanel();
  const panel = document.querySelector("#stickerPanel");
  const tabsContainer = panel.querySelector(".sticker-tabs-container");
  assert.ok(tabsContainer, "Tabs container should exist");
  
  const allTab = tabsContainer.querySelector(".sticker-tab-all");
  const recentTab = tabsContainer.querySelector(".sticker-tab-recent");
  const favoriteTab = tabsContainer.querySelector(".sticker-tab-favorite");
  
  assert.ok(allTab && recentTab && favoriteTab, "All three tabs should exist");
  
  // Recent tab click
  recentTab.click();
  assert.equal(global.activeTab, "recent", "Active tab should be recent");
  assert.deepEqual(getVisibleTiles(), [], "Recent tab should be empty initially");
  
  // All tab click
  allTab.click();
  assert.equal(global.activeTab, "all", "Active tab should be all");
  assert.ok(getVisibleTiles().length > 0, "All tab should show stickers");
});

test('Feature 1: Adding a sticker to Recents (uniqueness and top priority)', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const firstTile = tiles[0];
  const firstSticker = global.currentStickers.find(s => s.previewId === firstTile.dataset.previewId);
  
  // Insert sticker by clicking tile
  firstTile.click();
  assert.equal(global.recents.length, 1, "Recents should have 1 item");
  assert.equal(global.recents[0].previewId, firstSticker.previewId, "First recent should be the inserted sticker");
  
  // Insert second sticker
  await openPanel();
  const secondTile = getVisibleTiles()[1];
  const secondSticker = global.currentStickers.find(s => s.previewId === secondTile.dataset.previewId);
  secondTile.click();
  
  assert.equal(global.recents.length, 2);
  assert.equal(global.recents[0].previewId, secondSticker.previewId, "Second inserted sticker should be at the top");
  
  // Re-insert first sticker
  await openPanel();
  const originalFirstTileInGrid = getVisibleTiles().find(t => t.dataset.previewId === firstSticker.previewId);
  originalFirstTileInGrid.click();
  
  assert.equal(global.recents.length, 2, "Recents should remain unique (length 2)");
  assert.equal(global.recents[0].previewId, firstSticker.previewId, "Re-inserted sticker should move back to top");
});

test('Feature 1: Toggling favorite status via the favorite star/pin icon', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const firstTile = tiles[0];
  const previewId = firstTile.dataset.previewId;
  
  const favBtn = firstTile.querySelector(".favorite-btn");
  assert.ok(favBtn, "Favorite button must exist on the tile");
  assert.equal(favBtn.textContent, "☆", "Should be unfilled initially");
  
  // Toggle favorite on
  favBtn.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(global.favorites.has(previewId), "Should be added to favorites");
  assert.equal(favBtn.textContent, "★", "Should show filled star");
  
  // Switch to Favorite tab and verify visibility
  const favoriteTabBtn = document.querySelector(".sticker-tab-favorite");
  favoriteTabBtn.click();
  const favTiles = getVisibleTiles();
  assert.equal(favTiles.length, 1);
  assert.equal(favTiles[0].dataset.previewId, previewId);
  
  // Toggle favorite off from favorite tab
  const activeFavBtn = favTiles[0].querySelector(".favorite-btn");
  activeFavBtn.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(!global.favorites.has(previewId), "Should be removed from favorites");
  assert.equal(getVisibleTiles().length, 0, "Favorite tab should now be empty");
});

// --- FEATURE 2: KEYBOARD NAVIGATION ---

test('Feature 2: Focusing search input when "/" is pressed', async () => {
  await openPanel();
  const chatInput = document.querySelector("#_chatText");
  chatInput.focus();
  assert.equal(document.activeElement, chatInput);
  
  // Press "/"
  triggerKeydown("/");
  const searchInput = document.querySelector("#stickerSearchInput");
  assert.equal(document.activeElement, searchInput, "Search input should be focused after pressing '/'");
});

test('Feature 2: Highlight/focus navigation using Arrow keys', async () => {
  await openPanel();
  const searchInput = document.querySelector("#stickerSearchInput");
  searchInput.focus();
  
  // Press ArrowRight to focus first tile
  triggerKeydown("ArrowRight");
  const tiles = getVisibleTiles();
  assert.equal(document.activeElement, tiles[0], "ArrowRight from search should focus first tile");
  assert.ok(tiles[0].classList.contains("highlighted"), "Should have highlighted class");
  
  // Press ArrowRight again
  triggerKeydown("ArrowRight");
  assert.equal(document.activeElement, tiles[1], "ArrowRight should move focus to next tile");
  
  // Press ArrowLeft
  triggerKeydown("ArrowLeft");
  assert.equal(document.activeElement, tiles[0], "ArrowLeft should move focus back to first tile");
  
  // Press ArrowDown (column move, e.g. +4)
  triggerKeydown("ArrowDown");
  assert.equal(document.activeElement, tiles[4], "ArrowDown should move focus down 4 elements (next row)");
  
  // Press ArrowUp
  triggerKeydown("ArrowUp");
  assert.equal(document.activeElement, tiles[0], "ArrowUp should move focus up 4 elements");
});

test('Feature 2: Inserting sticker and closing panel on Enter', async () => {
  await openPanel();
  clearChat();
  
  const tiles = getVisibleTiles();
  const targetSticker = global.currentStickers.find(s => s.previewId === tiles[0].dataset.previewId);
  
  // Navigate to first element and press Enter
  tiles[0].focus();
  triggerKeydown("Enter");
  
  assert.equal(getChatValue().trim(), targetSticker.insertText, "Enter on tile should insert its markup");
  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.display, "none", "Panel should close after selection");
});

test('Feature 2: Closing panel on Escape', async () => {
  await openPanel();
  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.display, "flex");
  
  // Press Escape
  triggerKeydown("Escape");
  assert.equal(panel.style.display, "none", "Panel should be hidden on Escape");
});

test('Feature 2: Reopening panel preserves rendered sticker DOM', async () => {
  await openPanel();
  const firstTile = getAllTiles()[0];
  assert.ok(firstTile, "Panel should contain a rendered sticker tile");

  closePanel();
  await openPanel();

  assert.equal(getAllTiles()[0], firstTile, "Reopening should not recreate sticker tiles and images");
});

test('Feature 2: Panel left edge anchors to sticker button', async () => {
  const button = document.querySelector("#_sticker");
  button._rectLeft = 300;

  await openPanel();

  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.left, "300px", "Panel should start at the sticker button left edge");
});

test('Feature 2: Outside click closes panel', async () => {
  await openPanel();
  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.display, "flex");
  
  // Click outside (document.body)
  const event = new Event('click', { bubbles: true });
  document.body.dispatchEvent(event);
  assert.equal(panel.style.display, "none", "Outside click should close the panel");
});

// --- FEATURE 3: RANDOM STICKER INSERTION ---

test('Feature 3: Picker controls use accessible icons without a close button', async () => {
  await openPanel();
  const controls = [
    document.querySelector(".sticker-tab-all"),
    document.querySelector(".sticker-tab-recent"),
    document.querySelector(".sticker-tab-favorite"),
    document.querySelector(".sticker-random-button")
  ];

  controls.forEach((control) => {
    assert.ok(control, "Each picker control should be present");
    assert.ok(control.innerHTML.includes("<svg"), "Each picker control should render an SVG icon");
    assert.ok(control.getAttribute("aria-label"), "Each icon control should have an accessible label");
  });

  const randomBtn = document.querySelector(".sticker-random-button");
  assert.equal(randomBtn.title, "Random");
  assert.equal(document.querySelector(".sticker-close-button"), null, "Redundant close button should be removed");
});

test('Feature 3: Picking and inserting random sticker from All tab', async () => {
  await openPanel();
  clearChat();
  
  const randomBtn = document.querySelector(".sticker-random-button");
  randomBtn.click();
  
  const value = getChatValue().trim();
  assert.ok(value.startsWith("[preview") && value.endsWith("]"), "Should insert a valid preview markup");
  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.display, "none", "Panel should close after random insertion");
});

test('Feature 3: Picking and inserting random sticker from Favorite tab', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const favSticker = global.currentStickers.find(s => s.previewId === tiles[2].dataset.previewId);
  
  // Favorite the 3rd sticker
  tiles[2].querySelector(".favorite-btn").click();
  
  // Switch to favorite tab
  document.querySelector(".sticker-tab-favorite").click();
  clearChat();
  
  // Click Random
  document.querySelector(".sticker-random-button").click();
  assert.equal(getChatValue().trim(), favSticker.insertText, "Random on favorite tab with 1 item should insert that exact sticker");
});

test('Feature 3: Picking and inserting random sticker from Recent tab', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const recentSticker = global.currentStickers.find(s => s.previewId === tiles[1].dataset.previewId);
  
  // Click second sticker to make it recent
  tiles[1].click();
  
  await openPanel();
  document.querySelector(".sticker-tab-recent").click();
  clearChat();
  
  // Click Random
  document.querySelector(".sticker-random-button").click();
  assert.equal(getChatValue().trim(), recentSticker.insertText, "Random on Recent tab with 1 item should insert that exact sticker");
});

test('Feature 3: Random button closes panel after insertion', async () => {
  await openPanel();
  document.querySelector(".sticker-random-button").click();
  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.display, "none", "Panel should close");
});

// --- FEATURE 4: LAZY LOADING & IMAGE ERROR ---

test('Feature 4: Observed images load immediately after entering the viewport queue', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const img = tiles[0].querySelector("img");
  assert.ok(img, "Tile should contain an image element");
  assert.equal(img.getAttribute("loading"), "eager", "IntersectionObserver already controls deferred loading");
});

test('Feature 4: Broken image triggers error handler', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const badTile = tiles[0];
  const previewId = badTile.dataset.previewId;
  const badImg = badTile.querySelector("img");
  
  // Simulate image load error
  badImg.simulateError();
  
  assert.ok(global.brokenStickerPreviewIds.has(previewId), "Should add previewId to broken Set");
  assert.ok(badTile.disabled, "Broken tile should be disabled");
  assert.ok(badTile.classList.contains("is-broken"), "Broken tile should have is-broken class");
});

test('Feature 4: Broken image does not leak raw preview markup', async () => {
  await openPanel();
  const badTile = getVisibleTiles()[0];
  const badImg = badTile.querySelector("img");
  
  badImg.simulateError();
  
  // Alt or placeholder check
  const placeholder = badTile.querySelector(".sticker-placeholder");
  assert.ok(placeholder, "Should render a placeholder");
  assert.equal(placeholder.textContent, "Image unavailable");
  assert.ok(!badTile.textContent.includes("[preview"), "Must not leak raw preview markup");
});

test('Feature 4: Lazy loading IntersectionObserver integration', () => {
  // Verify global IntersectionObserver is mocked
  assert.ok(global.IntersectionObserver, "IntersectionObserver must be mocked");
  const observer = new global.IntersectionObserver(() => {});
  assert.ok(typeof observer.observe === "function", "Observer must have observe function");
});

test('Feature 4: Preloads the first 20 images and defers the rest to viewport observation', async () => {
  const tiles = getAllTiles();
  assert.ok(tiles.length > 20, "Test data should contain more than 20 stickers");

  await new Promise(resolve => setTimeout(resolve, 20));

  const firstTwenty = tiles.slice(0, 20);
  firstTwenty.forEach((tile) => {
    assert.ok(
      ["queued", "loading", "loaded"].includes(tile.dataset.imageState),
      "The first 20 stickers should be scheduled without opening the picker"
    );
  });
});

test('Feature 4: Shows a loading icon while an image request is pending', () => {
  const tile = document.createElement("button");
  tile.dataset.imageState = "idle";
  document.body.appendChild(tile);

  global.queueStickerImage(tile, {
    previewId: "pending-image",
    url: "https://www.chatwork.com/pending-image",
  }, -1);

  assert.ok(tile.querySelector(".sticker-loading"), "Pending image should render a loading icon");
});

test('Feature 4: Image queue never exceeds five concurrent requests', () => {
  assert.ok(
    global.maxObservedStickerImageLoads <= 5,
    `Expected at most 5 active image requests, got ${global.maxObservedStickerImageLoads}`
  );
});

test('Feature 4: Broken images are excluded from next render', async () => {
  await openPanel();
  const tilesBefore = getVisibleTiles();
  const firstPreviewId = tilesBefore[0].dataset.previewId;
  
  // Mark first tile as broken
  tilesBefore[0].querySelector("img").simulateError();
  
  // Re-open and check list
  closePanel();
  await openPanel();
  
  const tilesAfter = getVisibleTiles();
  assert.ok(!tilesAfter.some(t => t.dataset.previewId === firstPreviewId), "Broken sticker should be filtered out");
});

// ==========================================
// TIER 2: BOUNDARY/CORNER CASES
// ==========================================

// --- FEATURE 1 BOUNDARY ---

test('Boundary 1: Recents list truncation exactly at 20 items', async () => {
  await openPanel();
  const allStickers = [...global.currentStickers];
  
  // Insert 25 stickers sequentially
  for (let i = 0; i < 25; i++) {
    global.addToRecents(allStickers[i]);
  }
  
  assert.equal(global.recents.length, 20, "Recents list must be truncated exactly at 20");
  assert.equal(global.recents[0].previewId, allStickers[24].previewId, "Top item should be the most recently added");
  assert.equal(global.recents[19].previewId, allStickers[5].previewId, "Oldest item retained should be the 6th item (index 5)");
});

test('Boundary 1: Empty storage recovery', async () => {
  await chrome.storage.local.clear();
  closePanel();
  
  // Open again, should initialize without crash
  await openPanel();
  assert.equal(global.recents.length, 0);
  assert.equal(global.favorites.size, 0);
});

test('Boundary 1: Corrupted cache JSON in localStorage recovery', async () => {
  localStorage.setItem("sticker_cache_v2", "{invalid-json}");
  const stickers = await global.loadStickers();
  assert.ok(stickers.length > 0, "Should recover and load stickers from fetch despite invalid JSON cache");
});

test('Boundary 1: Normalizing invalid sticker objects', () => {
  assert.equal(global.normalizeSticker(null), null);
  assert.equal(global.normalizeSticker({}), null);
  assert.equal(global.normalizeSticker({ url: 'https://example.com' }), null, "Missing previewId/id");
  assert.equal(global.normalizeSticker({ id: '[preview id=123 ht=100]' }), null, "Missing URL");
});

test('Boundary 1: Normalizing URL with missing protocols', () => {
  const item = {
    id: '[preview id=123 ht=100]',
    url: 'data/sticker.png'
  };
  const normalized = global.normalizeSticker(item);
  assert.equal(normalized.url, 'https://www.chatwork.com/data/sticker.png', "Should resolve relative paths against chatwork origin");
  
  const externalItem = {
    id: '[preview id=456 ht=100]',
    url: 'https://cdn.anotherdomain.com/img.png'
  };
  const normalizedExt = global.normalizeSticker(externalItem);
  assert.equal(normalizedExt.url, 'https://cdn.anotherdomain.com/img.png', "Should preserve absolute external URLs");
});

// --- FEATURE 2 BOUNDARY ---

test('Boundary 2: Empty query search shows empty state', async () => {
  await openPanel();
  
  // Search for non-existent query
  await triggerSearch("xyz123nonsensequery");
  
  const tiles = getVisibleTiles();
  assert.equal(tiles.length, 0, "No stickers should be visible");
  
  const grid = document.querySelector('[data-role="sticker-results"]');
  const emptyState = grid.querySelector(".sticker-empty");
  assert.ok(emptyState, "Empty state paragraph should be rendered");
  assert.equal(emptyState.textContent, "No matching stickers.");
  
  // Clear search and verify it shows stickers again
  await triggerSearch("");
  assert.ok(getVisibleTiles().length > 0, "Stickers should reappear");
});

test('Boundary 2: Keyboard navigation on empty sticker grid', async () => {
  await openPanel();
  await triggerSearch("xyz123nonsensequery");
  
  // Press arrows, should not throw errors
  triggerKeydown("ArrowRight");
  triggerKeydown("ArrowDown");
  triggerKeydown("Enter");
  
  assert.equal(getChatValue(), "", "No sticker should be inserted");
});

test('Boundary 2: Keyboard navigation wrapping and boundaries', async () => {
  await openPanel();
  // Filter search so only 2 stickers are visible
  const s1 = global.currentStickers[0];
  const s2 = global.currentStickers[1];
  await triggerSearch(s1.name); // Filters to just a few
  
  const tiles = getVisibleTiles();
  if (tiles.length >= 2) {
    tiles[0].focus();
    
    // Move past the end
    for (let i = 0; i < tiles.length + 2; i++) {
      triggerKeydown("ArrowRight");
    }
    
    // Focus should be on some tile (wrapping works or stays in bounds)
    assert.ok(document.activeElement.classList.contains("sticker-tile"));
  }
});

test('Boundary 2: Escape key on already closed panel', () => {
  closePanel();
  // Escape when already closed
  triggerKeydown("Escape");
  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.display, "none", "Should remain closed");
});

test('Boundary 2: Pressing Enter on search input with no highlighted tile', async () => {
  await openPanel();
  clearChat();
  const searchInput = document.querySelector("#stickerSearchInput");
  searchInput.focus();
  
  triggerKeydown("Enter");
  assert.equal(getChatValue(), "", "Should not insert anything if no tile is highlighted");
});

// --- FEATURE 3 BOUNDARY ---

test('Boundary 3: Random button selection when active tab is empty', async () => {
  await openPanel();
  // Switch to Recent tab which has no items
  document.querySelector(".sticker-tab-recent").click();
  clearChat();
  
  // Click Random button
  const randomBtn = document.querySelector(".sticker-random-button");
  randomBtn.click();
  
  assert.equal(getChatValue(), "", "Should not insert anything when active tab has no stickers");
  const panel = document.querySelector("#stickerPanel");
  assert.equal(panel.style.display, "flex", "Panel should remain open");
});

test('Boundary 3: Random button selection on search empty state', async () => {
  await openPanel();
  await triggerSearch("xyz123nonsensequery");
  clearChat();
  
  document.querySelector(".sticker-random-button").click();
  assert.equal(getChatValue(), "", "Should not insert on empty search results");
});

test('Boundary 3: Random button selection when only one sticker is available', async () => {
  await openPanel();
  const target = global.currentStickers[0];
  await triggerSearch(target.name);
  clearChat();
  
  document.querySelector(".sticker-random-button").click();
  assert.equal(getChatValue().trim(), target.insertText, "Should insert the only matching sticker");
});

test('Boundary 3: Random selection when all stickers are broken', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  
  // Mark all visible tiles as broken
  tiles.forEach(tile => {
    const sticker = global.currentStickers.find((item) => item.previewId === tile.dataset.previewId);
    global.markStickerAsBroken(tile, sticker);
  });
  
  clearChat();
  document.querySelector(".sticker-random-button").click();
  assert.equal(getChatValue(), "", "Should not insert anything when all stickers are broken");
});

test('Boundary 3: Multiple clicks on Random button in rapid succession', async () => {
  await openPanel();
  clearChat();
  
  const randomBtn = document.querySelector(".sticker-random-button");
  randomBtn.click();
  randomBtn.click();
  randomBtn.click();
  
  assert.ok(getChatValue().length > 0, "Should insert sticker");
});

// --- FEATURE 4 BOUNDARY ---

test('Boundary 4: Image error handler on non-existent previewId', () => {
  // Should execute markStickerAsBroken safely even if DOM dataset properties are missing
  const dummyTile = document.createElement("button");
  const dummySticker = { previewId: "nonexistent", id: "123" };
  assert.ok(typeof global.markStickerAsBroken === "function");
  global.markStickerAsBroken(dummyTile, dummySticker);
  assert.ok(global.brokenStickerPreviewIds.has("nonexistent"));
  assert.ok(dummyTile.disabled);
});

test('Boundary 4: Lazy load image src resolution', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const img = tiles[0].querySelector("img");
  assert.ok(img.src.startsWith("https://www.chatwork.com/"), "Image source should load from Chatwork preview URL");
});

test('Boundary 4: brokenStickerPreviewIds persistence across panel toggle', async () => {
  await openPanel();
  const firstTile = getVisibleTiles()[0];
  const previewId = firstTile.dataset.previewId;
  
  // Trigger error
  firstTile.querySelector("img").simulateError();
  assert.ok(global.brokenStickerPreviewIds.has(previewId));
  
  // Toggle closed and open
  closePanel();
  await openPanel();
  
  const activeTiles = getVisibleTiles();
  assert.ok(!activeTiles.some(t => t.dataset.previewId === previewId), "Should remain excluded on open");
});

test('Boundary 4: Broken preview IDs persist in chrome storage', async () => {
  await openPanel();
  const firstTile = getVisibleTiles()[0];
  const previewId = firstTile.dataset.previewId;
  const sticker = global.currentStickers.find((item) => item.previewId === previewId);

  global.markStickerAsBroken(firstTile, sticker);
  await new Promise(resolve => setTimeout(resolve, 10));

  const stored = await chrome.storage.local.get("sticker_broken_preview_ids_v1");
  assert.ok(
    stored.sticker_broken_preview_ids_v1.includes(previewId),
    "Broken preview ID should survive a page refresh through chrome.storage.local"
  );
});

test('Boundary 4: Broken image elements replaced completely', async () => {
  await openPanel();
  const tile = getVisibleTiles()[0];
  tile.querySelector("img").simulateError();
  
  assert.equal(tile.querySelectorAll("img").length, 0, "img tag should be deleted");
  assert.ok(tile.querySelector(".sticker-placeholder"), "Placeholder element should replace it");
});

test('Boundary 4: Loading stickers fetch error recovery', async () => {
  // Intercept fetch to trigger status 404
  global.fetch = () => Promise.resolve({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: () => Promise.reject(new Error('404'))
  });
  
  localStorage.removeItem("sticker_cache_v2");
  
  const stickers = await global.loadStickers();
  assert.deepEqual(stickers, [], "Should fallback to empty array if fetch fails");
});

// --- FEATURE 5: POPUP DASHBOARD ---

function mountPopupDashboard() {
  const ids = [
    "stickerCount",
    "cacheState",
    "favoriteCount",
    "recentCount",
    "importedCount",
    "popupStatus",
    "uploadFile",
    "importName",
    "importTags",
    "importPack"
  ];
  ids.forEach((id) => {
    const inputIds = ["uploadFile", "importName", "importTags", "importPack"];
    const node = document.createElement(
      id === "popupStatus" ? "p" : inputIds.includes(id) ? "input" : "span"
    );
    node.id = id;
    document.body.appendChild(node);
  });
}

test('Feature 5: Popup dashboard summarizes storage state', async () => {
  await chrome.storage.local.set({
    sticker_cache_v2: [{ previewId: "1" }, { previewId: "2" }],
    sticker_favorites: ["1"],
    sticker_recents: [{ previewId: "2" }],
    sticker_imported_v1: [{ previewId: "3" }]
  });

  const summary = global.summarizeDashboard(await chrome.storage.local.get([
    "sticker_cache_v2",
    "sticker_favorites",
    "sticker_recents",
    "sticker_imported_v1"
  ]));

  assert.deepEqual(summary, {
    stickerCount: 2,
    favoriteCount: 1,
    recentCount: 1,
    importedCount: 1,
    cacheState: "Ready"
  });
});

test('Feature 5: Popup dashboard renders counts', async () => {
  mountPopupDashboard();
  await chrome.storage.local.set({
    sticker_cache_v2: [{ previewId: "1" }],
    sticker_favorites: ["1", "2"],
    sticker_recents: [{ previewId: "3" }],
    sticker_imported_v1: [{ previewId: "4" }]
  });

  await global.refreshDashboard();

  assert.equal(document.querySelector("#stickerCount").textContent, "1");
  assert.equal(document.querySelector("#cacheState").textContent, "Ready");
  assert.equal(document.querySelector("#favoriteCount").textContent, "2");
  assert.equal(document.querySelector("#recentCount").textContent, "1");
  assert.equal(document.querySelector("#importedCount").textContent, "1");
});

test('Feature 5: Popup clear cache keeps favorites and recents', async () => {
  mountPopupDashboard();
  await openPanel();
  await chrome.storage.local.set({
    sticker_favorites: ["fav-1"],
    sticker_recents: [{ previewId: "recent-1" }]
  });

  await global.clearStickerCacheFromPopup();
  const storage = await chrome.storage.local.get([
    "sticker_cache_v2",
    "sticker_favorites",
    "sticker_recents"
  ]);

  assert.equal(storage.sticker_cache_v2, undefined, "Sticker cache should be removed");
  assert.deepEqual(storage.sticker_favorites, ["fav-1"], "Favorites should remain");
  assert.deepEqual(storage.sticker_recents, [{ previewId: "recent-1" }], "Recents should remain");
  assert.equal(document.querySelector("#cacheState").textContent, "Empty");
});

test('Feature 5: Popup reload data refreshes sticker cache count', async () => {
  mountPopupDashboard();
  await openPanel();
  await chrome.storage.local.remove("sticker_cache_v2");

  await global.reloadStickerDataFromPopup();
  const storage = await chrome.storage.local.get("sticker_cache_v2");

  assert.ok(Array.isArray(storage.sticker_cache_v2), "Reload should store sticker cache");
  assert.ok(storage.sticker_cache_v2.length > 0, "Reload should load sticker data");
  assert.equal(document.querySelector("#stickerCount").textContent, String(storage.sticker_cache_v2.length));
  assert.ok(document.querySelector("#popupStatus").textContent.includes("Sticker data reloaded"));
});

test('Feature 6: Content script extracts file_id from Chatwork upload responses', () => {
  assert.equal(global.extractFileIdFromUploadResponse({ file_id: 9876543210 }), '9876543210');
  assert.equal(global.extractFileIdFromUploadResponse({ result: { fileId: '9876543211' } }), '9876543211');
  assert.equal(global.extractFileIdFromUploadResponse('{"file_id":"9876543212"}'), '9876543212');
  assert.equal(global.extractFileIdFromUploadResponse('[preview id=9876543213 ht=150]'), '9876543213');
});

test('Feature 6: Content script builds upload request from observed network config', async () => {
  await chrome.storage.local.set({
    chatwork_upload_config_v1: {
      url: 'https://www.chatwork.com/gateway/upload_file.php?preview=1',
      method: 'POST',
      fields: { room_id: 'old-room', token: 'abc' },
      fileField: 'upload_file'
    }
  });

  const config = (await chrome.storage.local.get('chatwork_upload_config_v1')).chatwork_upload_config_v1;
  const request = global.buildChatworkUploadRequest(config, {
    name: 'sticker.gif',
    type: 'image/gif',
    dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  });

  assert.equal(request.url, 'https://www.chatwork.com/gateway/upload_file.php?preview=1');
  assert.equal(request.options.method, 'POST');
  assert.ok(request.options.body, "Upload request should contain FormData body");
  assert.equal(request.options.credentials, 'include');
});

test('Feature 6: Popup uploads selected sticker through active Chatwork tab', async () => {
  mountPopupDashboard();
  await openPanel();

  document.querySelector("#importName").value = 'New upload';
  document.querySelector("#importTags").value = 'upload';
  document.querySelector("#importPack").value = 'upload-test';

  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    if (String(url).startsWith('chrome-extension://')) {
      return originalFetch(url, options);
    }
    assert.equal(url, 'https://www.chatwork.com/gateway/upload_file.php');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'include');
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('{"file_id":"9876543210"}')
    });
  };

  const result = await global.uploadStickerFilePayloadFromPopup({
    name: 'sticker.gif',
    type: 'image/gif',
    dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  }, {
    name: 'New upload',
    tags: ['upload'],
    pack: 'upload-test'
  });
  global.fetch = originalFetch;

  const storage = await chrome.storage.local.get(["sticker_imported_v1", "sticker_cache_v2"]);

  assert.ok(result.ok, "Import should succeed");
  assert.equal(storage.sticker_imported_v1[0].previewId, '9876543210');
  assert.ok(storage.sticker_cache_v2.some(s => s.previewId === '9876543210'), "Reloaded cache should include imported sticker");
  assert.ok(document.querySelector("#popupStatus").textContent.includes("Uploaded sticker 9876543210"));
});

test('Feature 6: Popup upload uses Chatwork signed storage flow when token is observed', async () => {
  mountPopupDashboard();
  await openPanel();
  await chrome.storage.local.set({
    chatwork_upload_config_v1: {
      url: 'https://www.chatwork.com/gateway/upload_file.php',
      method: 'POST',
      fields: { _t: 'token-123' },
      fileField: 'file'
    }
  });

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = (url, options = {}) => {
    const textUrl = String(url);
    if (textUrl.startsWith('chrome-extension://')) {
      return originalFetch(url, options);
    }

    calls.push({ url: textUrl, options });

    if (textUrl.includes('get_upload_file_info_sig_v4.php')) {
      assert.ok(String(options.body).includes('pdata='), "Signed upload info should send pdata");
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify({
          status: { success: true },
          result: {
            upload_info: [{
              acl: 'private',
              policy: 'policy',
              algorithm: 'AWS4-HMAC-SHA256',
              credential: 'credential',
              signature: 'signature',
              date: '20260708T000000Z',
              disposition: "attachment;filename*=UTF-8''signed.gif",
              redirect: 'gateway.php?cmd=upload_file_finish&room_id=232079630&file_id=5550002223&filename=signed.gif&extension=gif',
              uri: 'uploadfile/232079/232079630/signed.dat',
              auth_token: 'security-token'
            }]
          }
        }))
      });
    }

    if (textUrl === 'https://tky-chat-work-appdata.s3.ap-northeast-1.amazonaws.com/') {
      assert.equal(options.method, 'POST');
      assert.ok(options.body, "Storage upload should send FormData");
      return Promise.resolve({
        ok: true,
        status: 204,
        statusText: 'No Content',
        text: () => Promise.resolve('')
      });
    }

    if (textUrl.includes('upload_file_finish.php')) {
      assert.equal(options.method, 'POST');
      assert.ok(String(options.body).includes('pdata='), "Upload finish should send pdata");
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify({ status: { success: true }, result: {} }))
      });
    }

    throw new Error(`Unexpected fetch ${textUrl}`);
  };

  const result = await global.uploadStickerFilePayloadFromPopup({
    name: 'signed.gif',
    type: 'image/gif',
    dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  }, {
    name: 'Signed upload',
    tags: ['signed'],
    pack: 'upload-test'
  });
  global.fetch = originalFetch;

  const storage = await chrome.storage.local.get(["sticker_imported_v1", "sticker_cache_v2"]);

  assert.ok(result.ok, "Signed import should succeed");
  assert.equal(storage.sticker_imported_v1[0].previewId, '5550002223');
  assert.ok(storage.sticker_cache_v2.some(s => s.previewId === '5550002223'), "Reloaded cache should include signed imported sticker");
  assert.equal(calls.length, 3, "Signed upload should call info, storage, and finish endpoints");
});

test('Feature 6: Background observer ignores non-upload file query requests', async () => {
  await chrome.storage.local.set({
    chatwork_upload_config_v1: {
      url: "https://www.chatwork.com/gateway/get_room_info.php?load_file_version=2",
      method: "POST",
      fields: {},
      fileField: "file"
    }
  });

  chrome.webRequest.onBeforeRequest._trigger({
    method: "POST",
    url: "https://www.chatwork.com/gateway/get_room_info.php?load_file_version=2",
    requestBody: {
      formData: {
        pdata: ['{"_t":"room-token"}']
      }
    }
  });
  await new Promise(resolve => setTimeout(resolve, 0));

  let storage = await chrome.storage.local.get("chatwork_upload_config_v1");
  assert.equal(storage.chatwork_upload_config_v1.url, "https://www.chatwork.com/gateway/upload_file.php");
  assert.equal(storage.chatwork_upload_config_v1.fields._t, "room-token");
  assert.equal(storage.chatwork_upload_config_v1.fileField, "file");

  chrome.webRequest.onBeforeRequest._trigger({
    method: "POST",
    url: "https://www.chatwork.com/gateway/upload_file.php?preview=1",
    requestBody: {
      formData: {
        room_id: ["111"],
        token: ["network-token"],
        upload_file: [""]
      }
    }
  });

  storage = await chrome.storage.local.get("chatwork_upload_config_v1");
  assert.equal(storage.chatwork_upload_config_v1.url, "https://www.chatwork.com/gateway/upload_file.php?preview=1");
  assert.equal(storage.chatwork_upload_config_v1.fileField, "upload_file");
  assert.equal(storage.chatwork_upload_config_v1.fields.token, "network-token");
});

test('Feature 6: Upload sanitizes an invalid observed endpoint before direct fallback', async () => {
  mountPopupDashboard();
  await openPanel();
  await chrome.storage.local.set({
    chatwork_upload_config_v1: {
      url: "https://www.chatwork.com/gateway/get_room_info.php?load_file_version=2",
      method: "POST",
      fields: {},
      fileField: "file"
    }
  });

  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    if (String(url).startsWith("chrome-extension://")) {
      return originalFetch(url, options);
    }

    assert.equal(url, "https://www.chatwork.com/gateway/upload_file.php");
    assert.equal(options.method, "POST");
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve('{"file_id":"9876543211"}')
    });
  };

  const result = await global.uploadStickerFilePayloadFromPopup({
    name: "stale-config.gif",
    type: "image/gif",
    dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw="
  });
  global.fetch = originalFetch;

  assert.ok(result.ok, "Invalid observed endpoint should fall back to direct upload");
  assert.equal(result.sticker.previewId, "9876543211");
});

test('Feature 6: Upload import rejects duplicate uploaded sticker', async () => {
  mountPopupDashboard();
  await chrome.storage.local.set({
    sticker_cache_v2: [{
      previewId: "9876543210",
      id: "[preview id=9876543210 ht=150]",
      url: "https://www.chatwork.com/gateway/preview_file.php?bin=1&preview=1&file_id=9876543210"
    }]
  });

  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    if (String(url).startsWith('chrome-extension://')) {
      return originalFetch(url, options);
    }
    return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve('{"file_id":"9876543210"}')
    });
  };

  const result = await global.uploadStickerFilePayloadFromPopup({
    name: 'sticker.gif',
    type: 'image/gif',
    dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  });
  global.fetch = originalFetch;

  assert.equal(result.ok, false);
  assert.equal(result.error, "duplicate");
  assert.ok(document.querySelector("#popupStatus").textContent.includes("already exists"));
});

test('Feature 6 E2E: Observed upload config imports sticker and picker can insert it', async () => {
  mountPopupDashboard();
  await openPanel();

  chrome.webRequest.onBeforeRequest._trigger({
    method: "POST",
    url: "https://www.chatwork.com/gateway/upload_file.php?preview=1",
    requestBody: {
      formData: {
        room_id: ["111"],
        token: ["network-token"],
        upload_file: [""]
      }
    }
  });

  const observed = (await chrome.storage.local.get("chatwork_upload_config_v1")).chatwork_upload_config_v1;
  assert.equal(observed.url, "https://www.chatwork.com/gateway/upload_file.php?preview=1");
  assert.equal(observed.fields.room_id, "111");
  assert.equal(observed.fields.token, "network-token");
  assert.equal(observed.fileField, "upload_file");

  document.querySelector("#importName").value = "E2E upload";
  document.querySelector("#importTags").value = "e2e, upload";
  document.querySelector("#importPack").value = "upload-e2e";

  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    if (String(url).startsWith("chrome-extension://")) {
      return originalFetch(url, options);
    }

    assert.equal(url, "https://www.chatwork.com/gateway/upload_file.php?preview=1");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    assert.ok(options.body, "Upload should send a FormData body");

    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve('{"file_id":"5550001112"}')
    });
  };

  const result = await global.uploadStickerFilePayloadFromPopup({
    name: "e2e.gif",
    type: "image/gif",
    dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw="
  });
  global.fetch = originalFetch;

  assert.ok(result.ok, "Popup upload should succeed");
  assert.equal(result.sticker.previewId, "5550001112");

  const storage = await chrome.storage.local.get(["sticker_imported_v1", "sticker_cache_v2"]);
  assert.equal(storage.sticker_imported_v1[0].previewId, "5550001112");
  assert.ok(storage.sticker_cache_v2.some(sticker => sticker.previewId === "5550001112"), "Imported sticker should be in cache");
  assert.equal(document.querySelector("#importedCount").textContent, "1");
  assert.ok(document.querySelector("#popupStatus").textContent.includes("Uploaded sticker 5550001112"));

  closePanel();
  await openPanel();
  await triggerSearch("E2E upload");

  const importedTile = getVisibleTiles().find(tile => tile.dataset.previewId === "5550001112");
  assert.ok(importedTile, "Imported sticker should render in picker search results");

  clearChat();
  importedTile.click();
  assert.equal(getChatValue().trim(), "[preview id=5550001112 ht=150]");
});

// ==========================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ==========================================

test('Tier 3: Keyboard navigation after switching tabs', async () => {
  await openPanel();
  
  // Click first tile to put it in Recent
  const tiles = getVisibleTiles();
  const targetSticker = global.currentStickers.find(s => s.previewId === tiles[0].dataset.previewId);
  tiles[0].click();
  
  await openPanel();
  // Switch to Recent tab
  document.querySelector(".sticker-tab-recent").click();
  
  // Keydown ArrowRight
  const searchInput = document.querySelector("#stickerSearchInput");
  searchInput.focus();
  triggerKeydown("ArrowRight");
  
  const recentTiles = getVisibleTiles();
  assert.equal(document.activeElement, recentTiles[0], "Keyboard navigation should focus the tile in Recent tab");
  
  // Press Enter
  clearChat();
  triggerKeydown("Enter");
  assert.equal(getChatValue().trim(), targetSticker.insertText, "Enter key should work on Recent tab");
});

test('Tier 3: Searching while on Favorite tab', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  
  const s1 = global.currentStickers.find(s => s.previewId === tiles[0].dataset.previewId);
  const s2 = global.currentStickers.find(s => s.previewId === tiles[1].dataset.previewId);
  
  // Favorite both
  tiles[0].querySelector(".favorite-btn").click();
  tiles[1].querySelector(".favorite-btn").click();
  
  // Switch to Favorite tab
  document.querySelector(".sticker-tab-favorite").click();
  assert.equal(getVisibleTiles().length, 2, "Favorite tab should show both stickers");
  
  // Search for the first sticker's name specifically
  await triggerSearch(s1.name);
  
  const filtered = getVisibleTiles();
  assert.equal(filtered.length, 1, "Should filter favorites list by search query");
  assert.equal(filtered[0].dataset.previewId, s1.previewId);
});

test('Tier 3: Random selection from search-filtered results', async () => {
  await openPanel();
  const target = global.currentStickers[1];
  
  // Search to filter down to just this sticker
  await triggerSearch(target.name);
  clearChat();
  
  // Click random
  document.querySelector(".sticker-random-button").click();
  assert.equal(getChatValue().trim(), target.insertText, "Random button should pick from search-filtered set");
});

test('Tier 3: Adding sticker to Recents when selected from Favorite tab', async () => {
  await openPanel();
  const tiles = getVisibleTiles();
  const target = global.currentStickers.find(s => s.previewId === tiles[2].dataset.previewId);
  
  // Favorite
  tiles[2].querySelector(".favorite-btn").click();
  
  // Switch to Favorite tab and click it
  document.querySelector(".sticker-tab-favorite").click();
  getVisibleTiles()[0].click();
  
  // Check if added to recents
  assert.equal(global.recents.length, 1);
  assert.equal(global.recents[0].previewId, target.previewId, "Clicking a favorite should add it to recents");
});

test('Tier 3: Arrow navigation on search results, then toggling favorite status', async () => {
  await openPanel();
  const firstSticker = global.currentStickers[0];
  await triggerSearch(firstSticker.name);
  
  // Focus tile via arrows
  const searchInput = document.querySelector("#stickerSearchInput");
  searchInput.focus();
  triggerKeydown("ArrowRight");
  
  const focusedTile = document.activeElement;
  assert.ok(focusedTile.classList.contains("sticker-tile"));
  
  // Toggle favorite on focused element by clicking its favorite button
  focusedTile.querySelector(".favorite-btn").click();
  assert.ok(global.favorites.has(focusedTile.dataset.previewId));
});

// ==========================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS
// ==========================================

test('Tier 4 Scenario 1: Daily Chat Interaction', async () => {
  // Simulate actual workflow: Open panel, search, arrow down twice, press Enter
  await openPanel();
  
  // Search
  const search = document.querySelector("#stickerSearchInput");
  search.focus();
  await triggerSearch("sticker"); // filters list
  
  // Arrow Down twice
  triggerKeydown("ArrowDown"); // highlights 1st tile (index 0)
  triggerKeydown("ArrowDown"); // highlights 5th tile (index 4)
  
  const tiles = getVisibleTiles();
  const expectedSticker = global.currentStickers.find(s => s.previewId === tiles[4].dataset.previewId);
  
  clearChat();
  triggerKeydown("Enter"); // selects and inserts
  
  assert.equal(getChatValue().trim(), expectedSticker.insertText, "Should insert the 5th tile text");
  assert.equal(document.querySelector("#stickerPanel").style.display, "none", "Panel should be closed");
});

test('Tier 4 Scenario 2: Favorite and Reuse', async () => {
  // Workflow: Open panel, favorite a sticker, close, open, go to Favorite tab, click, check insertion
  await openPanel();
  const tiles = getVisibleTiles();
  const firstPreviewId = tiles[0].dataset.previewId;
  const sticker = global.currentStickers.find(s => s.previewId === firstPreviewId);
  
  // Favorite it
  tiles[0].querySelector(".favorite-btn").click();
  closePanel();
  
  // Re-open
  await openPanel();
  
  // Switch to Favorite tab
  document.querySelector(".sticker-tab-favorite").click();
  
  // Click first tile in favorite tab
  clearChat();
  getVisibleTiles()[0].click();
  
  assert.equal(getChatValue().trim(), sticker.insertText, "Should insert the favorited sticker");
});

test('Tier 4 Scenario 3: Cache Eviction and Recovery', async () => {
  // Workflow: user inserts 25 stickers, verifying recents limit is 20. Then cache reloaded, verify recents recovered.
  await openPanel();
  
  for (let i = 0; i < 25; i++) {
    global.addToRecents(global.currentStickers[i]);
  }
  
  assert.equal(global.recents.length, 20);
  
  // Simulate reload of panel
  closePanel();
  await openPanel();
  
  // Verify recents list is successfully recovered from storage and retains length 20
  assert.equal(global.recents.length, 20);
});

test('Tier 4 Scenario 4: Fast Navigation & Random Use', async () => {
  // Workflow: open panel, search, refocus search on '/', arrow right, click Random
  await openPanel();
  await triggerSearch("Sticker");
  
  const searchInput = document.querySelector("#stickerSearchInput");
  searchInput.focus();
  
  triggerKeydown("/"); // refocuses
  triggerKeydown("ArrowRight"); // highlights first
  
  clearChat();
  document.querySelector(".sticker-random-button").click();
  assert.ok(getChatValue().length > 0, "Random click should insert a sticker successfully");
});

test('Tier 4 Scenario 5: Error and Recovery flow', async () => {
  // Workflow: open panel, several image loads fail, search for a working one, arrow to it, insert
  await openPanel();
  
  const tiles = getVisibleTiles();
  // Make tiles 0, 1, 2 broken
  tiles[0].querySelector("img").simulateError();
  tiles[1].querySelector("img").simulateError();
  tiles[2].querySelector("img").simulateError();
  
  // Search for the 4th tile (now first visible/non-broken)
  const remainingTiles = getVisibleTiles();
  const targetSticker = global.currentStickers.find(s => s.previewId === remainingTiles[0].dataset.previewId);
  
  await triggerSearch(targetSticker.name);
  
  // Arrow to the target and insert
  const search = document.querySelector("#stickerSearchInput");
  search.focus();
  triggerKeydown("ArrowRight");
  
  clearChat();
  triggerKeydown("Enter");
  
  assert.equal(getChatValue().trim(), targetSticker.insertText, "Should recover and insert the correct non-broken sticker");
});
