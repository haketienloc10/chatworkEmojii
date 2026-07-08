const POPUP_STORAGE_KEYS = ["sticker_cache_v2", "sticker_favorites", "sticker_recents"];

function countArray(value) {
    return Array.isArray(value) ? value.length : 0;
}

function summarizeDashboard(storageData) {
    const stickerCount = countArray(storageData.sticker_cache_v2);
    const favoriteCount = countArray(storageData.sticker_favorites);
    const recentCount = countArray(storageData.sticker_recents);

    return {
        stickerCount,
        favoriteCount,
        recentCount,
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

function renderDashboard(summary) {
    setText("stickerCount", summary.stickerCount);
    setText("cacheState", summary.cacheState);
    setText("favoriteCount", summary.favoriteCount);
    setText("recentCount", summary.recentCount);
}

function refreshDashboard() {
    return chrome.storage.local.get(POPUP_STORAGE_KEYS).then((storageData) => {
        const summary = summarizeDashboard(storageData);
        renderDashboard(summary);
        return summary;
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
    return chrome.storage.local.remove("sticker_cache_v2")
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

document.addEventListener("DOMContentLoaded", function () {
    const clearButton = document.getElementById("clearStickerCache");
    const reloadButton = document.getElementById("reloadStickerData");

    refreshDashboard().then(() => {
        setStatus("Dashboard ready.");
    });

    if (clearButton) {
        clearButton.addEventListener("click", clearStickerCache);
    }

    if (reloadButton) {
        reloadButton.addEventListener("click", reloadStickerData);
    }
});

if (typeof global !== "undefined") {
    global.summarizeDashboard = summarizeDashboard;
    global.refreshDashboard = refreshDashboard;
    global.clearStickerCacheFromPopup = clearStickerCache;
    global.reloadStickerDataFromPopup = reloadStickerData;
}
