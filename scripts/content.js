const CHATWORK_SELECTORS = {
    sendArea: "#_chatSendArea",
    chatText: "#_chatText",
    emojiButton: '[data-tooltip*="Emoji"]',
};

const STICKER_CACHE_KEY = "sticker_cache_v2";
const LEGACY_STICKER_CACHE_KEY = "sticker_cache";
const IMPORTED_STICKERS_KEY = "sticker_imported_v1";
const CHATWORK_UPLOAD_CONFIG_KEY = "chatwork_upload_config_v1";
const CHATWORK_ORIGIN = "https://www.chatwork.com/";
const CHATWORK_DEFAULT_UPLOAD_URL = "https://www.chatwork.com/gateway/upload_file.php";
const CHATWORK_SIGNED_UPLOAD_URL = "https://www.chatwork.com/gateway/get_upload_file_info_sig_v4.php";
const CHATWORK_STORAGE_UPLOAD_URL = "https://tky-chat-work-appdata.s3.ap-northeast-1.amazonaws.com/";
const STICKER_PANEL_WIDTH = 420;
const STICKER_PANEL_MAX_HEIGHT = 420;
const STICKER_PANEL_MARGIN = 12;
const UPLOAD_IMPORT_SOURCE = "chatwork-upload";
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

function fetchStaticStickersFromNetwork() {
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
            return results.reverse().flat().map(normalizeSticker).filter(Boolean);
        })
        .catch((error) => {
            console.error("Failed to load sticker data:", error);
            return [];
        });
}

function loadImportedStickers() {
    return chrome.storage.local.get(IMPORTED_STICKERS_KEY).then((res) => {
        const imported = res[IMPORTED_STICKERS_KEY];
        if (!Array.isArray(imported)) return [];
        return imported.map((item) => normalizeSticker({ ...item, source: item.source || "chatwork-upload" })).filter(Boolean);
    });
}

function mergeStickerLists(staticStickers, importedStickers) {
    const merged = [];
    const previewIds = new Set();

    [...importedStickers, ...staticStickers].forEach((sticker) => {
        if (!sticker || previewIds.has(sticker.previewId)) return;
        previewIds.add(sticker.previewId);
        merged.push(sticker);
    });

    return merged;
}

function saveStickerCache(stickers) {
    return chrome.storage.local.set({ [STICKER_CACHE_KEY]: stickers }).then(() => {
        if (typeof global !== 'undefined') {
            localStorage.setItem(STICKER_CACHE_KEY, JSON.stringify(stickers));
        }
        return stickers;
    });
}

function fetchStickersFromNetwork() {
    return Promise.all([fetchStaticStickersFromNetwork(), loadImportedStickers()])
        .then(([staticStickers, importedStickers]) => {
            const stickers = mergeStickerLists(staticStickers, importedStickers);
            return saveStickerCache(stickers);
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
                return loadImportedStickers().then((importedStickers) => mergeStickerLists(normalized, importedStickers)).then((merged) => {
                    return chrome.storage.local.set({ [STICKER_CACHE_KEY]: merged }).then(() => {
                        if (typeof global === 'undefined') {
                            localStorage.removeItem(STICKER_CACHE_KEY);
                        } else {
                            localStorage.setItem(STICKER_CACHE_KEY, JSON.stringify(merged));
                        }
                        return merged;
                    });
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

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function defaultUploadPackName() {
    return `upload-${todayString().replace(/-/g, "")}`;
}

function getKnownStickerPreviewIds(storageData) {
    const ids = new Set();
    [storageData[STICKER_CACHE_KEY], storageData[IMPORTED_STICKERS_KEY], currentStickers].forEach((items) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
            const normalized = normalizeSticker(item);
            if (normalized && normalized.previewId) {
                ids.add(normalized.previewId);
            }
        });
    });
    return ids;
}

function getCurrentRoomId() {
    const hashMatch = window.location && String(window.location.hash || "").match(/rid(\d+)/);
    if (hashMatch) return hashMatch[1];

    const pathMatch = window.location && String(window.location.href || "").match(/[?&#/]rid(?:=|\/)?(\d+)/);
    return pathMatch ? pathMatch[1] : "";
}

function getChatworkUploadConfig() {
    return chrome.storage.local.get(CHATWORK_UPLOAD_CONFIG_KEY).then((res) => {
        const config = res[CHATWORK_UPLOAD_CONFIG_KEY];
        if (!config || typeof config !== "object") {
            return {
                url: CHATWORK_DEFAULT_UPLOAD_URL,
                method: "POST",
                fields: {},
                fileField: "file",
            };
        }

        return {
            url: config.url || CHATWORK_DEFAULT_UPLOAD_URL,
            method: config.method || "POST",
            fields: config.fields && typeof config.fields === "object" ? config.fields : {},
            fileField: config.fileField || "file",
        };
    });
}

function dataUrlToBlob(filePayload) {
    if (!filePayload || typeof filePayload.dataUrl !== "string") {
        throw new Error("Missing upload file data.");
    }

    const parts = filePayload.dataUrl.split(",");
    if (parts.length < 2) {
        throw new Error("Upload file data must be a data URL.");
    }

    const meta = parts[0];
    const base64 = parts.slice(1).join(",");
    const mimeMatch = meta.match(/^data:([^;]+);base64$/);
    const mimeType = filePayload.type || (mimeMatch && mimeMatch[1]) || "application/octet-stream";
    const binary = typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("binary");
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
}

function buildChatworkUploadRequest(config, filePayload) {
    const uploadConfig = config || {};
    const formData = new FormData();
    const fields = uploadConfig.fields && typeof uploadConfig.fields === "object" ? uploadConfig.fields : {};
    const roomId = getCurrentRoomId();
    let hasRoomId = false;

    Object.keys(fields).forEach((key) => {
        const value = key === "room_id" && roomId ? roomId : fields[key];
        if (key === "room_id") hasRoomId = true;
        formData.append(key, value);
    });

    if (roomId && !hasRoomId) {
        formData.append("room_id", roomId);
    }

    const blob = dataUrlToBlob(filePayload);
    formData.append(uploadConfig.fileField || "file", blob, filePayload.name || "sticker-upload");

    return {
        url: uploadConfig.url || CHATWORK_DEFAULT_UPLOAD_URL,
        options: {
            method: uploadConfig.method || "POST",
            body: formData,
            credentials: "include",
        },
    };
}

function getUploadToken(config) {
    const fields = config && config.fields && typeof config.fields === "object" ? config.fields : {};
    return typeof fields._t === "string" ? fields._t : "";
}

function parseChatworkJsonResponse(text) {
    try {
        return JSON.parse(text);
    } catch (_error) {
        return null;
    }
}

function assertChatworkSuccess(payload, fallbackMessage) {
    if (payload && payload.status && payload.status.success === true) return;

    const message = payload && payload.status && payload.status.message
        ? Array.isArray(payload.status.message) ? payload.status.message.join(", ") : payload.status.message
        : fallbackMessage;
    throw new Error(message || "Chatwork upload failed.");
}

function buildSignedUploadInfoRequest(filePayload, blob, config) {
    const roomId = getCurrentRoomId();
    const token = getUploadToken(config);
    if (!roomId || !token) return null;

    const body = new URLSearchParams();
    body.set("pdata", JSON.stringify({
        list: [{
            key: 0,
            name: filePayload.name || "sticker-upload",
            size: blob.size,
            message: "",
        }],
        noredirect: true,
        region: "tokyo",
        _t: token,
    }));

    return {
        url: `${CHATWORK_SIGNED_UPLOAD_URL}?room_id=${encodeURIComponent(roomId)}`,
        options: {
            method: "POST",
            body: body.toString(),
            credentials: "include",
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
        },
    };
}

function requestSignedUploadInfo(filePayload, blob, config) {
    const request = buildSignedUploadInfoRequest(filePayload, blob, config);
    if (!request) return Promise.resolve(null);

    return fetch(request.url, request.options)
        .then((response) => response.text().then((text) => ({ response, text })))
        .then(({ response, text }) => {
            if (!response.ok) {
                throw new Error(`Chatwork signed upload failed: ${response.status} ${response.statusText}`);
            }

            const payload = parseChatworkJsonResponse(text);
            assertChatworkSuccess(payload, "Chatwork signed upload did not return upload info.");
            const uploadInfo = payload.result && Array.isArray(payload.result.upload_info)
                ? payload.result.upload_info[0]
                : null;
            if (!uploadInfo || !uploadInfo.uri || !uploadInfo.redirect) {
                throw new Error("Chatwork signed upload response did not contain upload info.");
            }
            return uploadInfo;
        });
}

function buildStorageUploadFormData(uploadInfo, storageBlob, filePayload) {
    const formData = new FormData();
    formData.append("key", uploadInfo.uri);
    formData.append("acl", uploadInfo.acl || "private");
    formData.append("Content-Type", "application/octet-stream");
    formData.append("Content-Disposition", uploadInfo.disposition || `attachment;filename*=UTF-8''${encodeURIComponent(filePayload.name || "sticker-upload")}`);
    formData.append("x-amz-server-side-encryption", "AES256");
    formData.append("policy", uploadInfo.policy);
    formData.append("x-amz-algorithm", uploadInfo.algorithm || "AWS4-HMAC-SHA256");
    formData.append("x-amz-credential", uploadInfo.credential);
    formData.append("x-amz-date", uploadInfo.date);
    formData.append("x-amz-signature", uploadInfo.signature);
    formData.append("x-amz-security-token", uploadInfo.auth_token);
    formData.append("file", storageBlob, filePayload.name || "sticker-upload");
    return formData;
}

function uploadToSignedStorage(uploadInfo, blob, filePayload) {
    return blob.arrayBuffer()
        .then((buffer) => new Blob([buffer], { type: "application/octet-stream" }))
        .then((storageBlob) => fetch(CHATWORK_STORAGE_UPLOAD_URL, {
            method: "POST",
            body: buildStorageUploadFormData(uploadInfo, storageBlob, filePayload),
        }))
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Chatwork storage upload failed: ${response.status} ${response.statusText}`);
            }
            return uploadInfo;
        });
}

function buildSignedUploadFinishUrl(uploadInfo) {
    const redirect = String(uploadInfo.redirect || "");
    const path = redirect.replace(/^gateway\.php\?cmd=upload_file_finish&?/, "upload_file_finish.php?");
    return `https://www.chatwork.com/gateway/${path}`;
}

function finishSignedUpload(uploadInfo, config) {
    const body = new URLSearchParams();
    body.set("pdata", JSON.stringify({ with_message: "0", _t: getUploadToken(config) }));

    return fetch(buildSignedUploadFinishUrl(uploadInfo), {
        method: "POST",
        body: body.toString(),
        credentials: "include",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    })
        .then((response) => response.text().then((text) => ({ response, text })))
        .then(({ response, text }) => {
            if (!response.ok) {
                throw new Error(`Chatwork upload finish failed: ${response.status} ${response.statusText}`);
            }
            assertChatworkSuccess(parseChatworkJsonResponse(text), "Chatwork upload finish failed.");
            const fileId = extractFileIdFromUploadResponse(uploadInfo.redirect);
            if (!fileId) {
                throw new Error("Chatwork signed upload response did not contain file_id.");
            }
            return fileId;
        });
}

function uploadChatworkStickerFileSigned(filePayload, config) {
    const blob = dataUrlToBlob(filePayload);
    return requestSignedUploadInfo(filePayload, blob, config)
        .then((uploadInfo) => {
            if (!uploadInfo) return null;
            return uploadToSignedStorage(uploadInfo, blob, filePayload)
                .then(() => finishSignedUpload(uploadInfo, config));
        });
}

function extractFileIdFromUploadResponse(value) {
    if (!value) return "";

    if (typeof value === "object") {
        const direct = value.file_id || value.fileId || value.id;
        if (direct && /^\d+$/.test(String(direct))) return String(direct);

        for (const key of Object.keys(value)) {
            const nested = extractFileIdFromUploadResponse(value[key]);
            if (nested) return nested;
        }
        return "";
    }

    const text = String(value);
    const patterns = [
        /"file_id"\s*:\s*"?(\d+)"?/,
        /file_id[=&:]\s*(\d+)/,
        /\[preview id=(\d+) ht=\d+\]/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }

    return "";
}

function buildUploadedStickerFromFileId(fileId, metadata = {}) {
    const previewId = String(fileId || "").trim();
    if (!previewId) return null;

    const height = Number(metadata.height || 150);

    return {
        previewId,
        id: `[preview id=${previewId} ht=${height}]`,
        url: `https://www.chatwork.com/gateway/preview_file.php?bin=1&preview=1&file_id=${previewId}`,
        height,
        name: metadata.name || `Uploaded sticker ${previewId}`,
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        pack: metadata.pack || defaultUploadPackName(),
        createdAt: metadata.createdAt || todayString(),
        source: UPLOAD_IMPORT_SOURCE,
    };
}

function saveImportedSticker(sticker) {
    if (!sticker) {
        return Promise.resolve({ ok: false, error: "invalid_sticker" });
    }

    return chrome.storage.local.get([STICKER_CACHE_KEY, IMPORTED_STICKERS_KEY]).then((storageData) => {
        const knownPreviewIds = getKnownStickerPreviewIds(storageData);
        if (knownPreviewIds.has(sticker.previewId)) {
            return { ok: false, error: "duplicate", sticker };
        }

        const imported = Array.isArray(storageData[IMPORTED_STICKERS_KEY])
            ? storageData[IMPORTED_STICKERS_KEY]
            : [];

        return chrome.storage.local.set({ [IMPORTED_STICKERS_KEY]: [sticker, ...imported] })
            .then(() => chrome.storage.local.remove(STICKER_CACHE_KEY))
            .then(() => fetchStickersFromNetwork())
            .then((stickers) => {
                currentStickers = stickers;
                if (typeof global !== 'undefined') {
                    global.currentStickers = currentStickers;
                }

                const stickerPanel = document.querySelector("#stickerPanel");
                if (stickerPanel) {
                    renderStickerResults(stickerPanel, currentStickers);
                }

                return { ok: true, sticker };
            });
    });
}

function uploadChatworkStickerFile(filePayload, metadata = {}) {
    return getChatworkUploadConfig()
        .then((config) => {
            if (getUploadToken(config)) {
                return uploadChatworkStickerFileSigned(filePayload, config)
                    .then((fileId) => {
                        if (fileId) return fileId;
                        const request = buildChatworkUploadRequest(config, filePayload);
                        return fetch(request.url, request.options)
                            .then((response) => {
                                if (!response.ok) {
                                    throw new Error(`Chatwork upload failed: ${response.status} ${response.statusText}`);
                                }
                                return response.text();
                            })
                            .then((text) => extractFileIdFromUploadResponse(parseChatworkJsonResponse(text)) || extractFileIdFromUploadResponse(text));
                    });
            }

            const request = buildChatworkUploadRequest(config, filePayload);
            return fetch(request.url, request.options);
        })
        .then((result) => {
            if (typeof result === "string" && /^\d+$/.test(result)) {
                return result;
            }

            return Promise.resolve(result)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Chatwork upload failed: ${response.status} ${response.statusText}`);
                    }
                    return response.text();
                })
                .then((text) => extractFileIdFromUploadResponse(parseChatworkJsonResponse(text)) || extractFileIdFromUploadResponse(text));
        })
        .then((fileId) => {
            if (!fileId) {
                throw new Error("Chatwork upload response did not contain file_id.");
            }

            return saveImportedSticker(buildUploadedStickerFromFileId(fileId, metadata));
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

    if (message.action === "upload_chatwork_sticker_file") {
        uploadChatworkStickerFile(message.file, message.metadata || {})
            .then((result) => sendResponse({ status: "success", ...result }))
            .catch((error) => sendResponse({
                status: "error",
                error: error && error.message ? error.message : "Chatwork upload failed.",
            }));
        return true;
    }
});

if (typeof global !== "undefined") {
    global.extractFileIdFromUploadResponse = extractFileIdFromUploadResponse;
    global.buildChatworkUploadRequest = buildChatworkUploadRequest;
    global.buildSignedUploadInfoRequest = buildSignedUploadInfoRequest;
    global.buildUploadedStickerFromFileId = buildUploadedStickerFromFileId;
    global.uploadChatworkStickerFile = uploadChatworkStickerFile;
}
