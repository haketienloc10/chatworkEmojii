const CHATWORK_SELECTORS = {
    sendArea: "#_chatSendArea",
    chatText: "#_chatText",
    emojiButton: '[data-tooltip*="Emoji"]',
};

const STICKER_CACHE_KEY = "sticker_cache_v2";
const LEGACY_STICKER_CACHE_KEY = "sticker_cache";
const BROKEN_STICKERS_KEY = "sticker_broken_preview_ids_v1";
const IMPORTED_STICKERS_KEY = "sticker_imported_v1";
const POPUP_PREFERENCES_KEY = "sticker_popup_preferences_v1";
const CUSTOM_ORDER_KEY = "sticker_custom_order_v1";
const HIDDEN_PREVIEW_IDS_KEY = "sticker_hidden_preview_ids_v1";
const TRASH_KEY = "sticker_trash_v1";
const PINNED_PREVIEW_IDS_KEY = "sticker_pinned_preview_ids_v1";
const PACK_PREFERENCES_KEY = "sticker_pack_preferences_v1";
const QUICK_REACTIONS_ENABLED_KEY = "quick_reactions_enabled";
const QUICK_REACTIONS_LIMIT = 8;
const USAGE_METRICS_KEY = "sticker_usage_metrics_v1";
const USAGE_METRICS_VERSION = 1;
const USAGE_METRICS_RETENTION_DAYS = 90;
const CHATWORK_UPLOAD_CONFIG_KEY = "chatwork_upload_config_v1";
const CHATWORK_ORIGIN = "https://www.chatwork.com/";
const CHATWORK_DEFAULT_UPLOAD_URL = "https://www.chatwork.com/gateway/upload_file.php";
const CHATWORK_SIGNED_UPLOAD_URL = "https://www.chatwork.com/gateway/get_upload_file_info_sig_v4.php";
const CHATWORK_STORAGE_UPLOAD_URL = "https://tky-chat-work-appdata.s3.ap-northeast-1.amazonaws.com/";
const STICKER_PANEL_WIDTH = 420;
const STICKER_PANEL_MAX_HEIGHT = 420;
const STICKER_PANEL_MARGIN = 12;
const STICKER_PRELOAD_COUNT = 20;
const STICKER_IMAGE_CONCURRENCY = 5;
const UPLOAD_IMPORT_SOURCE = "chatwork-upload";
const brokenStickerPreviewIds = new Set();
let currentStickers = [];
let sourceStickers = [];
let stickerSearchQuery = "";
let stickerSearchRenderTimer = null;
let activeTab = "all";
let selectedPack = "";
let favorites = new Set();
let recents = [];
let quickReactionsEnabled = true;
let hiddenStickerPreviewIds = new Set();
let trashedStickerPreviewIds = new Set();
let customStickerOrder = [];
let stickerPackPreferences = {};
let usageMetricsWrite = Promise.resolve();
let stickerImageObserver = null;
let stickerImageQueue = [];
let activeStickerImageLoads = 0;
let stickerImageCacheGeneration = 0;
let stickerButtonRefreshTimer = null;
const stickerTileCache = new Map();


function isExtensionContextInvalidatedError(error) {
    return Boolean(error && typeof error.message === "string" && error.message.includes("Extension context invalidated"));
}

function withInvalidatedContextFallback(operation, fallbackValue) {
    try {
        return Promise.resolve(operation()).catch((error) => {
            if (isExtensionContextInvalidatedError(error)) {
                return fallbackValue;
            }

            throw error;
        });
    } catch (error) {
        if (isExtensionContextInvalidatedError(error)) {
            return Promise.resolve(fallbackValue);
        }

        return Promise.reject(error);
    }
}

function getLocalStorageValue(keys, fallbackValue) {
    return withInvalidatedContextFallback(() => chrome.storage.local.get(keys), fallbackValue);
}

function setLocalStorageValue(data) {
    return withInvalidatedContextFallback(() => chrome.storage.local.set(data), false);
}

function removeLocalStorageValue(keys) {
    return withInvalidatedContextFallback(() => chrome.storage.local.remove(keys), false);
}

function normalizeStickerManagementPreferences(storageData) {
    const data = storageData || {};
    return {
        hiddenPreviewIds: Array.isArray(data[HIDDEN_PREVIEW_IDS_KEY]) ? data[HIDDEN_PREVIEW_IDS_KEY].map(String) : [],
        trashedPreviewIds: Array.isArray(data[TRASH_KEY]) ? data[TRASH_KEY].map((item) => item && item.previewId).filter(Boolean).map(String) : [],
        customOrder: Array.isArray(data[CUSTOM_ORDER_KEY]) ? data[CUSTOM_ORDER_KEY].map(String) : [],
        packPreferences: data[PACK_PREFERENCES_KEY] && typeof data[PACK_PREFERENCES_KEY] === "object" ? data[PACK_PREFERENCES_KEY] : {},
    };
}

function applyStickerManagementPreferences(storageData) {
    const preferences = normalizeStickerManagementPreferences(storageData);
    hiddenStickerPreviewIds = new Set(preferences.hiddenPreviewIds);
    trashedStickerPreviewIds = new Set(preferences.trashedPreviewIds);
    customStickerOrder = preferences.customOrder;
    stickerPackPreferences = preferences.packPreferences;
}

function isStickerManagedVisible(sticker) {
    if (!sticker || !sticker.previewId) return false;
    const previewId = String(sticker.previewId);
    const pack = stickerPackPreferences[sticker.pack] || {};
    return !hiddenStickerPreviewIds.has(previewId) && !trashedStickerPreviewIds.has(previewId) && pack.hidden !== true;
}

function sortStickersByCustomOrder(stickers) {
    const rank = new Map(customStickerOrder.map((previewId, index) => [String(previewId), index]));
    return stickers.map((sticker, index) => ({ sticker, index })).sort((left, right) => {
        const leftRank = rank.has(String(left.sticker.previewId)) ? rank.get(String(left.sticker.previewId)) : customStickerOrder.length + left.index;
        const rightRank = rank.has(String(right.sticker.previewId)) ? rank.get(String(right.sticker.previewId)) : customStickerOrder.length + right.index;
        return leftRank - rightRank;
    }).map((item) => item.sticker);
}

function visibleManagedStickers(stickers) {
    return sortStickersByCustomOrder((Array.isArray(stickers) ? stickers : []).filter(isStickerManagedVisible));
}

function refreshStickerManagementPreferences() {
    return getLocalStorageValue([HIDDEN_PREVIEW_IDS_KEY, TRASH_KEY, CUSTOM_ORDER_KEY, PACK_PREFERENCES_KEY], {})
        .then((storageData) => {
            applyStickerManagementPreferences(storageData);
            const removedIds = new Set(trashedStickerPreviewIds);
            const oldFavorites = Array.from(favorites);
            const keptFavorites = oldFavorites.filter((previewId) => !removedIds.has(String(previewId)));
            const oldRecentsLength = recents.length;
            const keptRecents = recents.filter((sticker) => !removedIds.has(String(sticker.previewId)));
            favorites.clear(); keptFavorites.forEach((previewId) => favorites.add(previewId));
            recents = keptRecents;
            const writes = [];
            if (keptFavorites.length !== oldFavorites.length) writes.push(setLocalStorageValue({ sticker_favorites: keptFavorites }));
            if (keptRecents.length !== oldRecentsLength) writes.push(setLocalStorageValue({ sticker_recents: keptRecents }));
            currentStickers = visibleManagedStickers(sourceStickers.length ? sourceStickers : currentStickers);
            if (typeof global !== "undefined") global.currentStickers = currentStickers;
            const panel = document.querySelector("#stickerPanel");
            if (panel) { renderPackFilters(panel, currentStickers); renderStickerResults(panel, currentStickers); }
            renderQuickReactions();
            return Promise.all(writes).then(() => currentStickers.length);
        });
}

function usageMetricDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function emptyUsageMetrics() {
    return { version: USAGE_METRICS_VERSION, days: {} };
}

function normalizeUsageMetrics(value, now = new Date()) {
    const metrics = emptyUsageMetrics();
    const days = value && value.days && typeof value.days === "object" ? value.days : {};
    const earliest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - USAGE_METRICS_RETENTION_DAYS + 1));

    Object.entries(days).forEach(([date, counts]) => {
        const parsedDate = new Date(`${date}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate < earliest) return;

        metrics.days[date] = {
            inserts: Math.max(0, Number(counts && counts.inserts) || 0),
            quickReactionInserts: Math.max(0, Number(counts && counts.quickReactionInserts) || 0),
            favoriteReuses: Math.max(0, Number(counts && counts.favoriteReuses) || 0),
            packFilterSelections: Math.max(0, Number(counts && counts.packFilterSelections) || 0),
            imports: Math.max(0, Number(counts && counts.imports) || 0),
        };
    });

    return metrics;
}

function recordUsageMetric(metric, now = new Date()) {
    const supportedMetrics = new Set(["inserts", "quickReactionInserts", "favoriteReuses", "packFilterSelections", "imports"]);
    if (!supportedMetrics.has(metric)) return Promise.resolve(false);

    usageMetricsWrite = usageMetricsWrite
        .then(() => getLocalStorageValue(USAGE_METRICS_KEY, {}))
        .then((storageData) => {
            const metrics = normalizeUsageMetrics(storageData[USAGE_METRICS_KEY], now);
            const date = usageMetricDate(now);
            const current = metrics.days[date] || {
                inserts: 0,
                quickReactionInserts: 0,
                favoriteReuses: 0,
                packFilterSelections: 0,
                imports: 0,
            };
            current[metric] += 1;
            metrics.days[date] = current;
            return setLocalStorageValue({ [USAGE_METRICS_KEY]: metrics });
        })
        .catch((error) => {
            if (isExtensionContextInvalidatedError(error)) return false;
            console.warn("Could not save local usage metric.", error);
            return false;
        });

    return usageMetricsWrite;
}

function recordStickerInsertUsage(sticker, source) {
    recordUsageMetric("inserts");
    if (source === "quick-reaction") recordUsageMetric("quickReactionInserts");
    if (sticker && favorites.has(sticker.previewId)) recordUsageMetric("favoriteReuses");
}

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
    return getLocalStorageValue(IMPORTED_STICKERS_KEY, {}).then((res) => {
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
    return setLocalStorageValue({ [STICKER_CACHE_KEY]: stickers }).then(() => {
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
    return getLocalStorageValue([STICKER_CACHE_KEY], {}).then((res) => {
        let cachedStickers = res[STICKER_CACHE_KEY];

        // Test environment compatibility: sync localStorage clear to chrome.storage.local
        if (typeof global !== 'undefined' && localStorage.getItem(STICKER_CACHE_KEY) === null) {
            cachedStickers = null;
            removeLocalStorageValue(STICKER_CACHE_KEY);
        }

        if (!cachedStickers) {
            cachedStickers = localStorage.getItem(STICKER_CACHE_KEY);
        }

        if (cachedStickers) {
            try {
                const parsed = typeof cachedStickers === "string" ? JSON.parse(cachedStickers) : cachedStickers;
                const normalized = parsed.map(normalizeSticker).filter(Boolean);
                return loadImportedStickers().then((importedStickers) => mergeStickerLists(normalized, importedStickers)).then((merged) => {
                    return setLocalStorageValue({ [STICKER_CACHE_KEY]: merged }).then(() => {
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
                removeLocalStorageValue(STICKER_CACHE_KEY);
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

function isValidDirectUploadUrl(url) {
    if (typeof url !== "string") return false;

    try {
        return new URL(url).pathname.toLowerCase() === "/gateway/upload_file.php";
    } catch (_error) {
        return url.toLowerCase().split("?")[0].endsWith("/gateway/upload_file.php");
    }
}

function getChatworkUploadConfig() {
    return getLocalStorageValue(CHATWORK_UPLOAD_CONFIG_KEY, {}).then((res) => {
        const config = res[CHATWORK_UPLOAD_CONFIG_KEY];
        if (!config || typeof config !== "object" || !isValidDirectUploadUrl(config.url)) {
            const fields = config && config.fields && typeof config.fields === "object"
                ? config.fields
                : {};
            return {
                url: CHATWORK_DEFAULT_UPLOAD_URL,
                method: "POST",
                fields: typeof fields._t === "string" ? { _t: fields._t } : {},
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

    return getLocalStorageValue([STICKER_CACHE_KEY, IMPORTED_STICKERS_KEY], {}).then((storageData) => {
        const knownPreviewIds = getKnownStickerPreviewIds(storageData);
        if (knownPreviewIds.has(sticker.previewId)) {
            return { ok: false, error: "duplicate", sticker };
        }

        const imported = Array.isArray(storageData[IMPORTED_STICKERS_KEY])
            ? storageData[IMPORTED_STICKERS_KEY]
            : [];

        return setLocalStorageValue({ [IMPORTED_STICKERS_KEY]: [sticker, ...imported] })
            .then(() => removeLocalStorageValue(STICKER_CACHE_KEY))
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

                recordUsageMetric("imports");
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
    setLocalStorageValue({ sticker_recents: recents });
    renderQuickReactions();
}

function getQuickReactionStickers() {
    const selected = [];
    const selectedPreviewIds = new Set();
    const stickersByPreviewId = new Map(currentStickers.map((sticker) => [sticker.previewId, sticker]));

    const addSticker = (sticker) => {
        if (!sticker || !sticker.previewId || selectedPreviewIds.has(sticker.previewId)) return;
        const currentSticker = stickersByPreviewId.get(sticker.previewId) || sticker;
        if (!currentSticker || !isStickerManagedVisible(currentSticker) || brokenStickerPreviewIds.has(currentSticker.previewId)) return;
        selectedPreviewIds.add(currentSticker.previewId);
        selected.push(currentSticker);
    };

    recents.forEach(addSticker);
    currentStickers.filter((sticker) => favorites.has(sticker.previewId)).forEach(addSticker);
    currentStickers.forEach(addSticker);

    return selected.slice(0, QUICK_REACTIONS_LIMIT);
}

function renderQuickReactions() {
    const toolbar = findChatworkToolbar();
    if (!toolbar) return;

    const existingContainer = document.querySelector("#quickReactionsToolbarItem");
    const existingBar = document.querySelector("#quickReactionsBar");
    const existingToggle = document.querySelector("#quickReactionsToggle");
    if (!quickReactionsEnabled) {
        if (existingContainer) existingContainer.remove();
        return;
    }

    const quickStickers = getQuickReactionStickers();
    if (quickStickers.length === 0) {
        if (existingContainer) existingContainer.remove();
        return;
    }

    const container = existingContainer || document.createElement("li");
    container.id = "quickReactionsToolbarItem";
    container.className = "quick-reactions-toolbar-item";

    const bar = existingBar || document.createElement("div");
    bar.id = "quickReactionsBar";
    bar.className = "quick-reactions-bar";
    bar.setAttribute("aria-label", "Quick sticker reactions");

    const buttons = quickStickers.map((sticker) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-reaction-button";
        button.setAttribute("aria-label", `Insert quick reaction: ${sticker.name}`);
        button.title = sticker.name;

        const image = document.createElement("img");
        image.className = "quick-reaction-image";
        image.alt = "";
        image.src = sticker.url;
        image.addEventListener("error", () => button.remove(), { once: true });
        button.appendChild(image);
        button.addEventListener("click", () => {
            insertStickerToChat(sticker.insertText);
            addToRecents(sticker);
            recordStickerInsertUsage(sticker, "quick-reaction");
        });
        return button;
    });

    bar.replaceChildren(...buttons);
    if (!existingContainer) {
        const toggle = existingToggle || document.createElement("button");
        toggle.id = "quickReactionsToggle";
        toggle.type = "button";
        toggle.className = "quick-reactions-toggle";
        toggle.textContent = "Quick reactions";
        toggle.setAttribute("aria-controls", "quickReactionsBar");
        toggle.setAttribute("aria-expanded", "false");
        toggle.addEventListener("click", () => {
            const expanded = !bar.classList.contains("is-expanded");
            if (expanded) {
                bar.classList.add("is-expanded");
            } else {
                bar.classList.remove("is-expanded");
            }
            toggle.setAttribute("aria-expanded", String(expanded));
        });
        container.append(toggle, bar);
    }

    // Appending an existing node moves it to the final toolbar position. This keeps
    // Quick Reactions to the right of Chatwork controls added before or after ours.
    toolbar.appendChild(container);
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

            const stickerButtons = Array.from(grid.querySelectorAll(".sticker-select-btn:not([disabled])"));
            if (stickerButtons.length === 0) return;

            let activeIdx = stickerButtons.indexOf(document.activeElement);
            
            stickerButtons.forEach((button) => button.closest(".sticker-tile")?.classList.remove("highlighted"));

            if (activeIdx === -1) {
                stickerButtons[0].focus();
                stickerButtons[0].closest(".sticker-tile")?.classList.add("highlighted");
            } else {
                let nextIdx = activeIdx;
                if (event.key === "ArrowRight") {
                    nextIdx = (activeIdx + 1) % stickerButtons.length;
                } else if (event.key === "ArrowLeft") {
                    nextIdx = (activeIdx - 1 + stickerButtons.length) % stickerButtons.length;
                } else if (event.key === "ArrowDown") {
                    nextIdx = activeIdx + 4;
                    if (nextIdx >= stickerButtons.length) nextIdx = activeIdx;
                } else if (event.key === "ArrowUp") {
                    nextIdx = activeIdx - 4;
                    if (nextIdx < 0) nextIdx = activeIdx;
                }

                stickerButtons[nextIdx].focus();
                stickerButtons[nextIdx].closest(".sticker-tile")?.classList.add("highlighted");
            }
        } else if (event.key === "Enter") {
            const focusedButton = document.activeElement;
            if (focusedButton && focusedButton.classList.contains("sticker-select-btn")) {
                event.preventDefault();
                focusedButton.click();
            }
        } else if (event.key === "Escape") {
            closeStickerPanel();
        }
    });
}

function preloadStickerPanel() {
    if (document.querySelector("#stickerPanel")) return;

    resetStickerTileCache();
    selectedPack = "";

    getLocalStorageValue(["sticker_favorites", "sticker_recents", BROKEN_STICKERS_KEY, QUICK_REACTIONS_ENABLED_KEY, HIDDEN_PREVIEW_IDS_KEY, TRASH_KEY, CUSTOM_ORDER_KEY, PACK_PREFERENCES_KEY], {}).then((res) => {
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

        brokenStickerPreviewIds.clear();
        const storedBrokenIds = Array.isArray(res[BROKEN_STICKERS_KEY]) ? res[BROKEN_STICKERS_KEY] : [];
        storedBrokenIds.forEach((previewId) => brokenStickerPreviewIds.add(String(previewId)));
        quickReactionsEnabled = res[QUICK_REACTIONS_ENABLED_KEY] !== false;
        applyStickerManagementPreferences(res);

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
        const tabs = [
            {
                name: "All",
                icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect></svg>'
            },
            {
                name: "Recent",
                icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.68"></path><path d="M4 4v4.68h4.68M12 7.5V12l3 2"></path></svg>'
            },
            {
                name: "Favorite",
                icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z"></path></svg>'
            }
        ];
        tabs.forEach(({ name: tabName, icon }) => {
            const tabBtn = document.createElement("button");
            tabBtn.type = "button";
            tabBtn.className = `sticker-tab sticker-tab-${tabName.toLowerCase()}`;
            tabBtn.setAttribute("aria-label", `${tabName} stickers`);
            tabBtn.title = tabName;
            tabBtn.innerHTML = icon;
            if (tabName.toLowerCase() === activeTab) {
                tabBtn.classList.add("active");
                tabBtn.setAttribute("aria-pressed", "true");
            } else {
                tabBtn.setAttribute("aria-pressed", "false");
            }
            tabBtn.addEventListener("click", () => {
                activeTab = tabName.toLowerCase();
                if (typeof global !== 'undefined') {
                    global.activeTab = activeTab;
                }
                tabsContainer.querySelectorAll(".sticker-tab").forEach((btn) => {
                    btn.classList.remove("active");
                    btn.setAttribute("aria-pressed", "false");
                });
                tabBtn.classList.add("active");
                tabBtn.setAttribute("aria-pressed", "true");
                renderStickerResults(stickerPanel, currentStickers);
            });
            tabsContainer.appendChild(tabBtn);
        });

        const randomBtn = document.createElement("button");
        randomBtn.type = "button";
        randomBtn.className = "sticker-random-button";
        randomBtn.setAttribute("aria-label", "Insert random sticker");
        randomBtn.title = "Random";
        randomBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"></path></svg>';
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
                recordStickerInsertUsage(stickerObj, "picker");
                closeStickerPanel();
            }
        });

        header.append(searchInput, tabsContainer, randomBtn);

        const resultGrid = document.createElement("div");
        resultGrid.className = "sticker-grid";
        resultGrid.dataset.role = "sticker-results";

        const packFilters = document.createElement("div");
        packFilters.className = "sticker-pack-filters";
        packFilters.setAttribute("aria-label", "Filter stickers by pack");

        stickerPanel.append(header, packFilters, resultGrid);
        document.body.appendChild(stickerPanel);

        setupKeyboardNavigation(stickerPanel);

        loadStickers().then((stickers) => {
            sourceStickers = stickers;
            currentStickers = visibleManagedStickers(sourceStickers);
            if (typeof global !== 'undefined') {
                global.currentStickers = currentStickers;
            }
            renderPackFilters(stickerPanel, currentStickers);
            renderStickerResults(stickerPanel, currentStickers);
            renderQuickReactions();
        });
    });
}

function renderStickerResults(stickerPanel, stickers) {
    const resultGrid = stickerPanel.querySelector('[data-role="sticker-results"]');
    if (!resultGrid) return;

    if (stickerImageObserver) {
        stickerImageObserver.disconnect();
        stickerImageObserver = null;
    }

    let tabStickers = stickers;
    if (activeTab === "recent") {
        tabStickers = recents;
    } else if (activeTab === "favorite") {
        tabStickers = stickers.filter((s) => favorites.has(s.previewId));
    }

    const availableStickers = tabStickers
        .filter(isStickerManagedVisible)
        .filter((sticker) => !selectedPack || sticker.pack === selectedPack)
        .filter((sticker) => !brokenStickerPreviewIds.has(sticker.previewId))
        .filter((sticker) => matchesStickerSearch(sticker, stickerSearchQuery));

    if (availableStickers.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "sticker-empty";
        emptyState.textContent = stickerSearchQuery ? "No matching stickers." : "No stickers available.";
        resultGrid.replaceChildren(emptyState);
        if (stickerPanel.style.display !== "none") {
            positionStickerPanel(stickerPanel);
        }
        return;
    }

    const visibleTiles = availableStickers.map(getOrCreateStickerTile);
    resultGrid.replaceChildren(...visibleTiles);

    if (typeof IntersectionObserver === "function") {
        stickerImageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                queueStickerImage(entry.target, entry.target._stickerData);
            });
        }, {
            root: resultGrid,
            rootMargin: "120px 0px",
            threshold: 0.01,
        });
    }

    visibleTiles.forEach((tile, index) => {
        if (index < STICKER_PRELOAD_COUNT || !stickerImageObserver) {
            queueStickerImage(tile, tile._stickerData);
        } else {
            if (tile.dataset.imageState === "idle") {
                stickerImageObserver.observe(tile);
            }
        }
    });

    if (stickerPanel.style.display !== "none") {
        positionStickerPanel(stickerPanel);
    }
}

function getStickerPacks(stickers) {
    return Array.from(new Set(
        stickers
            .map((sticker) => typeof sticker.pack === "string" ? sticker.pack.trim() : "")
            .filter(Boolean)
    )).sort((left, right) => left.localeCompare(right));
}

function renderPackFilters(stickerPanel, stickers) {
    const packFilters = stickerPanel.querySelector(".sticker-pack-filters");
    if (!packFilters) return;

    const packs = getStickerPacks(stickers);
    if (selectedPack && !packs.includes(selectedPack)) {
        selectedPack = "";
    }

    const options = [{ value: "", name: "All packs" }, ...packs.map((pack) => ({ value: pack, name: (stickerPackPreferences[pack] && stickerPackPreferences[pack].name) || pack }))];
    const chips = options.map(({ value, name }) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sticker-pack-chip";
        chip.textContent = name;
        chip.setAttribute("aria-label", `Filter stickers by ${name}`);
        chip.setAttribute("aria-pressed", String(selectedPack === value));
        if (selectedPack === value) chip.classList.add("active");
        chip.addEventListener("click", (event) => {
            // Rendering replaces the clicked chip. Do not let the document-level
            // outside-click handler receive an event whose target is detached.
            event.stopPropagation();
            selectedPack = value;
            recordUsageMetric("packFilterSelections");
            renderPackFilters(stickerPanel, currentStickers);
            renderStickerResults(stickerPanel, currentStickers);
        });
        return chip;
    });

    packFilters.replaceChildren(...chips);
}

function getOrCreateStickerTile(sticker) {
    const cachedTile = stickerTileCache.get(sticker.previewId);
    if (cachedTile) {
        return cachedTile;
    }

    const tile = createStickerTile(sticker);
    stickerTileCache.set(sticker.previewId, tile);
    return tile;
}

function resetStickerTileCache() {
    stickerImageCacheGeneration += 1;
    stickerImageQueue = [];
    if (stickerImageObserver) {
        stickerImageObserver.disconnect();
        stickerImageObserver = null;
    }
    stickerTileCache.clear();
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
    const tile = document.createElement("div");
    tile.className = "sticker-tile";
    tile.dataset.previewId = sticker.previewId;
    tile.dataset.imageState = "idle";
    tile._stickerData = sticker;

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "sticker-select-btn";
    selectBtn.title = sticker.name;
    selectBtn.setAttribute("aria-label", `Insert sticker: ${sticker.name}`);

    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "favorite-btn";
    favBtn.setAttribute("aria-label", `${favorites.has(sticker.previewId) ? "Remove" : "Add"} ${sticker.name} ${favorites.has(sticker.previewId) ? "from" : "to"} favorites`);
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
            favBtn.setAttribute("aria-label", `Add ${sticker.name} to favorites`);
        } else {
            favorites.add(sticker.previewId);
            favBtn.textContent = "★";
            favBtn.classList.add("is-favorited");
            favBtn.setAttribute("aria-label", `Remove ${sticker.name} from favorites`);
        }

        setLocalStorageValue({ sticker_favorites: Array.from(favorites) }).then((saved) => {
            if (saved === false) return;

            const stickerPanel = document.querySelector("#stickerPanel");
            if (stickerPanel) {
                renderStickerResults(stickerPanel, currentStickers);
            }
            renderQuickReactions();
        });
    });

    tile.addEventListener("click", () => {
        if (tile.disabled) return;
        insertStickerToChat(sticker.insertText);
        addToRecents(sticker);
        recordStickerInsertUsage(sticker, "picker");
        closeStickerPanel();
    });

    tile.append(selectBtn, favBtn);

    return tile;
}

function createStickerLoadingIndicator() {
    const loading = document.createElement("span");
    loading.className = "sticker-loading";
    loading.setAttribute("aria-hidden", "true");
    return loading;
}

function queueStickerImage(tile, sticker) {
    if (!tile || !sticker || tile.dataset.imageState !== "idle") return;

    tile.dataset.imageState = "queued";
    const selectBtn = tile.querySelector(".sticker-select-btn");
    if (!selectBtn) return;

    selectBtn.appendChild(createStickerLoadingIndicator());
    stickerImageQueue.push({
        tile,
        sticker,
        cacheGeneration: stickerImageCacheGeneration,
    });
    drainStickerImageQueue();
}

function drainStickerImageQueue() {
    while (activeStickerImageLoads < STICKER_IMAGE_CONCURRENCY && stickerImageQueue.length > 0) {
        const job = stickerImageQueue.shift();
        if (
            !job ||
            job.cacheGeneration !== stickerImageCacheGeneration ||
            stickerTileCache.get(job.sticker.previewId) !== job.tile
        ) {
            continue;
        }

        activeStickerImageLoads += 1;
        if (typeof global !== "undefined") {
            global.activeStickerImageLoads = activeStickerImageLoads;
            global.maxObservedStickerImageLoads = Math.max(
                global.maxObservedStickerImageLoads || 0,
                activeStickerImageLoads
            );
        }
        loadStickerImage(job).finally(() => {
            activeStickerImageLoads -= 1;
            if (typeof global !== "undefined") {
                global.activeStickerImageLoads = activeStickerImageLoads;
            }
            drainStickerImageQueue();
        });
    }
}

function loadStickerImage({ tile, sticker, cacheGeneration }) {
    tile.dataset.imageState = "loading";

    return new Promise((resolve) => {
        const image = document.createElement("img");
        image.alt = "";
        image.loading = "eager";
        image.className = "sticker-img";

        image.addEventListener("load", () => {
            if (
                cacheGeneration === stickerImageCacheGeneration &&
                stickerTileCache.get(sticker.previewId) === tile &&
                !tile.disabled
            ) {
                const loading = tile.querySelector(".sticker-loading");
                if (loading) loading.remove();
                const selectBtn = tile.querySelector(".sticker-select-btn");
                if (selectBtn) selectBtn.appendChild(image);
                tile.dataset.imageState = "loaded";
            }
            resolve();
        }, { once: true });

        image.addEventListener("error", () => {
            if (
                cacheGeneration === stickerImageCacheGeneration &&
                stickerTileCache.get(sticker.previewId) === tile
            ) {
                markStickerAsBroken(tile, sticker);
            }
            resolve();
        }, { once: true });

        image.src = sticker.url;
    });
}

function markStickerAsBroken(tile, sticker) {
    brokenStickerPreviewIds.add(sticker.previewId);
    setLocalStorageValue({
        [BROKEN_STICKERS_KEY]: Array.from(brokenStickerPreviewIds),
    });
    tile.disabled = true;
    tile.setAttribute("disabled", "");
    tile.dataset.imageState = "broken";
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

    renderQuickReactions();

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
        Math.max(STICKER_PANEL_MARGIN, buttonRect.left),
        window.innerWidth - panelWidth - STICKER_PANEL_MARGIN
    );
    const panelHeight = stickerPanel.offsetHeight || panelMaxHeight;
    const top = openBelow ? buttonRect.bottom + 8 : buttonRect.top - panelHeight - 8;

    stickerPanel.style.width = `${panelWidth}px`;
    // A flex child can only consume the remaining space when its parent has a
    // definite height. Without this, the All grid grows beyond max-height and
    // the panel's overflow rule clips the lower stickers.
    stickerPanel.style.height = `${panelMaxHeight}px`;
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
        if (!mutationsList.some((mutation) => mutation.type === "childList")) return;

        // Chatwork can replace its toolbar while the picker is open. Refresh
        // the trigger button if needed, but never close the picker for a
        // Chatwork DOM update: only an explicit sticker selection, Escape, or
        // outside click is allowed to close it.
        clearTimeout(stickerButtonRefreshTimer);
        stickerButtonRefreshTimer = setTimeout(() => {
            stickerButtonRefreshTimer = null;
            if (document.querySelector("#_sticker")) return;

            addStickerButton();
        }, 100);
    });

    observer.observe(chatContent, { childList: true, subtree: true, characterData: false });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "set_quick_reactions_enabled") {
        quickReactionsEnabled = message.enabled !== false;
        setLocalStorageValue({ [QUICK_REACTIONS_ENABLED_KEY]: quickReactionsEnabled }).then(() => {
            renderQuickReactions();
            sendResponse({ status: "success", enabled: quickReactionsEnabled });
        });
        return true;
    }

    if (message.action === "clear_sticker_cache") {
        removeLocalStorageValue([STICKER_CACHE_KEY, BROKEN_STICKERS_KEY]).then(() => {
            localStorage.removeItem(STICKER_CACHE_KEY);
            localStorage.removeItem(LEGACY_STICKER_CACHE_KEY);
            brokenStickerPreviewIds.clear();
            resetStickerTileCache();
            const stickerPanel = document.querySelector("#stickerPanel");
            if (stickerPanel) {
                renderStickerResults(stickerPanel, currentStickers);
            }
            console.log("Sticker cache cleared.");
            sendResponse({ status: "success" });
        });
        return true;
    }

    if (message.action === "reload_sticker_data") {
        removeLocalStorageValue([STICKER_CACHE_KEY, BROKEN_STICKERS_KEY]).then(() => {
            localStorage.removeItem(STICKER_CACHE_KEY);
            localStorage.removeItem(LEGACY_STICKER_CACHE_KEY);
            brokenStickerPreviewIds.clear();
            resetStickerTileCache();
            return fetchStickersFromNetwork();
        }).then((stickers) => {
            sourceStickers = stickers;
            currentStickers = visibleManagedStickers(sourceStickers);
            if (typeof global !== 'undefined') {
                global.currentStickers = currentStickers;
            }

            const stickerPanel = document.querySelector("#stickerPanel");
            if (stickerPanel) {
                renderStickerResults(stickerPanel, currentStickers);
            }
            renderQuickReactions();

            sendResponse({ status: "success", count: currentStickers.length });
        });
        return true;
    }

    if (message.action === "refresh_sticker_preferences") {
        refreshStickerManagementPreferences().then((count) => {
            sendResponse({ status: "success", count });
        }).catch((error) => sendResponse({ status: "error", error: error && error.message ? error.message : "Could not refresh sticker preferences." }));
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
    global.queueStickerImage = queueStickerImage;
    global.drainStickerImageQueue = drainStickerImageQueue;
    global.getQuickReactionStickers = getQuickReactionStickers;
    global.renderQuickReactions = renderQuickReactions;
    global.normalizeStickerManagementPreferences = normalizeStickerManagementPreferences;
    global.visibleManagedStickers = visibleManagedStickers;
}
