document.addEventListener("DOMContentLoaded", function () {
    let clearButton = document.getElementById("clearStickerCache");
    if (clearButton) {
        clearButton.addEventListener("click", function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "clear_sticker_cache" }, function (response) {
                        if (chrome.runtime.lastError) {
                            console.error("🚨 Error sending message:", chrome.runtime.lastError);
                        } else {
                            console.log("✅ Cache clear message sent:", response);
                            window.close();
                        }
                    });
                }
            });
        });
    }
});
