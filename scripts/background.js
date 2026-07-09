const CHATWORK_UPLOAD_CONFIG_KEY = "chatwork_upload_config_v1";
const CHATWORK_UPLOAD_URL_PATTERN = "*://www.chatwork.com/gateway/*";
const CHATWORK_DEFAULT_UPLOAD_URL = "https://www.chatwork.com/gateway/upload_file.php";

function isLikelyUploadRequest(details) {
    if (!details || details.method !== "POST" || typeof details.url !== "string") {
        return false;
    }

    let lowerPath = "";
    try {
        lowerPath = new URL(details.url).pathname.toLowerCase();
    } catch (_error) {
        lowerPath = details.url.toLowerCase().split("?")[0];
    }

    if (lowerPath.includes("upload") || lowerPath.includes("file")) {
        return true;
    }

    const formData = details.requestBody && details.requestBody.formData;
    return !!(formData && Object.keys(formData).some((key) => /file|upload|attachment/i.test(key)));
}

function firstValue(values) {
    if (!Array.isArray(values) || values.length === 0) return "";
    return typeof values[0] === "string" ? values[0] : "";
}

function extractChatworkToken(details) {
    const formData = details && details.requestBody && details.requestBody.formData || {};
    const directToken = firstValue(formData._t);
    if (directToken) return directToken;

    const pdata = firstValue(formData.pdata);
    if (!pdata) return "";

    try {
        const parsed = JSON.parse(pdata);
        return typeof parsed._t === "string" ? parsed._t : "";
    } catch (_error) {
        return "";
    }
}

function extractUploadConfig(details) {
    const formData = details.requestBody && details.requestBody.formData || {};
    const fields = {};
    let fileField = "";

    Object.keys(formData).forEach((key) => {
        const value = firstValue(formData[key]);
        if (!fileField && (/file|upload|attachment/i.test(key) || value === "")) {
            fileField = key;
            return;
        }
        fields[key] = value;
    });

    return {
        url: details.url,
        method: details.method,
        fields,
        fileField: fileField || "file",
        observedAt: new Date().toISOString(),
    };
}

function storeUploadConfig(config) {
    chrome.storage.local.set({ [CHATWORK_UPLOAD_CONFIG_KEY]: config });
}

function storeObservedToken(token) {
    if (!token) return;

    chrome.storage.local.get(CHATWORK_UPLOAD_CONFIG_KEY).then((res) => {
        const current = res[CHATWORK_UPLOAD_CONFIG_KEY] || {};
        const fields = current.fields && typeof current.fields === "object" ? current.fields : {};
        storeUploadConfig({
            url: current.url || CHATWORK_DEFAULT_UPLOAD_URL,
            method: current.method || "POST",
            fields: { ...fields, _t: token },
            fileField: current.fileField || "file",
            observedAt: new Date().toISOString(),
        });
    });
}

if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
    chrome.webRequest.onBeforeRequest.addListener((details) => {
        const token = extractChatworkToken(details);
        if (!isLikelyUploadRequest(details)) {
            storeObservedToken(token);
            return;
        }

        const config = extractUploadConfig(details);
        if (token && !config.fields._t) {
            config.fields._t = token;
        }
        storeUploadConfig(config);
    }, {
        urls: [CHATWORK_UPLOAD_URL_PATTERN],
        types: ["xmlhttprequest"],
    }, ["requestBody"]);
}
