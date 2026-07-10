const POPUP_STORAGE_KEYS = ["sticker_cache_v2", "sticker_favorites", "sticker_recents", "sticker_imported_v1", "quick_reactions_enabled", "sticker_usage_metrics_v1", "sticker_popup_preferences_v1", "sticker_trash_v1"];
const POPUP_IMPORTED_STICKERS_KEY = "sticker_imported_v1";
const POPUP_BROKEN_STICKERS_KEY = "sticker_broken_preview_ids_v1";
const POPUP_USAGE_METRICS_KEY = "sticker_usage_metrics_v1";
const POPUP_CHATWORK_ORIGIN = "https://www.chatwork.com/";

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

function getPopupStorage(keys, fallbackValue) {
    return withInvalidatedContextFallback(() => chrome.storage.local.get(keys), fallbackValue);
}

function removePopupStorage(keys) {
    return withInvalidatedContextFallback(() => chrome.storage.local.remove(keys), false);
}

function setPopupStorage(data) {
    return withInvalidatedContextFallback(() => chrome.storage.local.set(data), false);
}

function countArray(value) {
    return Array.isArray(value) ? value.length : 0;
}

function usageCounts(value) {
    return {
        inserts: Math.max(0, Number(value && value.inserts) || 0),
        quickReactionInserts: Math.max(0, Number(value && value.quickReactionInserts) || 0),
        favoriteReuses: Math.max(0, Number(value && value.favoriteReuses) || 0),
        packFilterSelections: Math.max(0, Number(value && value.packFilterSelections) || 0),
        imports: Math.max(0, Number(value && value.imports) || 0),
    };
}

function summarizeLocalUsage(metrics, now = new Date()) {
    const summary = usageCounts();
    const days = metrics && metrics.days && typeof metrics.days === "object" ? metrics.days : {};
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));

    Object.entries(days).forEach(([date, counts]) => {
        const parsedDate = new Date(`${date}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate < start) return;
        const normalized = usageCounts(counts);
        Object.keys(summary).forEach((key) => {
            summary[key] += normalized[key];
        });
    });

    return {
        ...summary,
        quickReactionRate: summary.inserts > 0 ? Math.round((summary.quickReactionInserts / summary.inserts) * 100) : 0,
    };
}

function summarizeDashboard(storageData) {
    const stickerCount = countArray(storageData.sticker_cache_v2);
    const favoriteCount = countArray(storageData.sticker_favorites);
    const recentCount = countArray(storageData.sticker_recents);
    const importedCount = countArray(storageData[POPUP_IMPORTED_STICKERS_KEY]);

    return {
        stickerCount,
        favoriteCount,
        recentCount,
        importedCount,
        cacheState: stickerCount > 0 ? "Ready" : "Empty",
    };
}

function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
        node.textContent = String(value);
    }
}

function setStatus(message) {
    setText("popupStatus", message);
}

function getInputValue(id) {
    const node = document.getElementById(id);
    return node ? node.value.trim() : "";
}

function setInputValue(id, value) {
    const node = document.getElementById(id);
    if (node) {
        node.value = value;
    }
}

function renderDashboard(summary) {
    const usage = summary.usage || {
        inserts: 0,
        quickReactionRate: 0,
        packFilterSelections: 0,
        imports: 0,
    };
    setText("stickerCount", summary.stickerCount);
    setText("cacheState", summary.cacheState);
    setText("favoriteCount", summary.favoriteCount);
    setText("recentCount", summary.recentCount);
    setText("importedCount", summary.importedCount);
    setText("usageInsertCount", usage.inserts);
    setText("usageQuickRate", `${usage.quickReactionRate}%`);
    setText("usagePackFilterCount", usage.packFilterSelections);
    setText("usageImportCount", usage.imports);
}

function normalizePopupPreferences(value) {
    const preferences = value && typeof value === "object" ? value : {};
    return {
        showStats: preferences.showStats !== false,
        showQuickReactions: preferences.showQuickReactions !== false,
        showUpload: preferences.showUpload !== false,
        showCacheControls: preferences.showCacheControls !== false,
        showUsage: preferences.showUsage !== false,
    };
}

function renderPopupPreferences(storageData) {
    const preferences = normalizePopupPreferences(storageData.sticker_popup_preferences_v1);
    const setVisible = (id, visible) => {
        const node = document.getElementById(id);
        if (node) node.hidden = !visible;
    };
    setVisible("popupStats", preferences.showStats);
    setVisible("quickReactionsEnabled", preferences.showQuickReactions);
    setVisible("popupImportPanel", preferences.showUpload);
    ["reloadStickerData", "clearStickerCache"].forEach((id) => setVisible(id, preferences.showCacheControls));
    ["usageInsertCount", "usageQuickRate", "usagePackFilterCount", "usageImportCount", "clearLocalUsage"].forEach((id) => setVisible(id, preferences.showUsage));
}

function renderQuickReactionsToggle(storageData) {
    const toggle = document.getElementById("quickReactionsEnabled");
    if (toggle) {
        toggle.checked = storageData.quick_reactions_enabled !== false;
    }
}

function splitTags(value) {
    return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function defaultPackName() {
    return `upload-${todayString().replace(/-/g, "")}`;
}

function refreshDashboard() {
    return getPopupStorage(POPUP_STORAGE_KEYS, {}).then((storageData) => {
        const summary = summarizeDashboard(storageData);
        renderDashboard({
            ...summary,
            usage: summarizeLocalUsage(storageData[POPUP_USAGE_METRICS_KEY]),
        });
        renderQuickReactionsToggle(storageData);
        renderPopupPreferences(storageData);
        return summary;
    });
}

function openSettings() {
    return chrome.runtime.openOptionsPage().catch(() => {
        window.open(chrome.runtime.getURL("settings.html"), "_blank");
    });
}

function setQuickReactionsEnabled(enabled) {
    return setPopupStorage({ quick_reactions_enabled: Boolean(enabled) }).then((saved) => {
        if (saved === false) {
            setStatus("Could not save Quick Reactions setting.");
            return { ok: false };
        }

        return sendActiveTabMessage({ action: "set_quick_reactions_enabled", enabled: Boolean(enabled) })
            .then(() => {
                setStatus(`Quick Reactions ${enabled ? "enabled" : "disabled"}.`);
                return { ok: true };
            });
    });
}

function sendActiveTabMessage(message) {
    return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (!tabs.length || !tabs[0].id) {
            return { ok: false, error: "No active Chatwork tab." };
        }

        return chrome.tabs.sendMessage(tabs[0].id, message).then((response) => {
            if (chrome.runtime.lastError) {
                return { ok: false, error: chrome.runtime.lastError.message || "Content script is unavailable." };
            }
            return { ok: true, response };
        }).catch((error) => ({
            ok: false,
            error: error && error.message ? error.message : "Content script is unavailable.",
        }));
    });
}

function clearStickerCache() {
    setStatus("Clearing sticker cache...");
    return removePopupStorage(["sticker_cache_v2", POPUP_BROKEN_STICKERS_KEY])
        .then(() => sendActiveTabMessage({ action: "clear_sticker_cache" }))
        .then((result) => refreshDashboard().then(() => result))
        .then((result) => {
            if (!result.ok) {
                setStatus(`Cache cleared locally. ${result.error}`);
                return;
            }
            setStatus("Sticker cache cleared. Favorites and recents kept.");
        });
}

function reloadStickerData() {
    setStatus("Reloading sticker data...");
    return sendActiveTabMessage({ action: "reload_sticker_data" })
        .then((result) => refreshDashboard().then((summary) => ({ result, summary })))
        .then(({ result, summary }) => {
            if (!result.ok) {
                setStatus(`Open Chatwork and reload the page first. ${result.error}`);
                return;
            }

            const count = result.response && Number.isFinite(result.response.count)
                ? result.response.count
                : summary.stickerCount;
            setStatus(`Sticker data reloaded: ${count} items.`);
        });
}

function clearLocalUsageMetrics() {
    setStatus("Clearing local usage data...");
    return removePopupStorage(POPUP_USAGE_METRICS_KEY)
        .then((removed) => refreshDashboard().then(() => removed))
        .then((removed) => {
            setStatus(removed === false ? "Could not clear local usage data." : "Local usage data cleared. Sticker data and preferences were kept.");
            return removed !== false;
        });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read selected file."));
        reader.readAsDataURL(file);
    });
}

function getUploadMetadata() {
    return {
        name: getInputValue("importName"),
        tags: splitTags(getInputValue("importTags")),
        pack: getInputValue("importPack") || defaultPackName(),
    };
}

function uploadStickerFilePayload(filePayload, metadata = getUploadMetadata()) {
    if (!filePayload || !filePayload.dataUrl) {
        setStatus("Select an image file first.");
        return Promise.resolve({ ok: false, error: "missing_file" });
    }

    setStatus("Uploading to Chatwork...");
    return sendActiveTabMessage({
        action: "upload_chatwork_sticker_file",
        file: filePayload,
        metadata,
    }).then((result) => {
        if (!result.ok || !result.response || result.response.status === "error") {
            const error = result.error || result.response && result.response.error || "Chatwork upload failed.";
            setStatus(error);
            return { ok: false, error };
        }

        if (result.response.error === "duplicate") {
            setStatus(`Sticker ${result.response.sticker.previewId} already exists.`);
            return { ok: false, error: "duplicate" };
        }

        return refreshDashboard().then(() => {
            const sticker = result.response.sticker;
            setStatus(`Uploaded sticker ${sticker.previewId}.`);
            return { ok: true, sticker };
        });
    });
}

function uploadSelectedStickerFromPopup() {
    const input = document.getElementById("uploadFile");
    const file = input && input.files && input.files[0];
    if (!file) {
        setStatus("Select an image file first.");
        return Promise.resolve({ ok: false, error: "missing_file" });
    }

    return readFileAsDataUrl(file).then((dataUrl) => uploadStickerFilePayload({
        name: file.name,
        type: file.type || "application/octet-stream",
        dataUrl,
    }, getUploadMetadata()));
}

document.addEventListener("DOMContentLoaded", function () {
    const clearButton = document.getElementById("clearStickerCache");
    const reloadButton = document.getElementById("reloadStickerData");
    const uploadButton = document.getElementById("uploadSticker");
    const quickReactionsToggle = document.getElementById("quickReactionsEnabled");
    const clearUsageButton = document.getElementById("clearLocalUsage");
    const settingsButton = document.getElementById("openSettings");

    if (!getInputValue("importPack")) {
        setInputValue("importPack", defaultPackName());
    }

    refreshDashboard().then(() => {
        setStatus("Select an image and upload it through the active Chatwork tab.");
    });

    if (clearButton) {
        clearButton.addEventListener("click", clearStickerCache);
    }

    if (reloadButton) {
        reloadButton.addEventListener("click", reloadStickerData);
    }

    if (uploadButton) {
        uploadButton.addEventListener("click", uploadSelectedStickerFromPopup);
    }

    if (quickReactionsToggle) {
        quickReactionsToggle.addEventListener("change", () => {
            setQuickReactionsEnabled(quickReactionsToggle.checked);
        });
    }

    if (clearUsageButton) {
        clearUsageButton.addEventListener("click", clearLocalUsageMetrics);
    }
    if (settingsButton) settingsButton.addEventListener("click", openSettings);
});

if (typeof global !== "undefined") {
    global.summarizeDashboard = summarizeDashboard;
    global.refreshDashboard = refreshDashboard;
    global.clearStickerCacheFromPopup = clearStickerCache;
    global.reloadStickerDataFromPopup = reloadStickerData;
    global.uploadStickerFilePayloadFromPopup = uploadStickerFilePayload;
    global.uploadSelectedStickerFromPopup = uploadSelectedStickerFromPopup;
    global.setQuickReactionsEnabledFromPopup = setQuickReactionsEnabled;
    global.summarizeLocalUsage = summarizeLocalUsage;
    global.clearLocalUsageMetricsFromPopup = clearLocalUsageMetrics;
    global.normalizePopupPreferences = normalizePopupPreferences;
}
