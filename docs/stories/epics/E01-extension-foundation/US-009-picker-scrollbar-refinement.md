# US-009 Picker Horizontal Scrollbar Refinement

## Status

implemented

## Lane

normal

## Product Contract

Thanh cuộn ngang của hàng lọc pack trong sticker picker phải mảnh, ít tương
phản, bo tròn và chỉ nổi rõ khi người dùng hover, focus trong hàng lọc hoặc kéo
thanh cuộn.

## Relevant Product Docs

- `docs/product/extension-roadmap.md`

## Acceptance Criteria

- [x] Scrollbar ngang của `.sticker-pack-filters` có độ dày 6px trên Chromium.
- [x] Thumb bo tròn và trong suốt khi không tương tác.
- [x] Hover hoặc focus trong hàng lọc làm thumb hiện ở mức tương phản dịu.
- [x] Thumb hiện rõ hơn khi được kéo.
- [x] Firefox nhận `scrollbar-width: thin` và màu mặc định trong suốt.

## Design Notes

- UI surface: `styles.css`, chỉ áp dụng cho hàng chip lọc pack của picker.
- Dùng `scrollbar-color` cho Firefox và `::-webkit-scrollbar` cho Chromium.
- Không thay đổi hành vi cuộn, bố cục chip hoặc trạng thái lọc pack.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | `npm test` kiểm tra các CSS contract của scrollbar. |
| Integration | `npm run validate`. |
| E2E | Không yêu cầu cho tinh chỉnh CSS hẹp này. |
| Platform | Không yêu cầu; Chromium và Firefox được bao phủ qua CSS chuyên biệt. |
| Release | Không yêu cầu. |

## Harness Delta

None.

## Evidence

- `npm test`
- `npm run validate`
