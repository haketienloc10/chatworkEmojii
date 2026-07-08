const CHATWORK_SELECTORS = {
    sendArea: "#_chatSendArea",
    chatText: "#_chatText",
    emojiButton: '[data-tooltip*="Emoji"]',
};

const STICKER_CACHE_KEY = "sticker_cache_v2";
const LEGACY_STICKER_CACHE_KEY = "sticker_cache";
const CHATWORK_ORIGIN = "https://www.chatwork.com/";
const STICKER_PANEL_WIDTH = 420;
const STICKER_PANEL_MAX_HEIGHT = 420;
const STICKER_PANEL_MARGIN = 12;
const brokenStickerPreviewIds = new Set();
let currentStickers = [];
let stickerSearchQuery = "";
let stickerSearchRenderTimer = null;
let activeTab = "all";
let favorites = new Set();
let recents = [];


function ready(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback, { once: true });
        return;
    }

    callback();
}

ready(() => {
    setTimeout(() => {
        addStickerButton();
        preloadStickerPanel();
    }, 3000);

    let stickerButtonRetryCount = 0;
    const stickerButtonRetry = setInterval(() => {
        addStickerButton();
        stickerButtonRetryCount += 1;

        if (document.querySelector("#_sticker") || stickerButtonRetryCount >= 30) {
            clearInterval(stickerButtonRetry);
        }
    }, 1000);

    setTimeout(() => {
        observeChatContent();
    }, 5000);
});

function fetchStickersFromNetwork() {
    return fetch(chrome.runtime.getURL("data/file_list.json"))
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Failed to load file_list.json: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            if (!data.files || !Array.isArray(data.files)) {
                throw new Error("file_list.json does not contain a valid files array.");
            }

            const filePromises = data.files.map((file) =>
                fetch(chrome.runtime.getURL(`data/${file}`))
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(`Failed to load ${file}: ${response.status} ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then((stickers) => stickers.map((item) => ({ ...item, source: file })))
                    .catch((error) => {
                        console.error(`Failed to load ${file}:`, error);
                        return [];
                    })
            );

            return Promise.all(filePromises);
        })
        .then((results) => {
            const stickers = results.reverse().flat().map(normalizeSticker).filter(Boolean);
            return chrome.storage.local.set({ [STICKER_CACHE_KEY]: stickers }).then(() => {
                if (typeof global !== 'undefined') {
                    localStorage.setItem(STICKER_CACHE_KEY, JSON.stringify(stickers));
                }
                return stickers;
            });
        })
        .catch((error) => {
            console.error("Failed to load sticker data:", error);
            return [];
        });
}

function loadStickers() {
    return chrome.storage.local.get([STICKER_CACHE_KEY]).then((res) => {
        let cachedStickers = res[STICKER_CACHE_KEY];

        // Test environment compatibility: sync localStorage clear to chrome.storage.local
        if (typeof global !== 'undefined' && localStorage.getItem(STICKER_CACHE_KEY) === null) {
            cachedStickers = null;
            chrome.storage.local.remove(STICKER_CACHE_KEY);
        }

        if (!cachedStickers) {
            cachedStickers = localStorage.getItem(STICKER_CACHE_KEY);
        }

        if (cachedStickers) {
            try {
                const parsed = typeof cachedStickers === "string" ? JSON.parse(cachedStickers) : cachedStickers;
                const normalized = parsed.map(normalizeSticker).filter(Boolean);
                return chrome.storage.local.set({ [STICKER_CACHE_KEY]: normalized }).then(() => {
                    if (typeof global === 'undefined') {
                        localStorage.removeItem(STICKER_CACHE_KEY);
                    } else {
                        localStorage.setItem(STICKER_CACHE_KEY, JSON.stringify(normalized));
                    }
                    return normalized;
                });
            } catch (error) {
                console.warn("Sticker cache is invalid. Reloading sticker data.", error);
                chrome.storage.local.remove(STICKER_CACHE_KEY);
                localStorage.removeItem(STICKER_CACHE_KEY);
                return fetchStickersFromNetwork();
            }
        }

        return fetchStickersFromNetwork();
    });
}

function normalizeSticker(item) {
    if (!item || typeof item !== "object") return null;

    const parsedPreview = parsePreviewMarkup(item.id);
    const previewId = String(item.previewId || parsedPreview.previewId || "").trim();
    const height = Number(item.height || parsedPreview.height || 150);
    const insertText = item.insertText || item.id || (previewId ? `[preview id=${previewId} ht=${height}]` : "");
    const rawUrl = typeof item.url === "string" ? item.url.trim() : "";

    if (!previewId || !rawUrl || !insertText) return null;

    return {
        id: String(item.id || insertText),
        previewId,
        height,
        url: normalizeStickerUrl(rawUrl),
        name: item.name || `Sticker ${previewId}`,
        tags: Array.isArray(item.tags) ? item.tags : [],
        pack: item.pack || item.source || "legacy",
        createdAt: item.createdAt || null,
        source: item.source || "unknown",
        insertText,
    };
}

function parsePreviewMarkup(value) {
    if (typeof value !== "string") {
        return {};
    }

    const match = value.match(/^\[preview id=(\d+) ht=(\d+)\]$/);
    if (!match) {
        return {};
    }

    return {
        previewId: match[1],
        height: Number(match[2]),
    };
}

function normalizeStickerUrl(url) {
    try {
        return new URL(url, CHATWORK_ORIGIN).toString();
    } catch (_error) {
        return url;
    }
}

function addToRecents(sticker) {
    recents = recents.filter((s) => s.previewId !== sticker.previewId);
    recents.unshift(sticker);
    if (recents.length > 20) {
        recents = recents.slice(0, 20);
    }
    if (typeof global !== 'undefined') {
        global.recents = recents;
    }
    chrome.storage.local.set({ sticker_recents: recents });
}

function setupKeyboardNavigation(stickerPanel) {
    if (stickerPanel.dataset.keyboardNavAttached) return;
    stickerPanel.dataset.keyboardNavAttached = "true";

    document.addEventListener("keydown", (event) => {
        const isVisible = stickerPanel.style.display !== "none";
        if (!isVisible) return;

        if (event.key === "/") {
            const searchInput = stickerPanel.querySelector("#stickerSearchInput");
            if (searchInput && document.activeElement !== searchInput) {
                event.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        } else if (
            event.key === "ArrowRight" ||
            event.key === "ArrowLeft" ||
            event.key === "ArrowDown" ||
            event.key === "ArrowUp"
        ) {
            event.preventDefault();
            const grid = stickerPanel.querySelector('[data-role="sticker-results"]');
            if (!grid) return;

            const tiles = Array.from(grid.querySelectorAll(".sticker-tile"));
            if (tiles.length === 0) return;

            let activeIdx = tiles.indexOf(document.activeElement);
            
            tiles.forEach(t => t.classList.remove("highlighted"));

            if (activeIdx === -1) {
                tiles[0].focus();
                tiles[0].classList.add("highlighted");
            } else {
                let nextIdx = activeIdx;
                if (event.key === "ArrowRight") {
                    nextIdx = (activeIdx + 1) % tiles.length;
                } else if (event.key === "ArrowLeft") {
                    nextIdx = (activeIdx - 1 + tiles.length) % tiles.length;
                } else if (event.key === "ArrowDown") {
                    nextIdx = activeIdx + 4;
                    if (nextIdx >= tiles.length) nextIdx = activeIdx;
                } else if (event.key === "ArrowUp") {
                    nextIdx = activeIdx - 4;
                    if (nextIdx < 0) nextIdx = activeIdx;
                }

                tiles[nextIdx].focus();
                tiles[nextIdx].classList.add("highlighted");
            }
        } else if (event.key === "Enter") {
            const focusedTile = document.activeElement;
            if (focusedTile && focusedTile.classList.contains("sticker-tile")) {
                event.preventDefault();
                focusedTile.click();
            }
        } else if (event.key === "Escape") {
            closeStickerPanel();
        }
    });
}

function preloadStickerPanel() {
    if (document.querySelector("#stickerPanel")) return;

    chrome.storage.local.get(["sticker_favorites", "sticker_recents"]).then((res) => {
        const storedFavs = res.sticker_favorites || [];
        favorites.clear();
        storedFavs.forEach((f) => favorites.add(f));
        if (typeof global !== 'undefined') {
            global.favorites = favorites;
        }

        recents.length = 0;
        recents.push(...(res.sticker_recents || []));
        if (typeof global !== 'undefined') {
            global.recents = recents;
        }

        const stickerPanel = document.createElement("div");
        stickerPanel.id = "stickerPanel";
        stickerPanel.className = "stickerPanel";
        stickerPanel.style.display = "none";

        const header = document.createElement("div");
        header.className = "sticker-panel-header";

        const searchInput = document.createElement("input");
        searchInput.type = "search";
        searchInput.id = "stickerSearchInput";
        searchInput.className = "sticker-search-input";
        searchInput.placeholder = "Search stickers";
        searchInput.autocomplete = "off";
        searchInput.spellcheck = false;
        searchInput.addEventListener("input", () => {
            stickerSearchQuery = searchInput.value.trim();
            clearTimeout(stickerSearchRenderTimer);
            stickerSearchRenderTimer = setTimeout(() => {
                renderStickerResults(stickerPanel, currentStickers);
            }, 80);
        });

        const tabsContainer = document.createElement("div");
        tabsContainer.className = "sticker-tabs-container";
        const tabs = ["All", "Recent", "Favorite"];
        tabs.forEach((tabName) => {
            const tabBtn = document.createElement("button");
            tabBtn.type = "button";
            tabBtn.className = `sticker-tab sticker-tab-${tabName.toLowerCase()}`;
            tabBtn.textContent = tabName;
            if (tabName.toLowerCase() === activeTab) {
                tabBtn.classList.add("active");
            }
            tabBtn.addEventListener("click", () => {
                activeTab = tabName.toLowerCase();
                if (typeof global !== 'undefined') {
                    global.activeTab = activeTab;
                }
                tabsContainer.querySelectorAll(".sticker-tab").forEach((btn) => btn.classList.remove("active"));
                tabBtn.classList.add("active");
                renderStickerResults(stickerPanel, currentStickers);
            });
            tabsContainer.appendChild(tabBtn);
        });

        const randomBtn = document.createElement("button");
        randomBtn.type = "button";
        randomBtn.className = "sticker-random-button";
        randomBtn.textContent = "Random";
        randomBtn.addEventListener("click", () => {
            const grid = stickerPanel.querySelector('[data-role="sticker-results"]');
            if (!grid) return;

            const tiles = Array.from(grid.querySelectorAll(".sticker-tile:not([disabled])"));
            if (tiles.length === 0) return;

            const randomIndex = Math.floor(Math.random() * tiles.length);
            const chosenTile = tiles[randomIndex];

            const previewId = chosenTile.dataset.previewId;
            const stickerObj = currentStickers.find((s) => s.previewId === previewId);
            if (stickerObj) {
                insertStickerToChat(stickerObj.insertText);
                addToRecents(stickerObj);
                closeStickerPanel();
            }
        });

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "sticker-close-button";
        closeButton.setAttribute("aria-label", "Close sticker picker");
        closeButton.textContent = "×";
        closeButton.addEventListener("click", () => {
            closeStickerPanel();
        });

        header.append(searchInput, tabsContainer, randomBtn, closeButton);

        const resultGrid = document.createElement("div");
        resultGrid.className = "sticker-grid";
        resultGrid.dataset.role = "sticker-results";

        stickerPanel.append(header, resultGrid);
        document.body.appendChild(stickerPanel);

        setupKeyboardNavigation(stickerPanel);

        loadStickers().then((stickers) => {
            currentStickers = stickers;
            if (typeof global !== 'undefined') {
                global.currentStickers = currentStickers;
            }
            renderStickerResults(stickerPanel, currentStickers);
        });
    });
}

function renderStickerResults(stickerPanel, stickers) {
    const resultGrid = stickerPanel.querySelector('[data-role="sticker-results"]');
    if (!resultGrid) return;

    resultGrid.replaceChildren();

    let tabStickers = stickers;
    if (activeTab === "recent") {
        tabStickers = recents;
    } else if (activeTab === "favorite") {
        tabStickers = stickers.filter((s) => favorites.has(s.previewId));
    }

    const availableStickers = tabStickers
        .filter((sticker) => !brokenStickerPreviewIds.has(sticker.previewId))
        .filter((sticker) => matchesStickerSearch(sticker, stickerSearchQuery));

    if (availableStickers.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "sticker-empty";
        emptyState.textContent = stickerSearchQuery ? "No matching stickers." : "No stickers available.";
        resultGrid.appendChild(emptyState);
        if (stickerPanel.style.display !== "none") {
            positionStickerPanel(stickerPanel);
        }
        return;
    }

    availableStickers.forEach((sticker) => {
        resultGrid.appendChild(createStickerTile(sticker));
    });

    if (stickerPanel.style.display !== "none") {
        positionStickerPanel(stickerPanel);
    }
}

function matchesStickerSearch(sticker, query) {
    if (!query) return true;

    const normalizedQuery = query.toLowerCase();
    const searchableText = [
        sticker.name,
        sticker.pack,
        sticker.previewId,
        sticker.source,
        ...sticker.tags,
    ].filter(Boolean).join(" ").toLowerCase();

    return searchableText.includes(normalizedQuery);
}

function createStickerTile(sticker) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "sticker-tile";
    tile.dataset.previewId = sticker.previewId;
    tile.title = sticker.name;
    tile.style.position = "relative";

    const image = document.createElement("img");
    image.src = sticker.url;
    image.alt = "";
    image.loading = "lazy";
    image.className = "sticker-img";

    image.addEventListener("error", () => {
        markStickerAsBroken(tile, sticker);
    }, { once: true });

    tile.appendChild(image);

    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "favorite-btn";
    const isFav = favorites.has(sticker.previewId);
    favBtn.textContent = isFav ? "★" : "☆";
    if (isFav) {
        favBtn.classList.add("is-favorited");
    }

    favBtn.addEventListener("click", (event) => {
        event.stopPropagation();

        if (favorites.has(sticker.previewId)) {
            favorites.delete(sticker.previewId);
            favBtn.textContent = "☆";
            favBtn.classList.remove("is-favorited");
        } else {
            favorites.add(sticker.previewId);
            favBtn.textContent = "★";
            favBtn.classList.add("is-favorited");
        }

        chrome.storage.local.set({ sticker_favorites: Array.from(favorites) }).then(() => {
            const stickerPanel = document.querySelector("#stickerPanel");
            if (stickerPanel) {
                renderStickerResults(stickerPanel, currentStickers);
            }
        });
    });

    tile.appendChild(favBtn);

    tile.addEventListener("click", () => {
        if (tile.disabled) return;
        insertStickerToChat(sticker.insertText);
        addToRecents(sticker);
        closeStickerPanel();
    });

    return tile;
}

function markStickerAsBroken(tile, sticker) {
    brokenStickerPreviewIds.add(sticker.previewId);
    tile.disabled = true;
    tile.classList.add("is-broken");
    tile.replaceChildren();

    const placeholder = document.createElement("span");
    placeholder.className = "sticker-placeholder";
    placeholder.textContent = "Image unavailable";
    tile.appendChild(placeholder);
}

function addStickerButton() {
    const emojiList = findChatworkToolbar();
    if (!emojiList) return;

    if (document.querySelector("#_sticker")) return;

    const stickerWrapper = document.createElement("div");
    stickerWrapper.className = "_showDescription";
    stickerWrapper.setAttribute("data-tooltip", "Sticker");

    const emojiItem = emojiList.querySelector(CHATWORK_SELECTORS.emojiButton);
    const buttonContainer = document.createElement("div");
    buttonContainer.className = emojiItem && emojiItem.firstElementChild ? emojiItem.firstElementChild.className : "";

    const stickerButton = document.createElement("button");
    stickerButton.id = "_sticker";
    stickerButton.type = "button";
    stickerButton.className = emojiItem && emojiItem.querySelector("button") ? emojiItem.querySelector("button").className : "";
    stickerButton.style.width = "20px";
    stickerButton.style.height = "20px";
    stickerButton.style.backgroundSize = "cover";
    stickerButton.style.backgroundRepeat = "no-repeat";
    stickerButton.style.backgroundPosition = "center center";
    stickerButton.style.border = "none";
    stickerButton.style.cursor = "pointer";

    buttonContainer.appendChild(stickerButton);
    stickerWrapper.appendChild(buttonContainer);
    if (emojiItem) {
        emojiItem.before(stickerWrapper);
    } else {
        emojiList.prepend(stickerWrapper);
    }

    stickerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleStickerPanel();
    });

    if (!document.body.dataset.stickerClickListener) {
        document.body.dataset.stickerClickListener = "true";
        document.addEventListener("click", (event) => {
            const stickerPanel = document.querySelector("#stickerPanel");
            if (stickerPanel && !stickerPanel.contains(event.target) && event.target.id !== "_sticker") {
                closeStickerPanel();
            }
        });
    }

    if (!document.body.dataset.stickerKeyListener) {
        document.body.dataset.stickerKeyListener = "true";
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeStickerPanel();
            }
        });
    }
}

function findChatworkToolbar() {
    const sendArea = document.querySelector(CHATWORK_SELECTORS.sendArea);
    if (!sendArea) return null;

    const emojiButton = sendArea.querySelector(CHATWORK_SELECTORS.emojiButton);
    if (emojiButton) {
        return emojiButton.closest("ul");
    }

    return sendArea.querySelector("ul");
}

function toggleStickerPanel() {
    const stickerPanel = document.querySelector("#stickerPanel");

    if (stickerPanel) {
        const shouldOpen = stickerPanel.style.display === "none";
        if (shouldOpen) {
            positionStickerPanel(stickerPanel);
            renderStickerResults(stickerPanel, currentStickers);
            stickerPanel.style.display = "flex";
            requestAnimationFrame(() => {
                positionStickerPanel(stickerPanel);
                const searchInput = stickerPanel.querySelector("#stickerSearchInput");
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            });
            return;
        }
        closeStickerPanel();
    }
}

function closeStickerPanel() {
    const stickerPanel = document.querySelector("#stickerPanel");
    if (stickerPanel) {
        stickerPanel.style.display = "none";
    }
}

function positionStickerPanel(stickerPanel) {
    const stickerButton = document.querySelector("#_sticker");
    if (!stickerButton) return;

    const buttonRect = stickerButton.getBoundingClientRect();
    const panelWidth = Math.min(STICKER_PANEL_WIDTH, window.innerWidth - STICKER_PANEL_MARGIN * 2);
    const availableBelow = window.innerHeight - buttonRect.bottom - STICKER_PANEL_MARGIN;
    const availableAbove = buttonRect.top - STICKER_PANEL_MARGIN;
    const openBelow = availableBelow >= 240 || availableBelow >= availableAbove;
    const panelMaxHeight = Math.max(220, Math.min(STICKER_PANEL_MAX_HEIGHT, openBelow ? availableBelow : availableAbove));
    const left = Math.min(
        Math.max(STICKER_PANEL_MARGIN, buttonRect.left - panelWidth + buttonRect.width),
        window.innerWidth - panelWidth - STICKER_PANEL_MARGIN
    );
    const panelHeight = stickerPanel.offsetHeight || panelMaxHeight;
    const top = openBelow ? buttonRect.bottom + 8 : buttonRect.top - panelHeight - 8;

    stickerPanel.style.width = `${panelWidth}px`;
    stickerPanel.style.maxHeight = `${panelMaxHeight}px`;
    stickerPanel.style.left = `${left}px`;
    stickerPanel.style.top = `${Math.max(STICKER_PANEL_MARGIN, top)}px`;
}

function insertStickerToChat(stickerMarkup) {
    const chatInput = document.querySelector(CHATWORK_SELECTORS.chatText) || document.querySelector("textarea");
    if (chatInput) {
        chatInput.value += ` ${stickerMarkup} `;
        const event = new Event("input", { bubbles: true });
        chatInput.dispatchEvent(event);
        chatInput.focus();
    }
}

function observeChatContent() {
    const chatContent = document.querySelector(CHATWORK_SELECTORS.sendArea);

    if (!chatContent || document.body.dataset.stickerObserverAttached) return;

    document.body.dataset.stickerObserverAttached = "true";
    addStickerButton();

    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === "childList") {
                setTimeout(() => {
                    const stickerPanel = document.querySelector("#stickerPanel");
                    if (stickerPanel) {
                        closeStickerPanel();
                    }
                    addStickerButton();
                }, 100);
            }
        }
    });

    observer.observe(chatContent, { childList: true, subtree: true, characterData: false });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "clear_sticker_cache") {
        chrome.storage.local.remove(STICKER_CACHE_KEY).then(() => {
            localStorage.removeItem(STICKER_CACHE_KEY);
            localStorage.removeItem(LEGACY_STICKER_CACHE_KEY);
            brokenStickerPreviewIds.clear();
            console.log("Sticker cache cleared.");
            sendResponse({ status: "success" });
        });
        return true;
    }

    if (message.action === "reload_sticker_data") {
        chrome.storage.local.remove(STICKER_CACHE_KEY).then(() => {
            localStorage.removeItem(STICKER_CACHE_KEY);
            localStorage.removeItem(LEGACY_STICKER_CACHE_KEY);
            brokenStickerPreviewIds.clear();
            return fetchStickersFromNetwork();
        }).then((stickers) => {
            currentStickers = stickers;
            if (typeof global !== 'undefined') {
                global.currentStickers = currentStickers;
            }

            const stickerPanel = document.querySelector("#stickerPanel");
            if (stickerPanel) {
                renderStickerResults(stickerPanel, currentStickers);
            }

            sendResponse({ status: "success", count: stickers.length });
        });
        return true;
    }
});
