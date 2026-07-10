# Kế Hoạch Phát Triển Chatwork Sticker Extension

## Đích Đến

Tăng tần suất dùng sticker trước, xác nhận nhu cầu quản lý/chia sẻ pack sau,
rồi mới đầu tư Team Sticker Packs. Mọi phase phải giữ picker nhanh, không làm
gián đoạn việc chat và không mở rộng quyền dữ liệu không cần thiết.

## Phase 0 — Chốt Hướng Và Baseline

| Hạng mục | Công việc | Kết quả |
| --- | --- | --- |
| Phân khúc | Chọn `cá nhân`, `team nội bộ` hoặc `cộng đồng pack`. | Một persona chính và use case đầu tiên. |
| Baseline | Thống kê cục bộ sticker, favorite, recent, pack và lỗi ảnh. | Dashboard có số liệu trước phát hành. |
| Privacy | Quy định dữ liệu local và opt-in telemetry. | Quy tắc privacy ngắn, được chấp thuận. |
| UX | Phác thảo Quick Reactions desktop và viewport hẹp. | Wireframe với empty/loading/disabled states. |

Gate: không bắt đầu Team Sticker Packs nếu chưa chọn mô hình người dùng và quy
tắc dữ liệu.

## Phase 1 — Quick Reactions Và Lọc Pack

Mục tiêu: giảm việc chèn sticker xuống một click và xác nhận giá trị của pack.

| ID dự kiến | Phạm vi | Lane |
| --- | --- | --- |
| `US-006-quick-reactions-bar` | Thanh 6–8 sticker gần ô chat, bật/tắt trong popup, ưu tiên recent/favorite. | normal |
| `US-007-pack-filter-picker` | Tab/chip pack, filter, empty state và giữ image/tile cache. | normal |
| `US-008-local-usage-baseline` | Chỉ số dùng local, xem/xóa dữ liệu, không network telemetry. | normal |

Thiết kế:

- Dùng metadata `pack`, `previewId`, favorite và recent hiện có.
- Mọi lần chèn vẫn cần click rõ ràng từ user.
- Viewport hẹp chuyển thanh thành một nút mở popover, không che ô nhập.
- Popup lưu `quick_reactions_enabled` và nguồn sticker: `recent`, `favorite`
  hoặc `selected_pack`.

Acceptance criteria:

- Toggle còn sau reload; thanh chỉ render sticker hợp lệ.
- Click chèn đúng sticker và cập nhật recent.
- Filter pack hoạt động cùng search/favorite/recent, không tạo lại ảnh đã load.
- Có keyboard focus, `aria-label` và reduced-motion phù hợp.

Proof: unit cho chọn sticker, fallback rỗng, persistence và filter kết hợp;
`npm run test`, `npm run validate`; Chatwork smoke cho bật/tắt, chèn, màn hẹp
và refresh.

Success signal: Quick Reactions chiếm ít nhất 30% lượt chèn trong nhóm thử
nghiệm; nếu không gửi telemetry, đánh giá qua dashboard local và feedback.

`US-008-local-usage-baseline` đã hoàn tất: dashboard hiển thị aggregate 7 ngày
cho lượt chèn, tỷ lệ Quick Reactions, filter pack và import. Dữ liệu chỉ là bộ
đếm theo ngày trên thiết bị, giữ tối đa 90 ngày và có thể xóa độc lập.

## Phase 2 — Local Pack Manager Và Chia Sẻ Thủ Công

Mục tiêu: tổ chức và thử chia sẻ pack mà không có backend.

| ID dự kiến | Phạm vi | Lane |
| --- | --- | --- |
| `US-009-local-pack-manager` | Tạo, đổi tên, xóa, chỉnh metadata và ảnh đại diện pack. | normal |
| `US-010-pack-export-import` | Export/import JSON versioned, validate duplicate và preview trước import. | high-risk |
| `US-011-pack-health-report` | Báo sticker lỗi hoặc chưa gắn pack, hỗ trợ cleanup. | normal |

- Pack là metadata local; không di chuyển hoặc xóa file Chatwork.
- JSON export không chứa token Chatwork hay session data.
- Import phải preview thay đổi, báo trùng `previewId`, cho phép cancel và không
  ghi một phần khi validation thất bại.

Gate: `US-010` cần high-risk packet, decision về schema/ownership/rollback và
E2E proof trước phát hành.

Success signal: tester tạo hoặc import ít nhất một pack, và dùng pack filter
ngoài tab `All`.

## Phase 3 — Team Sticker Packs

Mục tiêu: pack dùng chung có phân quyền, đồng bộ và mời thành viên.

| ID dự kiến | Phạm vi | Lane |
| --- | --- | --- |
| `US-012-team-pack-auth` | Identity, đăng nhập và liên kết extension-account. | high-risk |
| `US-013-team-pack-permissions` | Owner/editor/viewer, mời và thu hồi quyền. | high-risk |
| `US-014-team-pack-sync` | API metadata, conflict policy và offline cache. | high-risk |
| `US-015-team-pack-discovery` | Link/mã mời, trang pack, cài hoặc theo dõi pack. | high-risk |

Quyết định bắt buộc trước khi code:

1. Backend, datastore, API và hosting.
2. Account identity; không dùng token Chatwork upload làm identity sản phẩm.
3. Model `Pack`, `Membership`, `StickerReference`, `Invite`.
4. Owner/editor/viewer, audit log, xoá pack/sticker.
5. Chỉ sync metadata/link Chatwork hay lưu asset riêng.

Acceptance criteria: user chỉ thấy pack được cấp quyền; chỉ owner/editor được
thay đổi; sync không mất favorite/recent local; thu hồi quyền chặn truy cập ở
lần sync sau; không gửi file/nội dung chat ngoài thao tác chủ động.

Gate: cần architecture decision, privacy review, high-risk story packets và
human approval.

## Phase 4 — Smart Reply Và Sticker Studio

| Tính năng | Bản đầu | Điều kiện mở rộng |
| --- | --- | --- |
| Smart Reply | Rule-based, local-only, user bật/tắt. | AI sau opt-in, data boundary và privacy review. |
| Sticker Studio | Text overlay, crop, template cục bộ; dùng upload hiện có. | AI image sau khi chốt chi phí, moderation và quyền nội dung. |

## Nguyên Tắc Xuyên Suốt

- Không thay đổi upload protocol Chatwork nếu feature không cần.
- State mới trong `chrome.storage.local` phải versioned và có migration rõ.
- Không có outbound telemetry hoặc nội dung chat theo mặc định.
- Mỗi story có unit, integration và Chatwork smoke tương ứng với rủi ro.
- Không làm picker tạo lại tile hoặc tải toàn bộ ảnh.

## Thứ Tự Khuyến Nghị

1. `US-006-quick-reactions-bar`.
2. `US-007-pack-filter-picker`.
3. Đánh giá baseline và feedback trước Phase 2.
4. `US-009-local-pack-manager`, sau đó `US-010-pack-export-import`.
5. Chỉ tạo packet Phase 3 khi nhu cầu chia sẻ được chứng minh.
