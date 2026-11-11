# Báo cáo kiểm thử tổng hợp — CinePrime v2

Ngày chạy: 11/11/2026 · Nhánh: `master` (chưa commit) · Môi trường: Expo SDK 58 dev server cổng 8099, MongoDB Atlas (dữ liệu dev), TMDB thật, chữ ký VNPay sandbox, Gemini `gemini-flash-latest`, Android emulator Pixel 7 (Expo Go).

## Kết quả tóm tắt

| Hạng mục | Kết quả |
|---|---|
| Kiểm tra kiểu `npx tsc --noEmit` | Đạt, 0 lỗi |
| Lint `npx expo lint` | Đạt, 0 lỗi, 0 cảnh báo |
| Kiểm thử API end-to-end `scripts/api-test.mjs` | **51/51 đạt** |
| Kiểm thử giao diện trên emulator (thủ công, 10 màn hình) | Đạt, 1 lỗi phát hiện và đã sửa (xem mục 5) |

## 1. Cách chạy lại

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:8099 npx expo start --port 8099      # terminal 1
API_URL=http://localhost:8099 node --env-file-if-exists=.env.local scripts/api-test.mjs
```

Script ghi kết quả chi tiết vào `docs/test-results/api-test.json`. Script **tạo dữ liệu thật**: nhập một phim từ TMDB, mở kế hoạch phát hành, tạo suất chiếu, đặt vé, và một tài khoản `qa_…`. Phim kiểm thử cuối cùng bị ẩn (kế hoạch tạm ngưng/đóng) nhưng còn một vé đã thanh toán của tài khoản `user`.

## 2. Kiểm thử API (51 ca)

| Nhóm | Số ca | Nội dung chính |
|---|---|---|
| A. Public | 5/5 | 5 rạp Cần Thơ có giờ mở cửa, phòng, hồ sơ nhu cầu; danh sách phim theo rạp; 404 tiếng Việt; URL kiểu Java cũ (`/api/movies/public`, `/api/payments/fake-pay`) đã trả 404 |
| B. Xác thực & phân quyền | 5/5 | Đăng nhập admin/user; sai mật khẩu 401; thiếu token 401; khách gọi API admin 403; đăng ký tài khoản mới |
| C. Vòng đời phim | 8/8 | TMDB tự điền (tiêu đề, thời lượng, độ tuổi, diễn viên, độ phổ biến); nhập tạo bản **DRAFT** không công khai; nhập trùng 409; sửa sai 400; DRAFT không được mở kế hoạch (409); duyệt → **APPROVED** nhưng vẫn ẩn khi chưa có kế hoạch |
| D. Kế hoạch phát hành | 4/4 | Mở tại 2 rạp; trùng rạp được bỏ qua kèm lý do; phim hiện "Sắp chiếu" ở rạp có kế hoạch, ẩn ở rạp khác; chuyển trạng thái sai 409 |
| E. Tạo suất tự động | 11/11 | Xem mục 3 |
| F. Bảng giá | 2/2 | 16 mức giá (2 loại ngày × 4 khung giờ × 2D/3D); cuối tuần > ngày thường; 3D > 2D; giá 5.000 ₫ bị chặn 400 |
| G. Đặt vé & thanh toán | 9/9 | Sơ đồ ghế đúng kích thước phòng; giữ ghế idempotent; khách khác không lấy được ghế đang giữ (409); ghế đôi phải đặt cả cặp; mã vé ẩn trước khi thanh toán; URL VNPay có chữ ký, trả về `/api/payments/vnpay/return`; chữ ký giả bị từ chối; chữ ký đúng → vé **CONFIRMED** và có mã (giá trị QR); trang thanh toán nội bộ tắt khi không đặt `PAYMENT_MODE=internal` |
| H. Đặt vé nhanh bằng AI | 4/4 | "Tối mai 2 người khoảng 8h, phim gì cũng được" → 3 suất, mỗi suất 2 ghế liền nhau cùng hàng + Combo Đôi; "đi 4 người lúc 19:30" → 4 ghế + Combo Party; "Đặt nhanh" giữ ghế và thêm combo trong một lần gọi, tổng tiền khớp gợi ý; đặt lại cùng ghế 409 |
| I. Tạm ngưng & lưu trữ | 3/3 | Tạm ngưng kế hoạch: 12 suất chưa bán vé bị tạm dừng, suất đã bán vé vẫn mở, phim ẩn ở rạp đó; lưu trữ phim còn vé tương lai bị chặn 409 |

Toàn bộ 51 ca và chi tiết từng ca có trong `docs/test-results/api-test.json`.

## 3. Thuật toán Legacy Greedy (port từ CinePrime Java)

**Lần chạy kiểm thử #1**: 1 phim × 3 rạp (Ninh Kiều, Cái Răng, Bình Thủy) × 2 ngày.

| Chỉ số | Giá trị |
|---|---|
| Ứng viên | 1.100 |
| Được chọn | 25 |
| Bị loại | 1.075 (EXISTING_SHOWTIME_CONFLICT 440 · CLEANUP_BUFFER_CONFLICT 317 · MAX_DAILY_SHOWS_PER_MOVIE_REACHED 160 · MAXIMUM_ROOM_SHARE_REACHED 158) |
| Không đủ điều kiện | 2 (Bình Thủy không có kế hoạch → MOVIE_NOT_AVAILABLE) |
| Thời gian chạy | 442 ms |

Các bất biến được script kiểm tra trên **từng suất chiếu được tạo**, và tất cả đều đạt, không có vi phạm nào:

- Báo cáo khớp số liệu: ứng viên = được chọn + bị loại; tổng theo lý do, theo rạp và theo ngày đều khớp.
- Suất mới ở trạng thái `SCHEDULED`, khách chưa đặt được cho đến khi mở bán.
- Suất nằm trong giờ mở cửa của rạp, có tính 15 phút dọn phòng trước giờ đóng cửa.
- Trong cùng một phòng, suất sau bắt đầu sau khi suất trước kết thúc ít nhất 15 phút. Điều này được kiểm tra với mọi suất của phòng, kể cả suất có sẵn.
- Cùng một phim trong một rạp, hai suất bắt đầu cách nhau ít nhất 20 phút.
- Số suất mỗi phim mỗi ngày nằm trong khoảng tối thiểu và tối đa theo hồ sơ nhu cầu của rạp.
- Suất 3D chỉ xếp vào phòng hỗ trợ 3D.
- Giá được chụp từ bảng giá vào suất chiếu: VIP = ghế thường × 1,2, ghế đôi = ghế thường × 1,15, làm tròn đến 1.000 ₫.

Hành vi tạo lại, huỷ và mở bán:

- **Chạy lại cùng đầu vào:** không tạo suất trùng. Lần chạy #2 chọn 0 suất mới, với EXISTING_SHOWTIME_CONFLICT = 830.
- **Huỷ lần tạo:** chỉ xoá các suất chưa mở bán.
- **Mở bán:** mở đúng 25 suất, và phim chuyển sang "Đang chiếu" ở Ninh Kiều.

**Lần chạy dữ liệu demo #3** (qua `npm run seed:tmdb`): 12 phim × 5 rạp × 7 ngày, chạy trong 2,4 giây.

| Chỉ số | Giá trị |
|---|---|
| Ứng viên | 36.800 |
| Được chọn và mở bán | 358 suất |
| Phân bổ theo rạp | Ninh Kiều 25 · Cái Răng 98 · Bình Thủy 100 · Ô Môn 71 · Thốt Nốt 64 |

Ninh Kiều có ít suất mới vì các phòng của rạp này đã gần kín lịch từ bản v1.

## 4. Kiểm thử giao diện trên emulator

| Màn hình | Kiểm tra | Kết quả |
|---|---|---|
| Trang chủ | Nút chọn rạp, nút "Đặt nhanh", tab Đang chiếu/Sắp chiếu theo rạp | Đạt |
| Chọn rạp | 5 rạp kèm địa chỉ và giờ mở cửa hôm nay; lựa chọn được ghi nhớ | Đạt |
| Đặt vé nhanh | Chọn rạp/ngày/số người; câu gợi ý mẫu; Gemini trả về 3 suất kèm tóm tắt phim, lý do, ghế VIP liền nhau và Combo Đôi | Đạt |
| Đặt nhanh → Thanh toán | Ghế đã giữ (đếm ngược 8 phút), combo đã thêm, nút "Thanh toán … qua VNPay" | Đạt |
| Vé của tôi | Đơn chờ thanh toán ở đầu danh sách; vé đã thanh toán | Đạt sau khi sửa lỗi 5.1 |
| Chi tiết vé | Mã QR, mã vé, rạp và địa chỉ; **không còn badge "Đã thanh toán"** | Đạt |
| Tài khoản | Hồ sơ đọc qua `/api/me/profile` | Đạt |
| Admin: menu | Nhập TMDB, Phim, Kế hoạch phát hành, Tạo suất tự động, Lịch chiếu, Bảng giá | Đạt |
| Admin: báo cáo lần tạo #3 | Tổng quan, biểu đồ theo ngày/rạp/phim, lý do bị loại | Đạt |
| Admin: bảng giá, kế hoạch phát hành | Hiển thị và chỉnh sửa theo rạp | Đạt |

## 5. Lỗi phát hiện trong quá trình kiểm thử

1. **Vé tạo từ bản v1 hiển thị rạp là "CinePrime"** (tên chi nhánh cũ được lưu trên đơn). Đã sửa: tên rạp trên vé giờ lấy theo `clusterId` hiện tại, nên các vé cũ hiển thị "CinePrime Ninh Kiều".
2. **Gemini trả lỗi 503 (quá tải) ở một yêu cầu.** Đây không phải lỗi của ứng dụng: bộ chọn dự phòng theo luật đã trả lời thay, và ca H2 vẫn đạt. Khi đó khách vẫn nhận được gợi ý, chỉ khác là tóm tắt phim lấy từ câu đầu của nội dung phim.

## 6. Giới hạn đã biết

- Ca tạm ngưng kế hoạch không tự mở lại các suất đã bị tạm dừng; admin mở lại từ màn Lịch chiếu.
- IPN của VNPay (server-to-server) không gọi được tới máy dev; xác nhận thanh toán dựa trên trang trả về có chữ ký.
- Kiểm thử chạy trên dữ liệu dev dùng chung, nên có để lại dữ liệu kiểm thử (mục 1).
