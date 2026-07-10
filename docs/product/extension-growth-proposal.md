# Đề Xuất Phát Triển Chatwork Sticker Extension

## Bối Cảnh

Extension hiện có sticker picker, search, favorite, recent, random, lazy-load,
dashboard và luồng upload ảnh thành sticker. State hiện lưu cục bộ bằng
`chrome.storage.local`, nên rất tốt cho một cá nhân nhưng chưa có khả năng
chia sẻ, khám phá và quản trị nội dung theo team.

## Mục Tiêu

Biến extension thành công cụ biểu đạt cho team dùng Chatwork, nhưng vẫn giữ
thao tác chèn sticker trong một hoặc hai hành động.

## Hướng Sản Phẩm

### 1. Team Sticker Packs

Tạo pack theo team, dự án hoặc chiến dịch như `Marketing`, `Dev`, `Support`,
`Tết 2027`; chia sẻ bằng link hoặc mã mời; owner quản lý và editor bổ sung
sticker.

- Giá trị: tạo lý do để cả room cài extension, nuôi văn hóa team và có tiềm
  năng thương mại hóa theo team.
- Điều kiện: cần dịch vụ đồng bộ, identity và phân quyền. Đây là high-risk vì
  có auth, authorization, dữ liệu dùng chung và public API.

### 2. Quick Reactions Bar

Hiển thị 6–8 sticker cạnh ô nhập Chatwork, lấy từ recent, favorite hoặc pack
đang chọn; có thể bật/tắt trong popup.

- Giá trị: chèn sticker bằng một click, nên là hướng tăng retention hằng ngày
  tốt nhất.
- Khả thi: tái sử dụng metadata và persistence đã có; không cần backend.

### 3. Pack Discovery và Pack Manager

Lọc theo pack trong picker; tạo, đổi tên, đặt ảnh đại diện, export/import pack
JSON và xem sức khỏe sticker theo pack.

- Giá trị: quản lý bộ sưu tập lớn tốt hơn và thử chia sẻ JSON trước khi đầu tư
  backend.
- Vai trò: chuẩn hóa model pack để chuẩn bị cho Team Sticker Packs.

### 4. Smart Reply Stickers

Gợi ý sticker từ các từ khóa quen thuộc như `xong`, `cảm ơn`, `deadline`, `lỗi`.
Bản đầu chạy rule-based hoàn toàn trong trình duyệt; không gửi nội dung Chatwork
ra ngoài. AI chỉ là lựa chọn sau khi có opt-in và privacy review.

### 5. Sticker Studio

Tạo sticker từ ảnh, template meme, text và logo team, rồi dùng upload workflow
hiện có để import ngay vào picker.

- Đây là hướng khác biệt và có sức hút sáng tạo cao.
- Nếu dùng AI/dịch vụ tạo ảnh, cần cân nhắc chi phí, moderation và bản quyền;
  không nên ưu tiên trước pack chia sẻ.

## Ưu Tiên Khuyến Nghị

1. Phát hành `Quick Reactions Bar` cùng filter theo pack.
2. Thêm `Pack Manager` và export/import JSON để kiểm chứng nhu cầu chia sẻ.
3. Thiết kế Team Sticker Packs chỉ khi có tín hiệu dùng pack rõ ràng.
4. Phát triển Smart Reply local-first, rồi Sticker Studio ở giai đoạn khác biệt.

## Chỉ Số Cần Theo Dõi

Mặc định chỉ lưu số liệu cục bộ; phải có opt-in trước khi gửi telemetry ra ngoài.

- Lượt chèn mỗi tuần và tỷ lệ chèn từ Quick Reactions.
- Tỷ lệ tạo, import hoặc lọc pack.
- Tỷ lệ dùng lại sticker favorite.
- Khi có Team Packs: số thành viên hoạt động và tỷ lệ pack được chia sẻ.

## Phạm Vi Không Thuộc Đề Xuất

- Không thay đổi giao thức upload Chatwork hiện có.
- Không gửi nội dung chat, sticker hoặc metadata ra dịch vụ bên ngoài khi chưa
  có thiết kế privacy, opt-in và phê duyệt riêng.
- Không xây backend đồng bộ cùng story Quick Reactions.

## Cơ Sở Hiện Trạng

- `US-002` và `US-003` đã hoàn tất picker, search, tabs, favorite, recent,
  random, keyboard và image queue.
- `US-004` đã hoàn tất dashboard popup và controls cache/upload.
- `US-005` đã có upload/import thực tế từ Chatwork.
- `chrome.storage.local` chỉ là dữ liệu cục bộ, chưa thể chia sẻ pack giữa
  người dùng hoặc thiết bị.

## Ghi Chú Nghiên Cứu

Đề xuất dựa trên mã nguồn, product records và story proof trong repository.
Không có capability external research được đăng ký trong Harness khi nghiên cứu,
nên chưa bao gồm số liệu Chrome Web Store hoặc thị trường Chatwork hiện tại.
