$(document).ready(function() {
    setTimeout(() => {
        addStickerButton();
        preloadStickerPanel();
    }, 3000);

    let stickerButtonRetryCount = 0;
    let stickerButtonRetry = setInterval(() => {
        addStickerButton();
        stickerButtonRetryCount += 1;

        if (document.querySelector("#_sticker") || stickerButtonRetryCount >= 30) {
            clearInterval(stickerButtonRetry);
        }
    }, 1000);
});

function loadStickers() {
    let cachedStickers = localStorage.getItem("sticker_cache");

    if (cachedStickers) {
        console.log("📌 Sử dụng sticker từ cache");
        return Promise.resolve(JSON.parse(cachedStickers));
    }

    console.log("📥 Tải sticker từ file JSON...");
    return fetch(chrome.runtime.getURL("data/file_list.json"))
        .then(response => {
            if (!response.ok) {
                throw new Error(`❌ Lỗi khi tải file_list.json: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.files || !Array.isArray(data.files)) {
                throw new Error("❌ file_list.json không chứa danh sách hợp lệ!");
            }

            let filePromises = data.files.map(file =>
                fetch(chrome.runtime.getURL(`data/${file}`))
                    .then(res => {
                        if (!res.ok) throw new Error(`❌ Lỗi khi tải ${file}: ${res.status} ${res.statusText}`);
                        return res.json();
                    })
                    .catch(err => {
                        console.error(`⚠️ Lỗi khi tải ${file}:`, err);
                        return []; // Trả về mảng rỗng để không bị lỗi khi `.flat()`
                    })
            );

            return Promise.all(filePromises);
        })
        .then(results => {
            let stickers = results.reverse().flat();
            console.log("📸 Danh sách ảnh được cập nhật:", stickers);

            // Lưu vào cache
            localStorage.setItem("sticker_cache", JSON.stringify(stickers));

            return stickers; // Trả về danh sách sticker
        })
        .catch(error => {
            console.error("❌ Lỗi khi tải danh sách file:", error);
            return []; // Đảm bảo luôn trả về mảng để tránh lỗi `.forEach()`
        });
}

function preloadStickerPanel() {
    let existingPanel = document.querySelector("#stickerPanel");
    if (existingPanel) return;

    let stickerPanel = document.createElement("div");
    stickerPanel.id = "stickerPanel";
    stickerPanel.className = "stickerPanel";
    stickerPanel.style.display = "none";
    document.body.appendChild(stickerPanel);

    loadStickers().then(stickers => {
        if (!stickers || !Array.isArray(stickers) || stickers.length === 0) {
            stickerPanel.innerHTML = "<p>❌ Không có sticker nào!</p>";
            return;
        }

        stickerPanel.innerHTML = stickers.map(item => `
            <img src="${item.url}" alt="${item.id}" class="sticker-img" data-id="${item.id}">
        `).join("");

        document.querySelectorAll(".sticker-img").forEach(img => {
            img.addEventListener("click", (event) => {
                insertStickerToChat(event.target.getAttribute("data-id"));
                stickerPanel.style.display = "none"; // Tắt panel sau khi chọn sticker
            });
        });
    });
}

function addStickerButton() {
    let emojiList = findChatworkToolbar();
    if (!emojiList) return;

    // Kiểm tra xem đã có nút sticker chưa
    if (document.querySelector("#_sticker")) return;

    // Tạo nút sticker
    let stickerWrapper = document.createElement("div");
    stickerWrapper.className = "_showDescription";
    stickerWrapper.setAttribute("data-tooltip", "Sticker");

    let emojiItem = emojiList.querySelector('[data-tooltip*="Emoji"]');
    let buttonContainer = document.createElement("div");
    buttonContainer.className = emojiItem && emojiItem.firstElementChild ? emojiItem.firstElementChild.className : "";

    let stickerButton = document.createElement("button");
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

    // Thêm nút sticker vào danh sách emoji
    buttonContainer.appendChild(stickerButton);
    stickerWrapper.appendChild(buttonContainer);
    if (emojiItem) {
        emojiItem.before(stickerWrapper);
    } else {
        emojiList.prepend(stickerWrapper);
    }

    stickerButton.addEventListener("click", (event) => {
        event.stopPropagation(); // Ngăn việc click làm đóng panel ngay lập tức
        toggleStickerPanel();
    });

    if (!document.body.dataset.stickerClickListener) {
        document.body.dataset.stickerClickListener = "true";
        document.addEventListener("click", (event) => {
            let stickerPanel = document.querySelector("#stickerPanel");
            if (stickerPanel && !stickerPanel.contains(event.target) && event.target.id !== "_sticker") {
                stickerPanel.style.display = "none";
            }
        });
    }
}

function findChatworkToolbar() {
    let sendArea = document.querySelector("#_chatSendArea");
    if (!sendArea) return null;

    let emojiButton = sendArea.querySelector('[data-tooltip*="Emoji"]');
    if (emojiButton) {
        return emojiButton.closest("ul");
    }

    return sendArea.querySelector("ul");
}

function toggleStickerPanel() {
    let stickerPanel = document.querySelector("#stickerPanel");

    if (stickerPanel) {
        stickerPanel.style.display = (stickerPanel.style.display === "none") ? "grid" : "none";
    }
}

function insertStickerToChat(stickerId) {
    let chatInput = document.querySelector("#_chatText") || document.querySelector("textarea");
    if (chatInput) {
        chatInput.value += ` ${stickerId} `;
        let event = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(event);
        chatInput.focus();
    }
}

function observeChatContent() {
    let chatContent = document.querySelector("#_chatSendArea");

    if (!chatContent) return;

    addStickerButton();

    // Tạo MutationObserver để theo dõi thay đổi trong #_chatSendArea
    let observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === "childList" || mutation.type === "subtree") {
                setTimeout(() => {
                    let stickerPanel = document.querySelector("#stickerPanel");
                    if (stickerPanel) {
                        stickerPanel.style.display = "none";
                    }
                    addStickerButton();
                }, 100);
            }
        }
    });

    // Bắt đầu theo dõi các thay đổi trong thẻ #_chatContent
    observer.observe(chatContent, { childList: true, subtree: true, characterData: false });
}

$(document).ready(function() {
    setTimeout(() => {
        observeChatContent();
    }, 5000);
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "clear_sticker_cache") {
        localStorage.removeItem("sticker_cache");
        console.log("🗑️ Sticker cache cleared!");
        sendResponse({ status: "success" });
    }
});
