# Lộ Trình Phát Triển Chatwork Sticker Extension

## Mục Tiêu Sản Phẩm

Biến extension hiện tại từ một sticker grid đơn giản thành sticker picker cho
Chatwork: nhanh, vui, dễ tìm, dễ quản lý và ít gây cản trở khi đang chat.

Extension nên giúp người dùng:

- Chèn sticker vào Chatwork nhanh hơn việc copy `[preview id=...]` thủ công.
- Tìm lại sticker hay dùng trong vài giây.
- Tạo cảm giác vui vẻ khi phản hồi tin nhắn bằng sticker.
- Quản lý bộ sticker mà không cần sửa JSON bằng tay mỗi lần.

## Hiện Trạng Đã Quan Sát

Ngày 2026-07-08, kiểm tra repo và tab Chatwork đang chạy qua Chrome DevTools:

- Extension dùng Chrome Manifest V3.
- `scripts/content.js` thêm nút `#_sticker` vào toolbar Chatwork.
- Sticker data được load từ `data/file_list.json` và các file JSON trong `data/`.
- Cache sticker đang dùng `localStorage` key `sticker_cache`.
- Click sticker chèn chuỗi `[preview id=<file_id> ht=<height>]` vào textarea Chatwork.
- Live DOM có 157 sticker trong panel.
- Có 72/157 sticker bị broken image (`naturalWidth = 0`), gây lộ alt text `[preview id=...]`.
- Panel hiện tại là fixed modal giữa màn hình, dễ che lịch sử chat.
- Popup extension mới có một action: xóa cache sticker.
- Repo chưa có `package.json`, script validate, lint, test, hoặc tài liệu product chi tiết.

## Vấn Đề Ưu Tiên

### 1. Dữ liệu sticker chưa đáng tin

Một số URL dùng absolute `https://www.chatwork.com/...`, một số URL dùng relative
`gateway/download_file.php?...`. Nhiều file id cũ có thể đã hết quyền truy cập,
bị xóa, hoặc không render được với user hiện tại.

Tác động:

- Panel nhìn lỗi vì hiện alt text.
- Người dùng mất niềm tin vào sticker picker.
- Khó biết data nào còn dùng nếu không mở Chatwork để kiểm tra tay.

### 2. UI panel chưa hợp với ngữ cảnh chat

Panel đang nằm giữa màn hình, kích thước cố định 400px, grid 6 cột. Khi mở, nó
che nội dung chat và không gắn với nút trên toolbar.

Tác động:

- Cảm giác như modal debug hơn là picker native.
- Khó dùng khi màn hình nhỏ hoặc Chatwork có sidebar rộng.
- Danh sách dài nhưng không có tìm kiếm, lọc, favorite.

### 3. Luồng thêm sticker mới còn thủ công

`getImage.js` có logic scan ảnh nhưng chưa thành tool sản phẩm. Người maintain
vẫn phải tự scan, copy JSON, chọn file date, cập nhật `file_list.json`.

Tác động:

- Dễ duplicate.
- Dễ thêm URL sai.
- Không có validation trước khi commit.

### 4. Thiếu proof và tài liệu vận hành

README gần như trống. Không có checklist cài đặt local, cách load unpacked
extension, cách test trên Chatwork, hoặc cách validate data.

Tác động:

- Agent hoặc developer tiếp theo phải đọc code từ đầu.
- Khó phân biệt lỗi extension, lỗi data, và lỗi Chatwork DOM thay đổi.

## Nguyên Tắc Thiết Kế

- Picker phải mở nhanh, không che nội dung chat quá nhiều.
- Ưu tiên thao tác lặp lại: recent, favorite, search, keyboard.
- Ảnh lỗi phải được ẩn hoặc hiện placeholder gọn, không lộ technical text.
- Data sticker phải có metadata để mở rộng: `id`, `url`, `name`, `tags`, `pack`,
  `createdAt`, `height`, `source`.
- Mỗi tính năng vui phải giữ chat flow nhanh, không biến extension thành popup
  phức tạp.

## Lộ Trình Phát Triển

### Phase 1: Ổn định nền tảng

Mục tiêu: extension không còn cảm giác lỗi và có đủ tài liệu để maintain.

Công việc:

- Chuẩn hóa data sticker.
  - Dùng một schema thống nhất cho sticker item.
  - Chuyển URL relative/absolute về một format rõ ràng.
  - Tách `previewId` và `height` ra field riêng thay vì chỉ nằm trong `id`.
- Thêm broken image handling.
  - Khi ảnh lỗi, hiện placeholder nhỏ gọn.
  - Không để alt text `[preview id=...]` tràn ra UI.
  - Có cơ chế ẩn sticker lỗi trong phiên hiện tại.
- Thêm script validate data.
  - Kiểm tra JSON parse được.
  - Kiểm tra field bắt buộc.
  - Kiểm tra duplicate `id`/`previewId`.
  - Báo cáo URL đáng nghi ngờ.
- Viết README thực dụng.
  - Cách load unpacked extension.
  - Cách reload extension sau khi sửa code.
  - Cách clear cache.
  - Cách thêm sticker mới.
- Giảm phụ thuộc không cần thiết.
  - Đánh giá việc bỏ jQuery trong content script.
  - Tách logic load data, render panel, insert sticker thành các hàm nhỏ để test.

Tiêu chí hoàn thành:

- Mở Chatwork thấy nút sticker ổn định.
- Panel không lộ alt text khi ảnh lỗi.
- Có lệnh validate data chạy được local.
- README đủ để người mới cài và test extension.

### Phase 2: Picker dùng sướng hằng ngày

Mục tiêu: người dùng tìm và chèn sticker trong 1-2 thao tác.

Công việc:

- Chuyển panel thành popover neo gần toolbar.
  - Đặt gần nút sticker thay vì fixed giữa màn hình.
  - Tự canh trái/phải theo viewport.
  - Giới hạn chiều cao theo khoảng trống còn lại.
- Thêm search.
  - Tìm theo `name`, `tags`, `pack`, `previewId`.
  - Debounce input để tránh render lại quá nhiều.
  - Highlight hoặc sắp xếp kết quả liên quan lên trước.
- Thêm tabs.
  - `Recent`: sticker vừa dùng.
  - `Favorite`: sticker đã pin.
  - `All`: toàn bộ sticker.
  - `New`: sticker từ pack mới nhất.
- Thêm favorite.
  - Click icon sao/pin trên sticker.
  - Lưu bằng `chrome.storage.local` thay vì `localStorage` trong page context.
- Thêm recent.
  - Lưu tối đa 20 sticker gần nhất.
  - Đưa sticker mới dùng lên đầu.
- Thêm keyboard support.
  - `Esc` đóng picker.
  - Arrow keys di chuyển selection.
  - `Enter` chèn sticker đang focus.
  - `/` hoặc focus tự động vào search khi mở picker.
- Lazy-load ảnh.
  - Chỉ load item trong viewport hoặc dùng `loading="lazy"`.
  - Giảm tải cho Chatwork khi danh sách tăng.

Tiêu chí hoàn thành:

- Search trả kết quả dưới 100ms với tập data hiện tại.
- Favorite/recent vẫn còn sau khi refresh Chatwork.
- Picker không che input và không làm layout Chatwork bị nhảy.

### Phase 3: Tính năng vui và giải trí

Mục tiêu: extension có cá tính riêng, khiến người dùng muốn dùng thường xuyên.

Công việc:

- Random Sticker.
  - Nút random trong picker.
  - Có tùy chọn random trong pack hiện tại hoặc toàn bộ.
- Mood Packs.
  - Tạo nhóm sticker theo cảm xúc: `LOL`, `OK`, `Angry`, `Deadline`,
    `Ship it`, `Thanks`, `Monday`, `Drama`.
  - Cho phép filter nhanh bằng chip/tag.
- Sticker Roulette.
  - Click giữ nút random để quay sticker.
  - Thả chuột để chèn sticker đang dừng.
  - Giới hạn animation nhẹ để không gây phiền.
- Quick Reactions.
  - Hiện 6 sticker hay dùng gần input.
  - User có thể bật/tắt trong popup.
- Combo Mode.
  - Cho phép chọn 2-3 sticker rồi insert một lần.
  - Hữu ích cho phản hồi vui hoặc spam có kiểm soát.
- Seasonal Packs.
  - Pack theo ngày lễ, release, deadline, sinh nhật, Tết.
  - Có badge `new` cho pack mới.

Tiêu chí hoàn thành:

- Tính năng vui không làm flow chèn sticker chậm hơn.
- User có thể tắt các tính năng chiếm diện tích.
- Random và recent dùng cùng metadata, không hard-code riêng.

### Phase 4: Quản lý sticker và công cụ nội bộ

Mục tiêu: việc thêm, sửa, kiểm tra sticker trở thành quy trình có thể lặp lại.

Công việc:

- Nâng cấp popup extension thành dashboard nhỏ.
  - Tổng số sticker.
  - Số sticker lỗi gần nhất.
  - Nút clear cache.
  - Nút reload data.
  - Toggle quick reactions.
  - Export/import favorites.
- Viết sticker import workflow.
  - Paste danh sách Chatwork image URL.
  - Tự sinh `previewId`, `id`, `url`, `height`.
  - Chọn `pack`, `tags`, `name`.
- Nâng cấp `getImage.js`.
  - Từ script debug thành tool có hướng dẫn rõ.
  - Scan ảnh trong Chatwork room hiện tại.
  - Xuất JSON đúng schema.
  - Báo duplicate với data đã có.
- Thêm validation nâng cao.
  - Optional live check ảnh qua Chatwork page context.
  - Report sticker bị lỗi theo pack/file.
  - Đề xuất remove/replace sticker lỗi.
- Thêm release checklist.
  - Update version trong `manifest.json`.
  - Run validate.
  - Manual smoke test trên Chatwork.
  - Capture screenshot picker.

Tiêu chí hoàn thành:

- Thêm pack mới không cần sửa tay nhiều file.
- Có report rõ trước khi release nếu sticker chết.
- Popup extension trở thành nơi điều khiển có ích, không chỉ là nút clear cache.

## Backlog Chi Tiết

### Nền tảng kỹ thuật

- Tạo `package.json` với scripts:
  - `validate:data`
  - `format`
  - `lint` nếu thêm ESLint
- Viết `scripts/validate-data.js`.
- Chuyển storage user preference sang `chrome.storage.local`.
- Thêm constant cho selectors Chatwork:
  - `#_chatSendArea`
  - `#_chatText`
  - `[data-tooltip*="Emoji"]`
- Gom retry/observer logic để tránh add listener nhiều lần.
- Thêm version cho cache, ví dụ `sticker_cache_v2`.

### UI/UX

- Popover neo gần nút sticker.
- Header picker gồm search, random, close.
- Tabs recent/favorite/all/new.
- Sticker tile có hover state nhẹ.
- Broken tile placeholder.
- Empty state cho search không có kết quả.
- Responsive width:
  - desktop: 360-440px
  - narrow screen: min viewport width minus margin
- Không dùng emoji/unicode trong button nếu icon có thể thay thế bằng asset/icon.

### Data

- Định nghĩa schema:

```json
{
  "previewId": "2034466880",
  "id": "[preview id=2034466880 ht=150]",
  "url": "https://www.chatwork.com/gateway/preview_file.php?bin=1&preview=1&file_id=2034466880",
  "height": 150,
  "name": "example sticker",
  "tags": ["lol", "ok"],
  "pack": "20260417",
  "createdAt": "2026-04-17",
  "source": "chatwork"
}
```

- Giữ backward compatibility với data cũ trong một release.
- Viết migration helper đọc từ data cũ và sinh field mới.
- Sắp xếp sticker theo `createdAt` mới nhất trước, nhưng recent/favorite có ưu tiên riêng.

### Chatwork integration

- Kiểm tra lại selector khi Chatwork thay đổi DOM.
- Khi insert sticker:
  - Chèn vào vị trí cursor, không chỉ append cuối textarea.
  - Giữ focus input.
  - Dispatch `input` event như hiện tại.
- Nếu chat input không tìm thấy:
  - Hiện thông báo nhỏ trong panel.
  - Không fail silent.

### Tài liệu

- README:
  - Giới thiệu extension.
  - Cài đặt local.
  - Cách test trên Chatwork.
  - Cách thêm sticker.
  - Troubleshooting.
- Product docs:
  - Roadmap này.
  - Sticker data contract sau khi schema mới được chấp nhận.
- Stories:
  - Tạo story riêng cho Phase 1 khi bắt đầu implement.
  - Tạo story riêng cho picker UX khi bắt đầu Phase 2.

## Thứ Tự Implement Đề Xuất

1. Tạo `package.json` và `validate:data`.
2. Thêm broken image placeholder và ẩn alt text trong panel.
3. Cập nhật README.
4. Refactor nhẹ `content.js` để tách load/render/insert.
5. Đổi panel sang popover neo toolbar.
6. Thêm search.
7. Thêm recent/favorite với `chrome.storage.local`.
8. Thêm random sticker.
9. Thêm mood packs và metadata data.
10. Nâng cấp popup dashboard.
11. Nâng cấp tool scan/import sticker.
12. Thêm release checklist và smoke-test docs.

## Ranh Giới Không Nên Làm Ngay

- Không upload sticker lên server riêng nếu chưa có nhu cầu chia sẻ giữa team.
- Không thêm backend khi data JSON nội bộ vẫn đủ.
- Không chèn UI quá lớn vào Chatwork sidebar trước khi picker ổn định.
- Không làm AI sticker generation trong extension lúc đầu; nếu cần, nên làm tool riêng ngoài extension.

## Rủi Ro Và Cách Giảm

- Chatwork DOM thay đổi: gom selector vào một nơi và có fallback.
- File preview hết quyền truy cập: validate live và placeholder broken image.
- Data tăng lớn làm panel chậm: lazy-load, search debounce, virtual list nếu vượt vài ngàn item.
- Storage bị lệch giữa page và extension: dùng `chrome.storage.local` cho user preferences.
- Feature vui gây phiền: mỗi tính năng chiếm diện tích nên có toggle hoặc nằm trong menu.

## Validation Đề Xuất

Quick checks:

- `npm run validate:data`
- `npm run format`
- Manual load unpacked extension trong Chrome.
- Reload Chatwork, xác nhận nút sticker xuất hiện.
- Mở picker, search, favorite, recent, random.
- Click sticker, xác nhận textarea nhận đúng token.
- Xóa cache từ popup, reload data thành công.

Live QA:

- Capture screenshot picker đóng/mở.
- Kiểm tra broken image count trong DOM.
- Test với ít nhất 2 Chatwork room.
- Test khi textarea đang có cursor giữa nội dung.

## Milestone Đầu Tiên Đề Xuất

Milestone đầu tiên nên là `Phase 1: Stable Picker Foundation`.

Phạm vi nên gồm:

- Data validation script.
- Broken image placeholder.
- README cài đặt/test.
- Refactor nhẹ `content.js` để tách load/render/insert.
- Ghi story và proof trong Harness.

Không gom search/favorite/random trong milestone đầu tiên. Làm vậy sẽ giữ blast
radius nhỏ và tạo nền tảng để các feature sau dễ test hơn.
