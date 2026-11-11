# Hướng dẫn demo CinePrime

Hướng dẫn từng bước để trình diễn toàn bộ luồng của ứng dụng trên Android emulator. Thời lượng khoảng 12–15 phút.

## Mục lục

1. [Chuẩn bị](#1-chuẩn-bị)
2. [Khách xem phim theo rạp](#2-khách-xem-phim-theo-rạp)
3. [Quản trị: từ phim mới đến suất chiếu](#3-quản-trị-từ-phim-mới-đến-suất-chiếu)
4. [Quản trị: bảng giá vé](#4-quản-trị-bảng-giá-vé)
5. [Khách đặt vé nhanh bằng AI](#5-khách-đặt-vé-nhanh-bằng-ai)
6. [Thanh toán và vé QR](#6-thanh-toán-và-vé-qr)
7. [Kiểm tra chống đặt trùng ghế (tuỳ chọn)](#7-kiểm-tra-chống-đặt-trùng-ghế-tuỳ-chọn)
8. [Xử lý sự cố](#8-xử-lý-sự-cố)

## 1. Chuẩn bị

### 1.1. Môi trường

| Bước | Thao tác |
| --- | --- |
| 1 | Điền `.env.local` với `MONGODB_URI`, `JWT_SECRET`, `TMDB_API_KEY`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `GEMINI_API_KEY` |
| 2 | Chạy `npx expo start --android` để phục vụ app và API trên cổng 8081 |
| 3 | Mở Android emulator và mở app bằng Expo Go |
| 4 | Chạy `npm run seed:tmdb` để có phim và lịch chiếu 7 ngày cho cả 5 rạp |
| 5 | Đăng xuất khỏi mọi tài khoản để bắt đầu từ trang chủ ở trạng thái khách |

### 1.2. Tài khoản và dữ liệu thanh toán

| Mục | Giá trị |
| --- | --- |
| Admin | `admin` / `admin` |
| Khách hàng | `user` / `user` |
| Thẻ VNPay sandbox | Ngân hàng NCB, số thẻ `9704198526191432198`, tên `NGUYEN VAN A`, hết hạn `07/15` |
| OTP VNPay sandbox | `123456` |

### 1.3. Lưu ý trước khi bắt đầu

- Nút bánh răng của Expo Go luôn nằm ở góc phải phía trên và có thể che nút **Đặt nhanh** trên trang chủ. Đây là công cụ phát triển, không thuộc ứng dụng.
- Chỉ các suất chiếu còn ở tương lai mới được gợi ý hoặc cho đặt. Nếu demo vào buổi tối muộn, chọn **ngày mai** ở các bước có chọn ngày.
- Tài khoản `user` đã dùng mã `WELCOME10`. Khi demo khuyến mãi, dùng `VE15K` hoặc `BAPNUOC20`.

## 2. Khách xem phim theo rạp

Bắt đầu ở trang chủ, chưa đăng nhập.

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 2.1 | Bấm nút chọn rạp ở đầu trang chủ | Hộp chọn rạp liệt kê 5 rạp, mỗi rạp có địa chỉ và giờ mở cửa hôm nay |
| 2.2 | Chọn **CinePrime Cái Răng** | Tên rạp ở đầu trang đổi theo, danh sách phim tải lại |
| 2.3 | Chuyển giữa tab **Đang chiếu** và **Sắp chiếu** | **Đang chiếu** gồm phim có suất mở bán tại rạp. **Sắp chiếu** gồm phim đã có kế hoạch phát hành mở nhưng chưa có suất mở bán |
| 2.4 | Mở một phim ở tab **Đang chiếu**, chọn tab **Suất chiếu** | Các suất của rạp đã chọn, nhóm theo định dạng |
| 2.5 | Chọn một ngày khác trong thanh ngày | Danh sách suất đổi theo ngày |
| 2.6 | Chọn tab **Thông tin** | Nội dung phim, thể loại, quốc gia, đạo diễn, diễn viên và trailer |

## 3. Quản trị: từ phim mới đến suất chiếu

Đăng nhập bằng `admin` / `admin`.

### 3.1. Nhập phim từ TMDB

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 3.1.1 | Ở menu admin chọn **Nhập phim từ TMDB** | Danh sách phim TMDB dành cho Việt Nam |
| 3.1.2 | Chọn một phim chưa có nhãn đã nhập | Màn xem trước với tên, thời lượng, độ tuổi, diễn viên và độ phổ biến điền sẵn |
| 3.1.3 | Bấm **Nhập phim để duyệt** | Mở màn chi tiết phim ở trạng thái **Chờ duyệt** |
| 3.1.4 | Kiểm tra phía khách: mở trang chủ với tài khoản khách hoặc gọi `GET /api/public/movies/{id}` | Phim chưa xuất hiện, API trả 404 |

### 3.2. Kiểm tra và duyệt phim

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 3.2.1 | Đặt **Khởi chiếu** là ngày hôm nay (dạng `YYYY-MM-DD`) | Ô nhập nhận giá trị |
| 3.2.2 | Bật chip **3D** ở mục Định dạng phát hành | Chip 3D được chọn |
| 3.2.3 | Nhập **Độ ưu tiên xếp lịch** là `85` | Ô nhập nhận giá trị |
| 3.2.4 | Bấm **Lưu và duyệt phim** | Thông báo đã duyệt, trạng thái đổi thành **Đã duyệt** |

Lưu ý: nếu thiếu thông tin bắt buộc (thời lượng, poster, nội dung, ngày khởi chiếu, phân loại độ tuổi), khung **Cần bổ sung trước khi duyệt** liệt kê các mục còn thiếu và phim chưa được duyệt.

### 3.3. Mở kế hoạch phát hành

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 3.3.1 | Ở màn chi tiết phim bấm **Kế hoạch phát hành theo rạp** | Màn **Kế hoạch phát hành** lọc theo phim |
| 3.3.2 | Bấm **+ Mở kế hoạch mới** | Mở biểu mẫu tạo kế hoạch |
| 3.3.3 | Chọn phim vừa duyệt, chọn các rạp **Cái Răng**, **Bình Thủy**, **Ô Môn**, giữ **Mở khai thác ngay** | Các chip được chọn |
| 3.3.4 | Bấm **Tạo kế hoạch** | Thông báo đã tạo 3 kế hoạch, mỗi rạp hiện nhãn **Đang khai thác** |

Ninh Kiều và Thốt Nốt không có kế hoạch cho phim này, nên phim không hiện ở hai rạp đó.

### 3.4. Tạo suất chiếu tự động

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 3.4.1 | Quay lại màn chi tiết phim, bấm **Tạo suất chiếu tự động** | Màn **Tạo suất chiếu tự động** với phim đã được chọn sẵn |
| 3.4.2 | Đặt **Từ ngày** là hôm nay, chọn **1 ngày** | Dòng tóm tắt hiển thị khoảng ngày |
| 3.4.3 | Chỉ chọn 3 rạp Cái Răng, Bình Thủy, Ô Môn | Các chip rạp được chọn |
| 3.4.4 | Trong danh sách phim, chỉ chọn phim vừa tạo | Tiêu đề mục hiện `Phim (1/N đủ điều kiện đã chọn)`. Phim chưa có kế hoạch phát hành tại rạp đã chọn bị **khoá** (biểu tượng khoá, kèm lý do và nút "Mở kế hoạch phát hành") và không chọn được |
| 3.4.5 | Giữ **Xem báo cáo rồi mở bán**, bấm **Tạo suất chiếu** | Mở màn **Báo cáo tạo lịch** |

### 3.5. Đọc báo cáo và mở bán

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 3.5.1 | Xem thẻ **Tổng quan** | Bốn số: Ứng viên, Được chọn, Bị loại, Không đủ điều kiện. Ứng viên bằng Được chọn cộng Bị loại |
| 3.5.1a | Xem mục **Kết quả theo phim** | Mỗi phim có nhãn Đã tạo / Tạo một phần / Không tạo được suất, số suất ở từng rạp, số suất theo trạng thái mở bán, và chip số suất theo từng ngày. Bấm một ngày để xem **giờ chiếu theo rạp** (ô giờ có màu theo trạng thái) |
| 3.5.1b | Xem mục **Suất chiếu đã tạo**, chọn ngày, rạp, phim bằng các chip | Danh sách từng suất gồm giờ, phòng, định dạng, giá ghế thường và trạng thái, gom theo rạp |
| 3.5.2 | Cuộn xuống **Suất được chọn theo ngày** và **Theo rạp** | Thanh ngang thể hiện số suất mỗi ngày và mỗi rạp |
| 3.5.3 | Xem **Lý do bị loại** | Số lượng theo từng lý do, ví dụ trùng phòng (có tính thời gian dọn phòng), vượt tỉ lệ phòng chiếu cùng lúc, đủ số suất tối đa mỗi ngày |
| 3.5.4 | Xem **Mẫu ứng viên bị loại** và lọc theo lý do bằng chip | Giờ, phòng, định dạng, điểm và lý do của từng mẫu |
| 3.5.5 | Bấm **Mở bán N suất** | Nhãn đổi thành **Đã mở bán**, các suất chuyển sang đang mở bán |
| 3.5.6 | Bấm **Xem lịch chiếu** | Màn **Lịch chiếu** của ngày đó, mỗi suất ghi mã lần tạo |

Nếu cần bỏ lần tạo trước khi mở bán, bấm **Huỷ lần tạo này** để xoá các suất chưa mở bán.

## 4. Quản trị: bảng giá vé

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 4.1 | Ở menu admin chọn **Bảng giá vé** | Bảng giá của rạp đầu tiên (Ninh Kiều) |
| 4.2 | Xem hai thẻ **Thứ 2 – Thứ 5** và **Thứ 6 – Chủ nhật** | Mỗi thẻ có 4 khung giờ (sáng, chiều, tối, khuya) và hai cột 2D, 3D. Giá cuối tuần và giá 3D cao hơn |
| 4.3 | Cuộn xuống **Hệ số theo hạng ghế** | Hệ số ghế thường 1, VIP 1,2, ghế đôi 1,15 kèm giá mẫu |
| 4.4 | Chọn rạp khác bằng chip phía trên | Bảng giá của rạp đó |

Giá được lưu vào từng suất lúc tạo suất. Sửa bảng giá chỉ áp dụng cho suất tạo sau đó.

Bấm **Đăng xuất** ở menu admin để chuyển sang vai khách.

## 5. Khách đặt vé nhanh bằng AI

Đăng nhập bằng `user` / `user`, ở trang chủ chọn rạp **CinePrime Cái Răng**.

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 5.1 | Bấm **Đặt nhanh** ở đầu trang chủ | Màn **Đặt vé nhanh** với rạp, ngày, số người và ô nhập mô tả |
| 5.2 | Chọn ngày hôm nay, hoặc ngày mai nếu đã muộn | Chip ngày được chọn |
| 5.3 | Bấm câu mẫu **Tối nay 2 người, phim gì cũng được** | Hệ thống gợi ý 2–3 suất |
| 5.4 | Xem một thẻ gợi ý | Poster, giờ chiếu, phòng, số ghế còn, tóm tắt phim, lý do gợi ý, ghế liền nhau kèm giá, combo kèm giá và tổng tiền |
| 5.5 | Bấm **Đặt nhanh · … ₫** | Mở màn **Thanh toán** có đếm ngược giữ ghế 8 phút, ghế đã giữ và combo đã thêm |
| 5.6 | Ở mục **Khuyến mãi** chọn mã **VE15K** | Mã được áp dụng, số tiền giảm 15.000 ₫ |
| 5.7 | Bấm **Gỡ** hoặc chọn lại mã đó | Mã được gỡ, số tiền trở lại như cũ |

Ở bước 5.3, thay cho câu mẫu có thể chọn số người bằng chip hoặc tự nhập mô tả, ví dụ `đi 4 người lúc 19:30` sẽ cho 4 ghế và Combo Party.

Nếu Gemini không phản hồi, bộ chọn theo luật trả lời thay và màn hình vẫn hiện gợi ý ở cùng định dạng.

## 6. Thanh toán và vé QR

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 6.1 | Ở màn **Thanh toán** bấm **Thanh toán … qua VNPay** | Mở trang VNPay sandbox trong trình duyệt |
| 6.2 | Chọn ngân hàng **NCB**, nhập số thẻ, tên, ngày hết hạn ở mục 1.2 | Trang yêu cầu OTP |
| 6.3 | Nhập OTP `123456` | Trang kết quả **Thanh toán thành công** |
| 6.4 | Nếu app chưa tự mở, bấm **Mở vé của tôi** | App mở màn **Vé của bạn** |
| 6.5 | Xem màn vé | Poster, tên phim, độ tuổi, định dạng, giờ chiếu, rạp và địa chỉ, ghế, mã QR và mã đặt vé, mã nhận bắp nước, tổng tiền. Không có nhãn trạng thái thanh toán |
| 6.6 | Bấm **Xong**, mở tab **Vé của tôi** | Vé nằm trong tab **Phim sắp xem** |

Mã đặt vé và mã QR chỉ xuất hiện sau khi thanh toán thành công. Đơn chưa thanh toán hiện ở đầu danh sách dưới dạng thẻ **Đơn đang chờ thanh toán**.

## 7. Kiểm tra chống đặt trùng ghế (tuỳ chọn)

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 7.1 | Dùng tài khoản `user` chọn ghế ở một suất và tạo đơn nhưng chưa thanh toán | Ghế được giữ 8 phút |
| 7.2 | Dùng tài khoản khác (đăng ký mới) trên thiết bị hoặc trình duyệt thứ hai, chọn đúng ghế đó | Thông báo "Ghế bạn chọn vừa có người khác giữ. Vui lòng chọn ghế khác." |

Cách kiểm tra bằng API: `node --env-file-if-exists=.env.local scripts/api-test.mjs` chạy ca G3 cho đúng tình huống này.

## 8. Xử lý sự cố

| Sự cố | Cách xử lý |
| --- | --- |
| Gemini trả lỗi 503 hoặc không phản hồi | Không cần làm gì, bộ chọn theo luật tự trả lời |
| VNPay chậm hoặc không truy cập được | Thêm `PAYMENT_MODE=internal` vào `.env.local`, khởi động lại server để dùng trang thanh toán nội bộ |
| Không tải được danh sách TMDB | Bỏ bước 3.1, dùng một phim đã duyệt có sẵn ở màn **Phim** và tiếp tục từ mục 3.3 |
| Hết suất chiếu trong ngày | Chọn ngày mai ở màn **Đặt vé nhanh** và ở tab **Suất chiếu** |
| App không tự mở lại sau khi thanh toán VNPay | Bấm nút **Mở vé của tôi** trên trang kết quả |
| Không thấy phim mới ở trang chủ khách | Kiểm tra phim đã **Đã duyệt**, kế hoạch phát hành của rạp đang chọn ở trạng thái **Đang khai thác**, và suất đã **Mở bán**. Kéo xuống để làm mới |
| Cổng 8081 đang bị chiếm | Đóng tiến trình Metro cũ hoặc chạy server ở cổng khác kèm `EXPO_PUBLIC_API_URL` tương ứng |
