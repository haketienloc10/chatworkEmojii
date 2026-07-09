const POPUP_STORAGE_KEYS = ["sticker_cache_v2", "sticker_favorites", "sticker_recents", "sticker_imported_v1"];
const POPUP_IMPORTED_STICKERS_KEY = "sticker_imported_v1";
const POPUP_CHATWORK_ORIGIN = "https://www.chatwork.com/";

function countArray(value) {
    return Array.isArray(value) ? value.length : 0;
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
    setText("stickerCount", summary.stickerCount);
    setText("cacheState", summary.cacheState);
    setText("favoriteCount", summary.favoriteCount);
    setText("recentCount", summary.recentCount);
    setText("importedCount", summary.importedCount);
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
});

if (typeof global !== "undefined") {
    global.summarizeDashboard = summarizeDashboard;
    global.refreshDashboard = refreshDashboard;
    global.clearStickerCacheFromPopup = clearStickerCache;
    global.reloadStickerDataFromPopup = reloadStickerData;
    global.uploadStickerFilePayloadFromPopup = uploadStickerFilePayload;
    global.uploadSelectedStickerFromPopup = uploadSelectedStickerFromPopup;
}
