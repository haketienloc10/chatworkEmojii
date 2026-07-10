# Đề Xuất: Settings Riêng và Quản Lý Sticker

## Mục Tiêu

Tách các thiết lập và thao tác quản lý dài hạn khỏi extension popup. Popup giữ
vai trò thao tác nhanh khi đang dùng Chatwork; trang Settings là nơi người dùng
tùy biến giao diện, sắp xếp và quản lý sticker an toàn.

## Phạm Vi

- Có trang Settings riêng cho extension, mở từ nút `Settings` hoặc biểu tượng
  bánh răng trong popup.
- Cho phép chọn các mục được hiển thị trong popup.
- Cho phép kéo thả để sắp xếp sticker theo lựa chọn cá nhân.
- Cho phép xóa mềm sticker vào Thùng rác và khôi phục lại sau đó.
- Bổ sung công cụ quản lý pack, dữ liệu và chất lượng sticker.

## Nguyên Tắc Thiết Kế

1. Popup phục vụ thao tác nhanh; Settings phục vụ cấu hình và quản trị.
2. Không sửa `data/*.json` chỉ vì người dùng cá nhân đổi thứ tự hoặc ẩn sticker.
3. Xóa mặc định là xóa mềm, có thể hoàn tác và khôi phục.
4. Toàn bộ preferences lưu cục bộ trong `chrome.storage.local`.
5. Không gửi dữ liệu Chatwork hay metadata sticker ra bên ngoài.

## Cấu Trúc Trang Settings

### 1. Tổng Quan

- Tổng số sticker, sticker imported, favorite, recent và sticker trong Thùng rác.
- Dung lượng dữ liệu extension lưu cục bộ.
- Shortcut tới `Quản lý sticker`, `Thùng rác` và `Dữ liệu`.

### 2. Hiển Thị Popup

Người dùng bật/tắt từng khối trong popup:

- Thống kê sticker.
- Quick Reactions.
- Khu vực upload sticker.
- Các nút cache (`Reload data`, `Clear sticker cache`).
- Thống kê usage cục bộ.

Các thao tác quan trọng như mở Settings và báo trạng thái vẫn được giữ rõ ràng.
Popup cần áp dụng thay đổi ngay sau khi lưu.

### 3. Quản Lý Sticker

- Tìm kiếm và lọc theo tên, tag, pack, nguồn và trạng thái.
- Chế độ `Sắp xếp`: kéo thả sticker trong grid để tạo thứ tự cá nhân.
- Chọn nhiều sticker để ẩn, chuyển vào Thùng rác hoặc gán pack; click trực tiếp
  trên card để chọn hoặc click lại để bỏ chọn.
- `Reset thứ tự` để quay về thứ tự mặc định từ dữ liệu extension.
- Có thể mở rộng sau này bằng hàng `Pinned stickers`, độc lập với Favorite.
- Grid quản lý tự co giãn theo chiều rộng trang; card có thumbnail cố định, tên
  và pack được rút gọn một dòng để thao tác chọn/sắp xếp không làm tràn layout.
- Thanh công cụ tách nhóm thao tác và nhóm tìm kiếm/lọc; trên màn hình hẹp các
  nhóm tự xuống dòng thay vì tạo thanh cuộn ngang.

Thứ tự tùy chỉnh chỉ lưu một danh sách `previewId` trong local storage. Sticker
mới hoặc sticker chưa có trong danh sách sẽ đứng sau các sticker đã được sắp
xếp, theo thứ tự mặc định.

### 4. Thùng Rác

Khi chọn xóa, sticker bị loại khỏi picker, Favorite, Recent và Quick Reactions
nhưng chưa bị xóa vĩnh viễn.

- Hiển thị thumbnail, tên/`previewId`, pack và thời điểm xóa.
- Nút `Khôi phục` một-click đưa sticker về pack cũ và khôi phục thứ tự nếu còn
  hợp lệ.
- Snackbar sau thao tác: `Đã chuyển 5 sticker vào Thùng rác — Hoàn tác`.
- Tự dọn mục trong Thùng rác sau 30 ngày; trước khi dọn cần hiển thị số ngày
  còn lại.
- `Xóa vĩnh viễn` cần xác nhận rõ số sticker bị tác động.

Sticker bundled từ `data/*.json` chỉ bị ẩn cục bộ khi người dùng xóa. Sticker
do người dùng import có thể được xóa vĩnh viễn khỏi local storage sau xác nhận.

### 5. Pack và Chất Lượng Sticker

- Ẩn/hiện cả pack thay vì phải thao tác từng sticker.
- Đổi tên pack cục bộ và chọn màu hoặc emoji đại diện.
- Phát hiện sticker trùng `previewId` hoặc URL khi import.
- Health check liệt kê ảnh lỗi và cho phép chuyển hàng loạt vào Thùng rác.

### 6. Dữ Liệu

- Export/import preferences: thứ tự, sticker ẩn, sticker ghim và cấu hình popup.
- Không export cache, Chatwork session hoặc dữ liệu upload runtime.
- Reset riêng từng nhóm: giao diện, thứ tự sticker, Thùng rác và usage metrics.

## Mô Hình Dữ Liệu Đề Xuất

Các keys dự kiến trong `chrome.storage.local`:

```text
sticker_popup_preferences_v1
sticker_custom_order_v1
sticker_hidden_preview_ids_v1
sticker_trash_v1
sticker_pinned_preview_ids_v1
sticker_pack_preferences_v1
```

`sticker_trash_v1` cần lưu ít nhất `previewId`, snapshot metadata, `deletedAt`,
`originalPack` và `originalOrderIndex`. Snapshot giúp vẫn có thể hiển thị và
khôi phục một sticker imported khi cache đã được làm mới.

## Tương Tác và Khả Năng Dùng

- `Ctrl/Cmd + Z` hoàn tác lần xóa gần nhất khi Settings đang mở.
- `Esc` thoát chế độ sắp xếp hoặc đóng dialog xác nhận.
- Kéo thả cần có phương án keyboard tương đương: chọn sticker, rồi `Move up`,
  `Move down`, `Move to top` và `Move to bottom`.
- Không cho phép kéo-thả trực tiếp trong picker khi đang chat để tránh làm chậm
  thao tác chèn sticker; chỉ thực hiện trong Settings.

## Lộ Trình Khuyến Nghị

1. Tạo Settings page và liên kết từ popup.
2. Thêm Visibility controls cho popup và Quick Reactions.
3. Thêm xóa mềm, Thùng rác, khôi phục và undo.
4. Thêm custom order bằng kéo-thả và reset thứ tự.
5. Thêm bulk actions, export/import preferences, pack manager và health check.

## Rủi Ro và Validation

Xóa sticker là thay đổi dữ liệu cục bộ, nên cần kiểm thử kỹ các tình huống:

- Xóa không được làm mất sticker vĩnh viễn trước khi người dùng xác nhận.
- Khôi phục phải trả sticker về picker và loại khỏi Thùng rác.
- Cache reload không được làm mất `hidden`, `trash` hay `customOrder`.
- Sticker đã xóa không còn hiện ở Favorite, Recent hoặc Quick Reactions.
- Reset thứ tự chỉ xóa preference thứ tự, không đụng vào sticker source data.

## Ngoài Phạm Vi

- Đồng bộ Settings, Thùng rác hoặc thứ tự sticker giữa thiết bị.
- Chia sẻ pack qua backend hoặc thay đổi giao thức upload Chatwork.
- Gửi telemetry hoặc nội dung Chatwork ra dịch vụ bên ngoài.
