# Quy tắc nghiệp vụ CinePrime theo use case

Tài liệu này mô tả các quy tắc nghiệp vụ mà hệ thống đang thực thi, chia theo use case. Mỗi quy tắc có mã `BR-<use case>.<số>` để tham chiếu. Nội dung được lập từ mã nguồn tại thời điểm viết, nên các con số (thời gian giữ ghế, giá, giới hạn) là giá trị đang chạy thật.

## Mục lục

1. [Quy ước và tác nhân](#1-quy-ước-và-tác-nhân)
2. [Danh sách use case](#2-danh-sách-use-case)
3. [Quy tắc chung](#3-quy-tắc-chung)
4. [Nhóm khách hàng](#4-nhóm-khách-hàng-uc-01--uc-11)
5. [Nhóm hệ thống](#5-nhóm-hệ-thống-uc-12-và-uc-23)
6. [Nhóm quản trị](#6-nhóm-quản-trị-uc-13--uc-22)
7. [Vòng đời trạng thái](#7-vòng-đời-trạng-thái)
8. [Phụ lục dữ liệu cấu hình](#8-phụ-lục-dữ-liệu-cấu-hình)
9. [Mã lỗi nghiệp vụ](#9-mã-lỗi-nghiệp-vụ)
10. [Giới hạn và khoảng trống đã biết](#10-giới-hạn-và-khoảng-trống-đã-biết)

## 1. Quy ước và tác nhân

**Nơi thực thi quy tắc**
- **[Server]**: API kiểm tra và từ chối yêu cầu vi phạm.
- **[App]**: chỉ ứng dụng di động chặn, API không kiểm tra.
- **[Cả hai]**: cả hai nơi cùng kiểm tra.

Nếu không ghi nơi thực thi thì đó là quy tắc [Server].

**Tác nhân**

| Tác nhân | Mô tả |
| --- | --- |
| Khách (guest) | Người chưa đăng nhập. Xem được phim, suất chiếu và bảng khuyến mãi. |
| Khách hàng | Tài khoản vai trò `MEMBER`. Đặt vé, thanh toán, xem vé. |
| Quản trị viên | Tài khoản vai trò `ADMIN`. Quản lý phim, kế hoạch phát hành, suất chiếu, giá, đơn đặt vé và khách hàng. |
| Hệ thống | Xử lý tự động: hết hạn giữ chỗ, xác nhận thanh toán, khởi tạo dữ liệu. |
| Cổng thanh toán | VNPay (hoặc trang thanh toán nội bộ). |
| Dịch vụ ngoài | TMDB (dữ liệu phim) và Google Gemini (gợi ý đặt vé nhanh). |

## 2. Danh sách use case

| Mã | Use case | Tác nhân chính |
| --- | --- | --- |
| UC-01 | Đăng ký tài khoản | Khách |
| UC-02 | Đăng nhập, làm mới phiên, đăng xuất | Khách, khách hàng, quản trị viên |
| UC-03 | Quản lý hồ sơ cá nhân | Khách hàng |
| UC-04 | Chọn rạp và xem danh sách phim | Khách, khách hàng |
| UC-05 | Xem chi tiết phim và suất chiếu | Khách, khách hàng |
| UC-06 | Chọn ghế và giữ chỗ | Khách hàng |
| UC-07 | Chọn bắp nước | Khách hàng |
| UC-08 | Áp dụng khuyến mãi | Khách hàng |
| UC-09 | Thanh toán đơn đặt vé | Khách hàng, cổng thanh toán |
| UC-10 | Xem vé của tôi và mã QR | Khách hàng |
| UC-11 | Đặt vé nhanh bằng AI | Khách hàng, Gemini |
| UC-12 | Hết hạn giữ chỗ và đóng đơn | Hệ thống |
| UC-13 | Nhập phim từ TMDB | Quản trị viên, TMDB |
| UC-14 | Kiểm tra, chỉnh sửa và duyệt phim | Quản trị viên |
| UC-15 | Lưu trữ phim | Quản trị viên |
| UC-16 | Quản lý kế hoạch phát hành | Quản trị viên |
| UC-17 | Tạo suất chiếu tự động | Quản trị viên |
| UC-18 | Mở bán hoặc huỷ một lần tạo suất | Quản trị viên |
| UC-19 | Quản lý suất chiếu | Quản trị viên |
| UC-20 | Quản lý bảng giá vé | Quản trị viên |
| UC-21 | Theo dõi đơn đặt vé | Quản trị viên |
| UC-22 | Quản lý khách hàng | Quản trị viên |
| UC-23 | Khởi tạo dữ liệu hệ thống và dữ liệu demo | Hệ thống, quản trị viên |

## 3. Quy tắc chung

| Mã | Quy tắc |
| --- | --- |
| BR-GEN.1 | Hệ thống phục vụ Android, giao diện tiếng Việt, tiền tệ **VND** (số nguyên, không có phần lẻ). |
| BR-GEN.2 | Mọi ngày giờ nghiệp vụ tính theo **giờ Việt Nam (UTC+7)**, không có giờ mùa hè. Ngày chiếu, giờ mở cửa, khung giờ giá và "hôm nay" đều theo múi giờ này. Thời điểm được lưu dưới dạng UTC. |
| BR-GEN.3 | Mọi API trả về `{ code, message, result }`. Lỗi nghiệp vụ có `code` riêng (xem mục 9) và `message` tiếng Việt hiển thị trực tiếp cho người dùng. |
| BR-GEN.4 | API phân thành 4 nhóm quyền: `/api/auth/*` và `/api/public/*` không cần đăng nhập; `/api/me/*` cần đăng nhập; `/api/admin/*` chỉ vai trò `ADMIN` (khác vai trò trả 403). Hai trang trả về của thanh toán `/api/payments/*` được trình duyệt mở nên không cần token. |
| BR-GEN.5 | Mã định danh của phim, suất chiếu, kế hoạch phát hành, lần tạo suất là **số nguyên tự tăng** theo từng loại. Đơn đặt vé và giao dịch dùng UUID. Tài khoản dùng ObjectId của MongoDB. |
| BR-GEN.6 | Việc tạo đơn đặt vé (kể cả "Đặt nhanh") nhận tiêu đề `Idempotency-Key`: cùng khoá gửi lại thì nhận lại đơn đã tạo, không tạo đơn thứ hai (UC-06). Việc tạo giao dịch thanh toán lưu khoá này nhưng chống tạo trùng bằng quy tắc "một giao dịch đang mở cho mỗi đơn" (UC-09). Thêm bắp nước và áp khuyến mãi có gửi khoá nhưng server không dùng vì hai thao tác này vốn thay thế trọn trạng thái nên gọi lại cho cùng kết quả. |
| BR-GEN.7 | Một khách hàng chỉ đọc và sửa được **đơn của chính mình**. Quản trị viên đọc được mọi đơn. Đơn của người khác trả "Không tìm thấy đơn đặt vé" (404), không tiết lộ là đơn có tồn tại. |
| BR-GEN.8 | Danh sách rạp, phòng, thực đơn bắp nước và khuyến mãi là **cấu hình trong mã nguồn**, không có màn hình quản trị. Thay đổi cần cập nhật mã (xem mục 10). |

## 4. Nhóm khách hàng (UC-01 – UC-11)

### UC-01 Đăng ký tài khoản

**Tác nhân:** Khách. **Kết quả:** tài khoản vai trò khách hàng, hồ sơ trống.

| Mã | Quy tắc |
| --- | --- |
| BR-01.1 | Tên đăng nhập dài 5–30 ký tự, chỉ gồm chữ cái không dấu, chữ số và dấu gạch dưới. |
| BR-01.2 | Email phải hợp lệ; được chuẩn hoá về chữ thường trước khi lưu và so sánh. |
| BR-01.3 | Mật khẩu dài 8–72 ký tự. Mật khẩu được băm bằng PBKDF2-SHA256 (100.000 vòng, muối ngẫu nhiên 16 byte), không lưu dạng gốc. |
| BR-01.4 | Tên đăng nhập và email là **duy nhất, không phân biệt hoa thường**. Trùng tên đăng nhập → 409 (mã 4091), trùng email → 409 (mã 4092), cả hai trùng do hai yêu cầu đua nhau → 409 (mã 4090). Chỉ mục duy nhất ở cơ sở dữ liệu là chốt chặn cuối. |
| BR-01.5 | Tài khoản tạo mới luôn có vai trò `MEMBER`, trạng thái `ACTIVE`. Không thể tự đăng ký thành quản trị viên. |

### UC-02 Đăng nhập, làm mới phiên, đăng xuất

**Tác nhân:** Khách, khách hàng, quản trị viên.

| Mã | Quy tắc |
| --- | --- |
| BR-02.1 | Đăng nhập bằng **tên đăng nhập hoặc email** (không phân biệt hoa thường) cùng mật khẩu. Sai thông tin → 401 (mã 1006), thông báo chung không cho biết sai phần nào. |
| BR-02.2 | Tài khoản `INACTIVE` không đăng nhập được → 403 (mã 1007). |
| BR-02.3 | Phiên là token JWT (HS256) sống **2 giờ**, chứa mã tài khoản, vai trò và phiên bản token. |
| BR-02.4 | Mỗi yêu cầu có token đều được kiểm tra lại với cơ sở dữ liệu: tài khoản phải còn `ACTIVE` và phiên bản token phải khớp. Vì vậy khoá tài khoản hoặc thu hồi phiên có hiệu lực **ngay lập tức**, không chờ token hết hạn. |
| BR-02.5 | Token đã hết hạn tối đa **7 ngày** vẫn đổi được lấy token mới (làm mới phiên), miễn là phiên bản token còn khớp và tài khoản còn hoạt động. Quá 7 ngày phải đăng nhập lại. |
| BR-02.6 | Đăng xuất là thao tác phía ứng dụng (xoá token và bộ nhớ đệm). Server không lưu danh sách token; muốn vô hiệu mọi thiết bị phải tăng phiên bản token (UC-22). |
| BR-02.7 | [App] Sau khi đăng nhập, vai trò quyết định khu vực: `MEMBER` vào khu khách hàng, `ADMIN` vào khu quản trị, vai trò khác vào màn "không hỗ trợ". Khách chưa đăng nhập được vào khu khách hàng để xem phim. |
| BR-02.8 | Token được lưu trong kho bảo mật của thiết bị (SecureStore). Khi token không còn dùng được, ứng dụng tự đăng xuất và xoá bộ nhớ đệm. |

### UC-03 Quản lý hồ sơ cá nhân

**Tác nhân:** Khách hàng.

| Mã | Quy tắc |
| --- | --- |
| BR-03.1 | Hồ sơ gồm họ tên (1–50 ký tự), số điện thoại, ngày sinh, giới tính. Cập nhật thay thế toàn bộ hồ sơ. |
| BR-03.2 | Số điện thoại bắt đầu bằng `0` hoặc `+84`, theo sau là 9–10 chữ số. |
| BR-03.3 | Ngày sinh theo dạng `YYYY-MM-DD` và phải ở **quá khứ**. |
| BR-03.4 | Giới tính là `Male`, `Female` hoặc `Other`. |
| BR-03.5 | Hồ sơ **hoàn thiện** khi có đủ 4 trường. Khách hàng chỉ đọc và sửa được hồ sơ **của mình** (`/api/me/profile`). Quản trị viên chỉ **xem** hồ sơ khách hàng qua `/api/admin/customers/{id}/profile`, không sửa được. |
| BR-03.6 | [App] Hồ sơ chưa hoàn thiện thì màn chọn ghế chuyển sang màn hoàn thiện hồ sơ trước khi cho tạo đơn. Server **không** kiểm tra điều kiện này (xem mục 10). |

### UC-04 Chọn rạp và xem danh sách phim

**Tác nhân:** Khách, khách hàng.

| Mã | Quy tắc |
| --- | --- |
| BR-04.1 | Có 5 rạp đang hoạt động (xem mục 8.1). Mỗi rạp có địa chỉ cấp quận, giờ mở cửa theo từng ngày trong tuần, các phòng và hồ sơ nhu cầu. |
| BR-04.2 | [App] Rạp đã chọn được ghi nhớ trên thiết bị. Lần đầu mở app chưa chọn thì dùng rạp đầu tiên trong danh sách. |
| BR-04.3 | Một phim **hiển thị cho khách** tại một rạp khi: phim ở trạng thái `APPROVED` **và** có kế hoạch phát hành `OPEN` tại rạp đó **và** kế hoạch chưa quá ngày kết thúc (hoặc không đặt ngày kết thúc). Chưa duyệt, đã lưu trữ, không có kế hoạch mở hoặc kế hoạch tạm ngưng/đóng thì phim ẩn. |
| BR-04.4 | Phim hiển thị được chia hai nhóm theo rạp: **Đang chiếu** nếu rạp có ít nhất một suất `ON_SALE` ở tương lai; ngược lại là **Sắp chiếu**. Không phụ thuộc ngày khởi chiếu của phim. |
| BR-04.5 | Danh sách sắp theo ngày khởi chiếu mới nhất trước. Mỗi phim kèm thời điểm suất mở bán gần nhất tại rạp (`nextShowtimeAt`) và cờ có thể đặt vé. |
| BR-04.6 | Thể loại hiển thị bỏ tiền tố "Phim " mà TMDB thêm vào tên thể loại tiếng Việt. |
| BR-04.7 | [App] Phim thuộc nhóm Sắp chiếu không cho xem suất chiếu; màn chi tiết báo rạp chưa mở bán và gợi ý thử rạp khác. |

### UC-05 Xem chi tiết phim và suất chiếu

**Tác nhân:** Khách, khách hàng.

| Mã | Quy tắc |
| --- | --- |
| BR-05.1 | Chi tiết phim chỉ xem được khi phim `APPROVED` và có kế hoạch `OPEN` ở **ít nhất một** rạp; ngược lại trả 404 (mã 2002). |
| BR-05.2 | Danh sách suất chỉ gồm suất `ON_SALE` còn ở tương lai. Khi lọc theo một ngày, chỉ lấy suất từ thời điểm hiện tại (hoặc đầu ngày nếu là ngày tương lai) đến hết ngày đó. Tối đa 300 suất mỗi lần. |
| BR-05.3 | Danh sách suất có thể lọc theo rạp. Mỗi suất cho biết phòng, định dạng (2D/3D), ngôn ngữ (lồng tiếng hoặc phụ đề), tổng số ghế và số ghế còn trống. |
| BR-05.4 | Số ghế còn trống = sức chứa phòng trừ ghế đã bán và ghế đang được giữ chưa hết hạn. |
| BR-05.5 | Giá hiển thị trên suất là giá **ghế thường** của suất đó. Giá VIP và ghế đôi hiển thị trên sơ đồ ghế. |
| BR-05.6 | Ngôn ngữ suất: phim gốc tiếng Việt thì tiếng Việt, không phụ đề; phim khác thì tiếng gốc của phim (mặc định `en`) kèm **phụ đề tiếng Việt**. |
| BR-05.7 | [App] Suất đã bắt đầu hiển thị mờ và không bấm được. |

### UC-06 Chọn ghế và giữ chỗ

**Tác nhân:** Khách hàng. **Kết quả:** đơn đặt vé ở trạng thái `PENDING_PAYMENT`, ghế được giữ.

| Mã | Quy tắc |
| --- | --- |
| BR-06.1 | [Cả hai] Phải đăng nhập mới đặt được. Khách chưa đăng nhập vào màn chọn ghế sẽ được mời đăng nhập. |
| BR-06.2 | Chỉ đặt được suất `ON_SALE` và chưa bắt đầu; ngược lại → 409 (mã 2502). Suất không tồn tại → 404 (mã 2501). |
| BR-06.3 | Mỗi đơn chọn từ **1 đến 8 ghế** (không chọn → 400, trùng ghế → 400, quá 8 → 400). Giới hạn lấy từ chính sách giữ ghế `GET /api/public/booking-policy`. |
| BR-06.4 | Ghế phải thuộc sơ đồ phòng của suất chiếu; ghế lạ → 400. Sơ đồ phụ thuộc loại phòng (xem mục 8.2). |
| BR-06.5 | **Ghế đôi bán theo cặp**: nếu chọn một chỗ của cặp thì phải chọn cả hai chỗ, ngược lại → 400. Hai chỗ liền nhau cùng một cặp (1–2, 3–4, …). |
| BR-06.6 | Ghế được giữ **8 phút** (480 giây) kể từ lúc tạo đơn. Một ghế chỉ thuộc một khoá tại một thời điểm nhờ chỉ mục duy nhất `(suất, ghế)`; yêu cầu thứ hai vào cùng ghế → 409 (mã 2503) "Ghế bạn chọn vừa có người khác giữ". Khi lỗi, các ghế đã giữ dở của yêu cầu đó được nhả. |
| BR-06.7 | Khoá ghế đã quá hạn được xoá trước khi giữ, nên ghế đó có thể được người khác lấy ngay khi hết hạn. |
| BR-06.8 | Mỗi khách hàng chỉ có **một đơn chưa thanh toán cho mỗi suất**. Tạo đơn mới cho cùng suất sẽ huỷ đơn chưa thanh toán cũ và nhả ghế cũ. |
| BR-06.9 | `Idempotency-Key` trùng (cùng khách hàng) trả lại đơn đã tạo, kể cả khi hai yêu cầu đến cùng lúc (người thua cuộc nhận lại đơn của người thắng). Ứng dụng giữ một khoá cho mỗi đơn khi thanh toán. |
| BR-06.10 | Giá mỗi ghế lấy từ **giá đã chụp trên suất chiếu** theo hạng ghế (thường, VIP, ghế đôi). Suất cũ chưa có giá chụp dùng giá nền cộng phụ thu cố định: VIP +30.000 ₫, ghế đôi +20.000 ₫. |
| BR-06.11 | Đơn lưu sẵn bản chụp thông tin hiển thị (phim, rạp, phòng, giờ, định dạng, độ tuổi, ghế, giá) để vé không đổi khi dữ liệu gốc đổi. |
| BR-06.12 | Tổng tiền = tiền vé + tiền bắp nước − giảm giá + phí dịch vụ. Phí dịch vụ hiện là **0 ₫**. Giảm giá không vượt quá tổng tiền vé và bắp nước. |
| BR-06.13 | Mã đặt vé (`CP` + 6 ký tự) sinh khi tạo đơn nhưng **chỉ hiện sau khi thanh toán thành công** (quản trị viên thấy ở mọi đơn). Bảng ký tự bỏ `I`, `O`, `0`, `1` để khỏi nhầm. |
| BR-06.14 | Sơ đồ ghế có ba trạng thái: `AVAILABLE`, `LOCKED` (đang giữ, chưa hết hạn) và `BOOKED` (đã bán). Ghế đang giữ của chính khách hàng được đánh dấu `reservedByMe`. [App] Sơ đồ tự làm mới mỗi 5 giây. |

### UC-07 Chọn bắp nước

**Tác nhân:** Khách hàng. **Tiền điều kiện:** đơn `PENDING_PAYMENT`.

| Mã | Quy tắc |
| --- | --- |
| BR-07.1 | Chỉ sửa được đơn đang ở `PENDING_PAYMENT`, ngược lại → 409 (mã 2505). Đơn không tồn tại hoặc không phải của mình → 404 (mã 2504). |
| BR-07.2 | Đang có giao dịch thanh toán **chưa hoàn tất và chưa hết hạn** thì không được sửa bắp nước (số tiền gửi cổng thanh toán không được đổi) → 409 (mã 2506). |
| BR-07.3 | Mỗi lần gửi **thay thế toàn bộ** danh sách bắp nước; danh sách rỗng là xoá hết. Tối đa 20 dòng. |
| BR-07.4 | Mỗi dòng có số lượng từ 1 đến 10. Cùng một món chỉ xuất hiện một lần trong giỏ (trùng → 400). |
| BR-07.5 | Món phải có trong thực đơn (xem mục 8.3), ngược lại → 400. Thành tiền = đơn giá × số lượng. |
| BR-07.6 | Combo có chọn nước phải chọn **đủ số lượng nước** (ví dụ Combo Solo đúng 1 loại, Combo Đôi đúng 2 loại), các loại phải thuộc danh sách cho phép và không trùng nhau. |
| BR-07.7 | Sau mỗi thay đổi, đơn được tính lại và khuyến mãi đang áp dụng được kiểm tra lại: tính lại mức giảm, hoặc **tự gỡ mã** nếu đơn không còn đủ điều kiện. |
| BR-07.8 | Mã nhận bắp nước tại quầy (4 ký tự) chỉ được cấp khi thanh toán thành công và chỉ khi đơn có bắp nước. |

### UC-08 Áp dụng khuyến mãi

**Tác nhân:** Khách hàng. **Tiền điều kiện:** như UC-07 (đơn `PENDING_PAYMENT`, chưa có giao dịch đang mở).

| Mã | Quy tắc |
| --- | --- |
| BR-08.1 | Mỗi đơn áp dụng **tối đa một mã**. Áp mã khác sẽ thay mã cũ; gỡ mã đưa đơn về giá gốc. |
| BR-08.2 | Mã không phân biệt hoa thường. Mã không có trong danh sách → 400 (mã 2600). |
| BR-08.3 | Mỗi mã áp dụng cho một phạm vi: `TICKETS` (tiền vé), `CONCESSIONS` (bắp nước) hoặc `ORDER` (cả đơn). Phần giá trị của phạm vi đó phải đạt **mức tối thiểu** của mã, ngược lại → 400 (mã 2601). |
| BR-08.4 | Mức giảm theo phần trăm được **làm tròn xuống**, sau đó bị chặn bởi mức giảm tối đa (nếu có) và không vượt phạm vi áp dụng. |
| BR-08.5 | Mã có giới hạn mỗi tài khoản chỉ tính các đơn `CONFIRMED` **khác** đơn hiện tại của chính khách hàng đó. Đã dùng → 400 (mã 2602). Đơn bị huỷ hoặc hết hạn không làm mất lượt dùng. |
| BR-08.6 | `GET .../promotion-options` trả mọi mã kèm: dùng được hay không, lý do không dùng được, mức giảm dự kiến và mã đang áp dụng. [App] Mã không dùng được bị làm mờ kèm lý do; bấm lại mã đang chọn để gỡ. |
| BR-08.7 | Bảng khuyến mãi hiện có xem ở mục 8.4. Mã không có ngày bắt đầu hoặc hết hạn. |

### UC-09 Thanh toán đơn đặt vé

**Tác nhân:** Khách hàng, cổng thanh toán. **Tiền điều kiện:** đơn `PENDING_PAYMENT`.

| Mã | Quy tắc |
| --- | --- |
| BR-09.1 | Tạo giao dịch chỉ khi đơn còn `PENDING_PAYMENT` (và chưa quá hạn), ngược lại → 409 (mã 2505). |
| BR-09.2 | Mỗi đơn có **tối đa một giao dịch đang mở** (`PENDING` và chưa hết hạn). Yêu cầu tạo giao dịch lần nữa trả lại chính giao dịch đó, không bao giờ tạo lần thanh toán thứ hai song song. |
| BR-09.3 | Khi bắt đầu thanh toán, thời gian giữ ghế và hạn của giao dịch được kéo dài để **tối thiểu 10 phút** kể từ lúc đó (lấy mốc lớn hơn giữa hạn của đơn và 10 phút kể từ bây giờ). Khách có đủ thời gian nhập OTP. Từ lúc này đơn không sửa được (UC-07, UC-08). |
| BR-09.4 | Số tiền thanh toán bằng tổng tiền của đơn. VNPay nhận số tiền nhân 100. Mã giao dịch hiển thị cho khách (`txnRef`) là chuỗi trung tính, **không dùng mã đặt vé**, vì mã vé chỉ lộ sau khi trả tiền. |
| BR-09.5 | Mặc định dùng **VNPay**. Thiếu `VNPAY_TMN_CODE` hoặc `VNPAY_HASH_SECRET` thì không tạo được giao dịch → 503 (mã 2702) "Cổng thanh toán đang bảo trì". Đặt `PAYMENT_MODE=internal` để dùng trang thanh toán nội bộ của CinePrime thay cho VNPay. |
| BR-09.6 | Liên kết quay lại ứng dụng chỉ nhận lược đồ `exp://`, `exps://` hoặc `cineprime://`. Địa chỉ web bất kỳ bị từ chối (400). |
| BR-09.7 | Địa chỉ trang trả về của VNPay lấy từ `PUBLIC_BASE_URL` nếu có, ngược lại theo địa chỉ mà ứng dụng đã gọi để điện thoại luôn truy cập được. |
| BR-09.8 | Khi VNPay chuyển trình duyệt về `/api/payments/vnpay/return`, server **xác thực chữ ký HMAC-SHA512** trên toàn bộ tham số. Sai chữ ký → trang lỗi "Không xác thực được giao dịch", không đổi gì trong dữ liệu. |
| BR-09.9 | Sau khi chữ ký đúng: giao dịch phải tồn tại theo `txnRef`; số tiền trả về phải bằng số tiền của giao dịch nhân 100. Sai → trang lỗi. |
| BR-09.10 | Thanh toán **thành công** khi mã phản hồi là `00` và trạng thái giao dịch là `00`. Các mã khác là thất bại và hiển thị lý do tiếng Việt tương ứng (ví dụ 24 khách huỷ, 51 không đủ số dư). |
| BR-09.11 | Ghi nhận kết quả là **một lần duy nhất**: chỉ yêu cầu đầu tiên thay đổi giao dịch từ `PENDING`; các lần gọi lại cho cùng kết quả đã có, không xác nhận lại đơn. |
| BR-09.12 | Thành công và đơn còn `PENDING_PAYMENT` → đơn thành `CONFIRMED`, ghế chuyển `SOLD` (không còn hạn giữ), ghi thời điểm thanh toán và cấp mã nhận bắp nước nếu có. |
| BR-09.13 | **Thanh toán muộn:** nếu tiền về khi đơn đã `EXPIRED` hoặc `CANCELLED`, hệ thống cố lấy lại đúng các ghế đó (xoá khoá giữ đã hết hạn, rồi bán). Lấy lại được thì đơn thành `CONFIRMED`. Có ghế đã bị người khác lấy thì đơn **không** xác nhận, giao dịch vẫn ghi `PAID`, khách thấy thông báo liên hệ hotline để được hoàn tiền (hoàn tiền xử lý thủ công). |
| BR-09.14 | Thanh toán **thất bại**: giao dịch thành `FAILED`, đơn giữ trạng thái chờ thanh toán với `paymentStatus = FAILED`. Khách thử lại được (vì không còn giao dịch đang mở) cho đến khi hết hạn giữ ghế. |
| BR-09.15 | Giao dịch quá hạn được hiển thị là `EXPIRED` và không trả liên kết thanh toán nữa. |
| BR-09.16 | Chỉ chủ đơn hoặc quản trị viên xem được giao dịch mới nhất của đơn (`GET .../payment`); chưa có giao dịch → 404 (mã 2701). |
| BR-09.17 | Trang thanh toán nội bộ chỉ hoạt động khi `PAYMENT_MODE=internal` (ngược lại 404). Nút "Thanh toán" xác nhận như thành công, nút "Huỷ giao dịch" ghi thất bại với thông báo "Bạn đã huỷ giao dịch." Chỉ thao tác được khi giao dịch còn `PENDING` và chưa hết hạn; ngược lại trang báo "Giao dịch đã đóng". |
| BR-09.18 | Server **không dùng IPN** của VNPay (không gọi được tới máy phát triển). Trang trả về có chữ ký là đường xác nhận duy nhất. |
| BR-09.19 | [App] Trong lúc trình duyệt thanh toán đang mở, ứng dụng hỏi server mỗi **2,5 giây**. Khi thấy giao dịch đã thanh toán, ứng dụng làm mới bộ nhớ đệm của đơn rồi mở màn vé. Khi trình duyệt đóng mà chưa có kết quả, ứng dụng hỏi lại mỗi **3 giây** trong tối đa **60 giây**; hết thời gian vẫn chưa xác nhận thì báo khách chờ giây lát hoặc làm mới. Server luôn là nguồn kết quả duy nhất. |
| BR-09.20 | [App] Trang kết quả mở lại ứng dụng bằng liên kết (`exp://` trong Expo Go, `cineprime://` trong bản cài đặt). Thành công thì mở vé, thất bại thì quay về màn thanh toán kèm lý do. Đây là hướng dẫn thêm; việc mở vé cuối cùng vẫn dựa trên trạng thái thật ở server. |

### UC-10 Xem vé của tôi và mã QR

**Tác nhân:** Khách hàng.

| Mã | Quy tắc |
| --- | --- |
| BR-10.1 | **Vé** là đơn đã thanh toán (`CONFIRMED`). Đơn đã huỷ hoặc hết hạn không hiển thị trong "Vé của tôi". |
| BR-10.2 | "Vé của tôi" chia hai tab: **Phim sắp xem** (`CONFIRMED`, giờ chiếu từ hiện tại trở đi, sớm nhất trước) và **Phim đã xem** (`CONFIRMED`, giờ chiếu đã qua, mới nhất trước). |
| BR-10.3 | Đơn đang chờ thanh toán (`PENDING_PAYMENT`, chưa hết hạn giữ ghế) không phải vé: hiển thị thành thẻ nhắc "Đơn đang chờ thanh toán" kèm đếm ngược ở đầu danh sách. Hết hạn thì thẻ biến mất. |
| BR-10.4 | Phân trang theo trang bắt đầu từ 0, tối đa 50 dòng mỗi trang. |
| BR-10.5 | Màn vé chỉ hiện **mã QR và mã đặt vé** khi đơn `CONFIRMED`. Giá trị trong mã QR là chính mã đặt vé. Chưa thanh toán thì hiển thị "Mã vé sẽ hiển thị sau khi bạn thanh toán thành công". |
| BR-10.6 | Màn vé **không có nhãn trạng thái thanh toán**: vì vé chỉ tồn tại sau khi đã thanh toán nên nhãn không có giá trị thông tin. |
| BR-10.7 | Màn vé luôn đọc lại đơn từ server khi mở, để không hiển thị dữ liệu cũ từ lúc đơn còn chờ thanh toán. |
| BR-10.8 | Màn vé nhắc có mặt trước giờ chiếu **ít nhất 15 phút**; phim có độ tuổi khác `P` và `K` nhắc mang giấy tờ xác minh độ tuổi khi cần. Địa chỉ rạp lấy theo rạp của đơn. |
| BR-10.9 | Mã QR chỉ để **hiển thị**. Hệ thống chưa có chức năng quét và soát vé tại cổng (xem mục 10). |

### UC-11 Đặt vé nhanh bằng AI

**Tác nhân:** Khách hàng, Gemini. **Mục tiêu:** từ một câu mô tả, nhận tối đa 3 phương án đã sẵn sàng đặt gồm suất chiếu, ghế và combo, rồi xác nhận một bước.

| Mã | Quy tắc |
| --- | --- |
| BR-11.1 | [Cả hai] Phải đăng nhập. Yêu cầu gồm câu mô tả (2–300 ký tự), rạp, tuỳ chọn ngày và số người. |
| BR-11.2 | Mỗi khách hàng gọi gợi ý tối đa **20 lần mỗi giờ**, vượt thì 429 (mã 4290). Bộ đếm lưu trong bộ nhớ của tiến trình server. |
| BR-11.3 | Ngày được chọn phải là hôm nay hoặc sau đó; ngày quá khứ hoặc không có thì dùng hôm nay. |
| BR-11.4 | Phạm vi suất gợi ý: suất `ON_SALE` tại **rạp đã chọn**, bắt đầu từ ít nhất **10 phút nữa**, từ đầu ngày chọn tới 03:00 sáng hôm sau, của các phim đang `APPROVED`, tối đa 80 suất. |
| BR-11.5 | Không có suất nào → trả thông báo "không còn suất nào mở bán" kèm gợi ý đổi ngày hoặc rạp, không báo lỗi. |
| BR-11.6 | Số người lấy theo thứ tự ưu tiên: giá trị khách chọn → suy ra từ câu mô tả → AI suy ra → mặc định **2**. Giới hạn 1–8. Câu mô tả được hiểu theo các mẫu như "2 người", "một mình", "cặp đôi", "cả nhà". |
| BR-11.7 | Giờ mong muốn suy ra từ câu mô tả ("8h tối", "19:30", "chiều", "khuya"…). |
| BR-11.8 | **Gemini chỉ được chọn trong danh sách suất mà server cung cấp** (tối đa 40 suất còn đủ ghế cho cả nhóm) và viết phần tóm tắt phim cùng lý do. Mã suất do AI trả về được kiểm tra lại: mã ngoài danh sách hoặc trùng bị loại, giữ tối đa 3. Nội dung khách nhập chỉ được coi là dữ liệu cần tư vấn, không phải lệnh. |
| BR-11.9 | Khi không có khoá Gemini, Gemini lỗi, quá tải hoặc trả kết quả không hợp lệ, **bộ chọn theo luật** thay thế: ưu tiên suất gần giờ mong muốn nhất (suất sớm hơn giờ mong muốn bị cộng điểm phạt), mỗi phim một suất, còn đủ ghế cho nhóm, tối đa 3. Nếu khách không nêu giờ thì lấy từ 1 giờ sau. Kết quả đánh dấu nguồn `AI` hoặc `RULES`. |
| BR-11.10 | **Ghế do server chọn**, AI không tham gia. Ưu tiên một **khối ghế liền nhau cùng hàng, cùng hạng** gần "điểm đẹp" của phòng (khoảng 60% từ trước ra sau và nằm giữa hàng), cộng điểm nhẹ cho ghế VIP. **Ghế đôi chỉ được đề xuất cho nhóm 2 người**. Không có khối liền nhau thì chọn các ghế rời không phải ghế đôi tốt nhất và đánh dấu `seatsAdjacent = false`. Không đủ ghế thì phương án đó bị bỏ. |
| BR-11.11 | **Combo do server chọn** theo số người: cứ 4 người một Combo Party; phần còn lại cứ 2 người một Combo Đôi (nước mặc định Coca-Cola và Sprite); còn lẻ 1 người thì một Combo Solo (Coca-Cola). Ví dụ 3 người = Combo Đôi + Combo Solo, 6 người = Combo Party + Combo Đôi. |
| BR-11.12 | Giá của phương án = tổng giá ghế (theo giá chụp trên suất) + tổng combo. |
| BR-11.13 | "Đặt nhanh" tạo đơn qua đúng quy tắc UC-06 rồi đặt bắp nước theo UC-07 trong một lần gọi, sau đó ứng dụng mở màn thanh toán. Khách vẫn đổi bắp nước, áp khuyến mãi và có thể bỏ đơn ở màn đó. |
| BR-11.14 | Ghế đã bị người khác giữ giữa lúc gợi ý và lúc bấm "Đặt nhanh" thì 409 như UC-06; khách bấm "Gợi ý lại" để được ghế khác. |

## 5. Nhóm hệ thống (UC-12 và UC-23)

### UC-12 Hết hạn giữ chỗ và đóng đơn

**Tác nhân:** Hệ thống.

| Mã | Quy tắc |
| --- | --- |
| BR-12.1 | Đơn `PENDING_PAYMENT` quá hạn giữ chỗ chuyển sang `EXPIRED` và **nhả ghế**. Việc này thực hiện **khi đơn được đọc, liệt kê hoặc khi có người đặt lại**, không có tiến trình chạy nền. |
| BR-12.2 | Ghế quá hạn giữ được coi là trống ngay lập tức ở sơ đồ ghế, số ghế còn trống và khi tạo đơn mới, dù bản ghi khoá chưa bị xoá. |
| BR-12.3 | Chỉ mục TTL của MongoDB dọn các khoá ghế đã quá hạn khoảng mỗi phút. Đây chỉ là dọn dẹp, không ảnh hưởng nghiệp vụ. |
| BR-12.4 | Đơn `CANCELLED` phát sinh khi: khách tạo đơn mới cho cùng suất (BR-06.8), suất chiếu bị huỷ (BR-19.4), kế hoạch phát hành bị tạm ngưng hoặc đóng (BR-16.5), hoặc phim bị lưu trữ (BR-15.3). Mọi trường hợp đều nhả các ghế đang giữ. Đơn đã thanh toán không bao giờ bị huỷ tự động. |
| BR-12.5 | Đơn chỉ lưu thông tin; không có thông báo đẩy hay email khi đơn hết hạn. |

### UC-23 Khởi tạo dữ liệu hệ thống và dữ liệu demo

**Tác nhân:** Hệ thống (lần truy cập đầu tiên), quản trị viên (`npm run seed:tmdb`).

| Mã | Quy tắc |
| --- | --- |
| BR-23.1 | Lần kết nối đầu tiên tạo các chỉ mục cần thiết: tên đăng nhập và email duy nhất, `tmdbId` duy nhất, suất theo phòng và giờ bắt đầu duy nhất, khoá ghế duy nhất theo `(suất, ghế)` kèm TTL, mã đặt vé duy nhất, khoá idempotency của đơn duy nhất theo từng khách hàng, và kế hoạch phát hành duy nhất theo `(phim, rạp)`. |
| BR-23.2 | Chỉ mục `(phòng, giờ bắt đầu)` duy nhất nghĩa là một phòng không thể có hai suất cùng giờ bắt đầu, kể cả khi dữ liệu được ghi trực tiếp. |
| BR-23.3 | Hệ thống tạo 5 rạp, 14 phòng và bảng giá mỗi rạp **chỉ khi còn thiếu**; không ghi đè dữ liệu đã có (kể cả bảng giá đã được admin sửa). |
| BR-23.4 | Tài khoản quản trị (`admin`/`admin`) và khách demo (`user`/`user`, hồ sơ đầy đủ) được tạo nếu chưa có. Tên và mật khẩu đổi được bằng `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DEMO_USERNAME`, `DEMO_PASSWORD` (và email tương ứng). Phải đổi trước khi triển khai thật. |
| BR-23.5 | **Di chuyển dữ liệu v1:** phim cũ ở trạng thái `PUBLISHED` được đổi thành `APPROVED`, mở sẵn kế hoạch phát hành `OPEN` tại cả 5 rạp (từ ngày khởi chiếu của phim, hoặc hôm nay nếu không có), và được gán định dạng 2D. Việc này chạy mỗi lần khởi động, bỏ qua phim đã có kế hoạch. |
| BR-23.6 | `npm run seed:tmdb` (dữ liệu demo): nhập các phim mới nhất của TMDB cho Việt Nam, mỗi nhóm đến số lượng yêu cầu (mặc định 5 phim đang chiếu và 5 phim sắp chiếu; chạy lại chỉ bù cho đủ). Phim bị bỏ nếu thiếu poster hoặc nội dung, hoặc nếu ngày khởi chiếu không khớp nhóm. Phim demo được **duyệt ngay** và mở kế hoạch phát hành tại cả 5 rạp (từ ngày khởi chiếu nếu ở tương lai, ngược lại từ hôm nay). Sau đó chạy xếp lịch tự động cho cả 5 rạp trong 7 ngày (có thể đổi bằng `SHOWTIME_DAYS`, tối đa 14) và mở bán ngay. |

## 6. Nhóm quản trị (UC-13 – UC-22)

Mọi use case ở nhóm này yêu cầu tài khoản `ADMIN` (BR-GEN.4).

### UC-13 Nhập phim từ TMDB

**Tác nhân:** Quản trị viên, TMDB. **Kết quả:** phim mới ở trạng thái `DRAFT` với các trường đã điền sẵn.

| Mã | Quy tắc |
| --- | --- |
| BR-13.1 | Nguồn gồm hai danh sách của TMDB cho khu vực Việt Nam (đang chiếu, sắp chiếu, tiếng Việt, mỗi lần một trang từ 1 đến 20) và tìm theo tên (tối thiểu **2 ký tự**, ngắn hơn → 400). |
| BR-13.2 | Mỗi kết quả cho biết phim đã có trong hệ thống chưa (`alreadyImported`, kèm mã phim nội bộ). |
| BR-13.3 | Xem trước không lưu gì. Xem trước hiển thị cảnh báo nếu thiếu thời lượng, poster hoặc nội dung. |
| BR-13.4 | Mỗi phim TMDB chỉ nhập **một lần**; nhập lại → 409 (mã 2010) kèm mã phim đã có. |
| BR-13.5 | Dữ liệu được điền sẵn: tên và nội dung tiếng Việt (nếu thiếu nội dung tiếng Việt thì lấy bản tiếng Anh), tên gốc, thời lượng, ngày khởi chiếu, poster và ảnh nền, trailer, quốc gia (tối đa 2), ngôn ngữ gốc, thể loại, phân loại độ tuổi, đạo diễn (tối đa 2) và diễn viên (tối đa 12). |
| BR-13.6 | **Ngày khởi chiếu:** ngày chiếu rạp (loại phát hành 2 hoặc 3) sớm nhất tại Việt Nam nếu TMDB có, ngược lại dùng ngày phát hành toàn cầu. |
| BR-13.7 | **Trailer:** chỉ lấy video YouTube loại Trailer, ưu tiên bản tiếng Việt, rồi bản chính thức, rồi bản đầu tiên. |
| BR-13.8 | **Phân loại độ tuổi:** dùng chứng nhận của Việt Nam nếu có (`P`, `K`, `T13`, `T16`, `T18`; `C` thành `C18`). Nếu không, đổi từ chứng nhận Mỹ (G, PG → P; PG-13 → T13; R, NC-17 → T18). Không có cả hai thì mặc định **T13**. Admin phải kiểm tra lại vì TMDB không phải lúc nào cũng có phân loại Việt Nam. |
| BR-13.9 | **Điểm phổ biến (0–100)** dùng cho xếp lịch: phần độ phổ biến = `min(80, log10(popularity + 1) × 30)`; phần đánh giá = `điểm/10 × 20` nếu có từ 20 lượt chấm trở lên, ngược lại 10; điểm = tổng hai phần, giới hạn trong 5–100, làm tròn. |
| BR-13.10 | Phim mới có trạng thái `DRAFT`, định dạng chỉ 2D, **không hiển thị cho khách**. |
| BR-13.11 | Thiếu `TMDB_API_KEY` hoặc khoá sai → 502. Lỗi mạng hoặc quá 10 giây → 502 "Không kết nối được TMDB". |

### UC-14 Kiểm tra, chỉnh sửa và duyệt phim

**Tác nhân:** Quản trị viên.

| Mã | Quy tắc |
| --- | --- |
| BR-14.1 | Danh sách phim lọc được theo trạng thái (`DRAFT`, `APPROVED`, `ARCHIVED`); mỗi phim kèm số rạp đang khai thác (kế hoạch `OPEN`) và số suất đang mở bán ở tương lai. |
| BR-14.2 | Sửa được ở trạng thái `DRAFT` và `APPROVED`; phim `ARCHIVED` không sửa được → 409 (mã 2014). |
| BR-14.3 | Ràng buộc khi sửa: tên 1–200 ký tự; nội dung 10–3.000 ký tự; khẩu hiệu tối đa 300 ký tự; thời lượng **30–300 phút**; ngày khởi chiếu đúng dạng ngày; phân loại thuộc `P`, `K`, `T13`, `T16`, `T18`; link trailer là URL hợp lệ (hoặc rỗng để xoá); độ ưu tiên xếp lịch **0–100** (rỗng để dùng điểm phổ biến của TMDB). |
| BR-14.4 | Tên, nội dung và khẩu hiệu là bản **tiếng Việt**. |
| BR-14.5 | Định dạng phát hành luôn có **2D**; admin chỉ bật thêm **3D**. Định dạng khác bị loại. |
| BR-14.6 | **Duyệt** chỉ áp dụng cho phim `DRAFT` (ngược lại → 409, mã 2015) và cần đủ 5 thông tin: thời lượng, poster, nội dung, ngày khởi chiếu, phân loại độ tuổi. Thiếu thì 409 (mã 2011) kèm danh sách thông tin thiếu. |
| BR-14.7 | Duyệt chuyển phim sang `APPROVED` và ghi thời điểm duyệt. **Phim đã duyệt vẫn chưa hiển thị cho khách** cho đến khi có kế hoạch phát hành `OPEN` (BR-04.3) và suất mở bán (BR-04.4). |

### UC-15 Lưu trữ phim

**Tác nhân:** Quản trị viên.

| Mã | Quy tắc |
| --- | --- |
| BR-15.1 | Lưu trữ đưa phim ra khỏi lưu hành; trạng thái `ARCHIVED` là cuối cùng, không khôi phục được. Lưu trữ phim đã `ARCHIVED` không có tác dụng thêm. |
| BR-15.2 | Còn đơn `CONFIRMED` cho suất chiếu ở tương lai thì **không lưu trữ được** → 409 (mã 2013), thông báo số đơn còn lại. |
| BR-15.3 | Khi lưu trữ: mọi suất tương lai ở trạng thái `ON_SALE`, `SCHEDULED` hoặc `SUSPENDED` chuyển `CANCELLED`; đơn chờ thanh toán của các suất đó bị huỷ và ghế đang giữ được nhả; mọi kế hoạch phát hành chưa đóng chuyển `CLOSED`. |

### UC-16 Quản lý kế hoạch phát hành

**Tác nhân:** Quản trị viên. **Khái niệm:** kế hoạch phát hành là quyền khai thác một phim tại một rạp trong một khoảng thời gian.

| Mã | Quy tắc |
| --- | --- |
| BR-16.1 | Mỗi cặp **(phim, rạp) chỉ có một kế hoạch**. Tạo kế hoạch cho nhiều rạp một lần: rạp đã có kế hoạch hoặc không tồn tại được bỏ qua kèm lý do, các rạp còn lại vẫn được tạo. |
| BR-16.2 | Chỉ phim `APPROVED` mới có kế hoạch phát hành → 409 (mã 3101). Phim không tồn tại → 404 (mã 2002). |
| BR-16.3 | Ngày kết thúc (nếu có) không được trước ngày bắt đầu → 400. Có thể không đặt ngày kết thúc. |
| BR-16.4 | Trạng thái ban đầu là `PLANNED` (dự kiến) hoặc `OPEN` (khai thác ngay). Chuyển trạng thái chỉ theo sơ đồ ở mục 7.2, ngược lại → 409 (mã 3103). |
| BR-16.5 | Chuyển sang `SUSPENDED` hoặc `CLOSED` sẽ **tạm dừng các suất tương lai** (`ON_SALE` hoặc `SCHEDULED`) của phim đó tại rạp đó **nếu chưa bán vé**. Suất đã có vé bán ra vẫn tiếp tục để khách đã trả tiền được xem. Đơn chờ thanh toán của các suất bị tạm dừng bị huỷ và ghế được nhả. |
| BR-16.6 | `SUSPENDED` mở lại thành `OPEN` **không tự mở bán lại** các suất đã tạm dừng; admin phải mở lại từ màn Lịch chiếu (UC-19). |
| BR-16.7 | Xoá kế hoạch chỉ được khi phim chưa từng có suất nào tại rạp đó (mọi trạng thái), ngược lại → 409 (mã 3104) và phải đóng kế hoạch thay vì xoá. [App] Nút xoá chỉ hiện ở kế hoạch `PLANNED`. |
| BR-16.8 | Kế hoạch có hiệu lực trong xếp lịch (UC-17) vào một ngày khi: trạng thái `OPEN` **và** ngày bắt đầu không sau ngày đó **và** (không có ngày kết thúc hoặc ngày kết thúc không trước ngày đó). |

### UC-17 Tạo suất chiếu tự động

**Tác nhân:** Quản trị viên. **Thuật toán:** Legacy Greedy (chuyển từ bản Java). **Kết quả:** một lần tạo (run) lưu số liệu thống kê, các suất mới ở trạng thái `SCHEDULED`.

**Đầu vào và điều kiện**

| Mã | Quy tắc |
| --- | --- |
| BR-17.1 | Đầu vào: ngày bắt đầu, ngày kết thúc, danh sách rạp, danh sách phim, tuỳ chọn mở bán ngay, và tuỳ chọn chính sách. |
| BR-17.2 | Khoảng ngày tối đa **14 ngày** (kể cả ngày đầu và cuối) và ngày kết thúc không trước ngày bắt đầu → 400. |
| BR-17.3 | Phải có ít nhất một phim `APPROVED` trong danh sách phim, ngược lại → 409 (mã 3201). Phim không được duyệt bị bỏ qua. |
| BR-17.4 | Chính sách mặc định: mốc giờ cách nhau **15 phút**; dọn phòng **15 phút**; cùng một phim bắt đầu cách nhau **20 phút** nếu ở phòng khác; một phim chiếm tối đa **60%** số phòng cùng lúc; tối thiểu **1** suất mỗi phim mỗi ngày; suất hôm nay phải bắt đầu sau **30 phút** kể từ bây giờ. Có thể ghi đè các tham số: mốc giờ 5–60 phút, dọn phòng 0–60, cách nhau 0–120, tỉ lệ phòng 0,1–1, tối thiểu 0–10. |
| BR-17.24 | **Điều kiện của phim.** Mỗi phim được chọn phải có kế hoạch phát hành `OPEN` tại **ít nhất một rạp trong số rạp đã chọn**, và kế hoạch đó phải trùng khoảng ngày đã chọn (BR-16.8), và phim phải khởi chiếu trong khoảng đó. Ngày được tính cho từng rạp là giao của kế hoạch, ngày khởi chiếu của phim và khoảng ngày đã chọn. |
| BR-17.25 | **Phim chưa đủ điều kiện bị chặn, không bị bỏ qua ngầm.** Nếu bất kỳ phim nào được gửi lên không đạt BR-17.24 thì cả yêu cầu bị từ chối → 409 (mã 3204), không tạo suất nào và không ghi lần tạo nào. Kết quả trả danh sách phim bị chặn kèm lý do: `NO_PLAN` (rạp đã chọn chưa có kế hoạch, kèm tên rạp có kế hoạch), `PLAN_NOT_OPEN` (kế hoạch chưa ở trạng thái Đang khai thác), `PLAN_OUTSIDE_RANGE` (kế hoạch không trùng khoảng ngày, kèm ngày bắt đầu khai thác), `NOT_RELEASED` (phim khởi chiếu sau khoảng ngày). |
| BR-17.26 | Một phim đạt BR-17.24 ở một số rạp nhưng không có kế hoạch ở rạp khác trong số rạp đã chọn **vẫn được xếp**; các rạp không có kế hoạch được ghi là "không đủ điều kiện" (BR-17.6) và không tạo suất ở đó. |
| BR-17.27 | `GET /api/admin/scheduling-eligibility?startDate=&endDate=&clusterIds=` trả mọi phim `APPROVED` kèm đạt hay không, lý do, và các rạp cùng ngày áp dụng. [App] Biểu mẫu dùng kết quả này để **khoá** phim chưa đủ điều kiện (không chọn được, kèm lý do và đường dẫn mở kế hoạch phát hành), chỉ cho chọn phim đủ điều kiện, và tự bỏ chọn phim khi đổi rạp hoặc khoảng ngày làm phim hết đủ điều kiện. Danh sách chọn tất cả chỉ gồm phim đủ điều kiện. |

**Tạo ứng viên (candidate factory)**

| Mã | Quy tắc |
| --- | --- |
| BR-17.5 | Ứng viên được sinh cho **từng ngày × rạp × phim × định dạng × phòng**. Rạp không có giờ mở cửa ngày đó thì bỏ qua. |
| BR-17.6 | Phim bị **loại cả ngày tại rạp** (ghi vào danh sách "không đủ điều kiện") khi: không có kế hoạch phát hành có hiệu lực (`MOVIE_NOT_AVAILABLE`), chưa tới ngày khởi chiếu của phim (`NOT_RELEASED_YET`), hoặc rạp không có phòng hỗ trợ định dạng nào của phim (`NO_ELIGIBLE_ROOM`). |
| BR-17.7 | Phòng chỉ nhận định dạng nằm trong danh sách định dạng của phòng. Phim không khai báo định dạng thì coi là 2D. Phim 3D chiếu cả 2D và 3D ở các phòng phù hợp. |
| BR-17.8 | Mốc giờ bắt đầu chạy từ **giờ mở cửa** của rạp theo bước mốc giờ, chừng nào **giờ bắt đầu + thời lượng + thời gian dọn phòng ≤ giờ đóng cửa**. Nghĩa là suất cuối phải kết thúc trước giờ đóng cửa ít nhất bằng thời gian dọn phòng. Phim không có thời lượng dùng 120 phút. |
| BR-17.9 | Mốc giờ trước "bây giờ + 30 phút" bị bỏ qua và không tính vào thống kê. |
| BR-17.10 | Các suất đã có (mọi trạng thái trừ `CANCELLED`) của các rạp được chọn, trong khoảng từ hôm trước đến 06:00 sáng hôm sau, **chặn phòng** (kể cả thời gian dọn phòng ở hai đầu) và được tính vào hạn mức suất mỗi ngày. Ứng viên trùng bị loại với lý do `EXISTING_SHOWTIME_CONFLICT`. Vì vậy chạy lại với cùng đầu vào không tạo suất trùng. |

**Chấm điểm (scorer)**

| Mã | Quy tắc |
| --- | --- |
| BR-17.11 | Điểm mỗi ứng viên = phim × 0,40 + rạp × 0,25 + khung giờ × 0,15 + định dạng × 0,10 + độ vừa phòng × 0,10, mỗi thành phần trong khoảng 0–1. |
| BR-17.12 | **Điểm phim** = độ ưu tiên do admin đặt, nếu không thì điểm phổ biến TMDB, nếu không có thì 50, chia 100. **Điểm rạp** = điểm nhu cầu của rạp chia 100. |
| BR-17.13 | **Điểm khung giờ** theo hệ số: sáng 06–12 giờ (0,55 ngày thường, 0,75 cuối tuần), chiều 12–17 (0,70, 0,90), tối 17–22 (1,00, 1,10, khung cao điểm), khuya 22–06 (0,60, 0,75). Ở bước chấm điểm, cuối tuần là **thứ Bảy và Chủ nhật**. |
| BR-17.14 | **Điểm định dạng** = ưu tiên định dạng chia ưu tiên cao nhất: 2D = 100, 3D = 80, khác = 50. |
| BR-17.15 | **Độ vừa phòng:** lượng khán giả dự kiến = `giới hạn(0,05 đến 1) của [(điểm phim × 0,7 + điểm rạp × 0,3) × hệ số khung giờ × (0,85 + điểm định dạng × 0,15)] × sức chứa phòng lớn nhất của rạp`. Độ vừa = `1 − (số chỗ vượt + 0,5 × số chỗ trống) / sức chứa lớn nhất`, giới hạn 0–1. |
| BR-17.16 | Xếp hạng giảm dần theo điểm; khi bằng điểm sắp theo rạp, ngày, giờ, phòng, phim, định dạng để kết quả luôn như nhau với cùng đầu vào. |

**Chọn suất (selector)**

| Mã | Quy tắc |
| --- | --- |
| BR-17.17 | Rạp **không có hồ sơ nhu cầu** thì mọi ứng viên bị loại với `MISSING_DEMAND_PROFILE`. |
| BR-17.18 | **Vòng 1 (bảo đảm tối thiểu):** quay vòng, mỗi lượt mỗi nhóm (phim, rạp, ngày) nhận tối đa một suất, đến khi đạt mức tối thiểu = `min(max(tối thiểu của chính sách, minDailyShows của rạp), maxDailyShowsPerMovie của rạp)`. Quay vòng để phim điểm cao không chiếm hết phòng trước khi phim khác được xét. |
| BR-17.19 | **Vòng 2 (chia thêm theo điểm):** các ứng viên còn lại, điểm cao trước, được thêm cho đến hạn mức `maxDailyShowsPerMovie` của rạp. Vượt hạn mức → `MAX_DAILY_SHOWS_PER_MOVIE_REACHED`. |
| BR-17.20 | Mỗi ứng viên phải qua ba ràng buộc cứng theo thứ tự, không đạt thì bị loại với lý do tương ứng: (1) số phòng **cùng chiếu một phim tại cùng thời điểm** không vượt `floor(tỉ lệ phòng × số phòng có ứng viên trong ngày)`, tối thiểu 1 phòng → `MAXIMUM_ROOM_SHARE_REACHED`; (2) cùng phim **bắt đầu cách nhau ít nhất 20 phút** giữa các phòng khác nhau trong rạp → `SAME_MOVIE_START_STAGGER_CONFLICT`; (3) cùng phòng không chồng giờ, tính cả thời gian dọn phòng → `CLEANUP_BUFFER_CONFLICT`. |

**Lưu và báo cáo**

| Mã | Quy tắc |
| --- | --- |
| BR-17.21 | Suất được tạo có: phòng, giờ bắt đầu và kết thúc, định dạng, ngôn ngữ theo BR-05.6, giá chụp từ bảng giá của rạp theo ngày, giờ bắt đầu, định dạng (BR-20.4), mã lần tạo, và trạng thái **`SCHEDULED`** (chưa bán), hoặc `ON_SALE` nếu chọn mở bán ngay. |
| BR-17.22 | Mỗi lần tạo lưu báo cáo: tổng ứng viên, được chọn, bị loại, số "không đủ điều kiện", thời gian chạy; số lượng theo từng lý do; thống kê theo phim, rạp, ngày; chính sách đã dùng; **tối đa 40 mẫu bị loại cho mỗi lý do** (ưu tiên điểm cao nhất) và tối đa 300 dòng không đủ điều kiện. Tổng ứng viên = được chọn + bị loại. |
| BR-17.23 | Lịch sử các lần tạo xếp mới nhất trước, mặc định 30 lần. |
| BR-17.28 | Mỗi lần tạo lưu thêm **bảng kết quả phim × rạp**: số suất được chọn, số ứng viên bị loại, số ngày bị loại trước khi xếp và lý do chính, và các ngày rạp được phép chiếu phim trong lần tạo đó (từ ngày nào đến ngày nào). Lần tạo cũ (trước khi có bảng này) vẫn xem được, các thông tin trên suy ra từ suất hiện có và danh sách loại đã lưu. |
| BR-17.29 | **Kết quả theo phim** trong báo cáo: mỗi phim có kết quả `CREATED` (mọi rạp có thể chiếu đều có suất), `PARTIAL` (có rạp có kế hoạch nhưng không xếp được suất) hoặc `NONE` (không có suất nào). Mỗi phim hiển thị số suất theo từng rạp có kế hoạch, các rạp không có kế hoạch, và số suất theo từng ngày trong khoảng ngày (ngày bằng 0 thường do kế hoạch chưa tới ngày khai thác). Mỗi phim ghi số suất theo trạng thái (đang mở bán, chờ mở bán, tạm dừng). Bấm một ngày có suất sẽ hiện **giờ chiếu theo từng rạp**: mỗi suất là một ô giờ kèm phòng và định dạng, màu cho biết trạng thái (xanh: đang mở bán, xám: chờ mở bán, cam: tạm dừng). |
| BR-17.30 | **Danh sách suất đã tạo** trong báo cáo liệt kê từng suất (rạp, phòng, giờ bắt đầu và kết thúc, định dạng, giá ghế thường, trạng thái) theo ngày và rạp, lọc theo ngày, rạp, phim. Danh sách phản ánh trạng thái hiện tại của suất (đã mở bán, tạm dừng…), tối đa 3.000 suất mỗi báo cáo. Lần tạo đã huỷ không còn suất để liệt kê. |

### UC-18 Mở bán hoặc huỷ một lần tạo suất

**Tác nhân:** Quản trị viên.

| Mã | Quy tắc |
| --- | --- |
| BR-18.1 | **Mở bán** chỉ chuyển các suất của lần tạo đó đang `SCHEDULED` và còn ở tương lai sang `ON_SALE`. Suất đã bắt đầu hoặc đã đổi trạng thái thủ công không bị đổi. Ghi nhận thời điểm mở bán. |
| BR-18.2 | Chỉ lần tạo ở trạng thái `COMPLETED` mới mở bán được → 409 (mã 3203). Lần tạo không tồn tại → 404 (mã 3202). |
| BR-18.3 | **Huỷ lần tạo** xoá các suất của lần tạo đó còn `SCHEDULED` (chưa mở bán). Suất đã mở bán không bị xoá. Nếu không còn suất nào, lần tạo chuyển `DISCARDED`. |
| BR-18.4 | Việc mở bán làm phim chuyển từ Sắp chiếu sang Đang chiếu ở rạp tương ứng (BR-04.4). |

### UC-19 Quản lý suất chiếu

**Tác nhân:** Quản trị viên.

| Mã | Quy tắc |
| --- | --- |
| BR-19.1 | Danh sách suất theo ngày và theo rạp, mọi trạng thái, kèm số ghế đã bán và mã lần tạo, sắp theo giờ rồi phòng. Mặc định hôm nay. |
| BR-19.2 | Đổi trạng thái hàng loạt: `ON_SALE` (mở bán hoặc mở bán lại), `SUSPENDED` (tạm dừng), `CANCELLED` (huỷ), tối đa **500 suất** mỗi lần. Kết quả trả số suất đã đổi và danh sách suất bị bỏ qua kèm lý do. |
| BR-19.3 | Suất bị bỏ qua khi: không tồn tại; đã `CANCELLED` hoặc `COMPLETED`; đã ở đúng trạng thái đích; mở bán nhưng suất **đã bắt đầu**; tạm dừng hoặc huỷ nhưng suất **đã có vé bán ra**. Suất có vé bán ra không thể tạm dừng hay huỷ vì khách đã thanh toán sẽ mất chỗ. |
| BR-19.4 | Huỷ suất sẽ huỷ các đơn đang chờ thanh toán của suất đó và nhả ghế đang giữ. |
| BR-19.5 | Tạm dừng một suất không huỷ đơn đang chờ thanh toán; suất không còn hiển thị để đặt mới. |
| BR-19.6 | Suất chiếu **không tự chuyển `COMPLETED`**. Suất đã qua giờ chiếu đơn giản không còn đặt được vì BR-06.2 kiểm tra giờ bắt đầu (xem mục 10). |
| BR-19.7 | Mỗi phòng không thể có hai suất cùng giờ bắt đầu (chỉ mục duy nhất). |

### UC-20 Quản lý bảng giá vé

**Tác nhân:** Quản trị viên. Mỗi rạp có **một bảng giá riêng**.

| Mã | Quy tắc |
| --- | --- |
| BR-20.1 | Bảng giá gồm các **mức giá chuẩn** (giá ghế thường) theo **loại ngày × khung giờ × định dạng**, và **hệ số theo hạng ghế**. Loại ngày: ngày thường (**thứ Hai đến thứ Năm**) và cuối tuần (**thứ Sáu, thứ Bảy, Chủ nhật**). Khung giờ theo giờ bắt đầu suất: sáng (trước 12:00), chiều (12:00–17:00), tối (17:00–22:00), khuya (từ 22:00). Định dạng: 2D, 3D. |
| BR-20.2 | Mức giá chuẩn là số nguyên từ **10.000 đến 1.000.000 ₫** và được làm tròn đến **1.000 ₫**. Mỗi lần lưu có 1–32 mức giá. Hệ số mỗi hạng ghế từ **0,5 đến 3**. |
| BR-20.3 | Giá ghế = mức giá chuẩn × hệ số hạng ghế, làm tròn đến 1.000 ₫. Hệ số mặc định: ghế thường 1,0; VIP 1,2; ghế đôi 1,15 (áp cho **mỗi chỗ** của cặp). |
| BR-20.4 | Khi chọn mức giá cho suất: tìm theo đúng (loại ngày, khung giờ, định dạng); nếu thiếu thì dùng mức **2D** của cùng loại ngày và khung giờ; vẫn thiếu thì 409 (mã 3002). Rạp không có bảng giá → 404 (mã 3001). |
| BR-20.5 | Lưu bảng giá **thay thế toàn bộ** bảng cũ. |
| BR-20.6 | Giá được **chụp vào suất chiếu lúc tạo suất** (giá từng hạng ghế và mã mức giá). Sửa bảng giá chỉ áp dụng cho suất tạo **sau đó**; suất đã tạo giữ nguyên giá nên vé đã bán và suất đang bán không đổi. |
| BR-20.7 | Bảng giá mặc định theo rạp ở mục 8.5. |

### UC-21 Theo dõi đơn đặt vé

**Tác nhân:** Quản trị viên. Chỉ xem, **không sửa** đơn.

| Mã | Quy tắc |
| --- | --- |
| BR-21.1 | Danh sách mọi đơn của mọi khách hàng, mới nhất trước, phân trang từ 0, tối đa 50 dòng mỗi trang. |
| BR-21.2 | Lọc theo: trạng thái (`CONFIRMED`, `PENDING_PAYMENT`, `CLOSED` gồm đơn đã huỷ và hết hạn), từ khoá (khớp một phần mã đặt vé hoặc tên phim, không phân biệt hoa thường) và rạp. |
| BR-21.3 | Quản trị viên thấy mã đặt vé của mọi đơn (kể cả chưa thanh toán) và tên đăng nhập của khách hàng. |
| BR-21.4 | Khi liệt kê, đơn chờ thanh toán đã quá hạn được chuyển `EXPIRED` (BR-12.1). |
| BR-21.5 | Tên rạp trên đơn luôn là tên rạp hiện tại theo mã rạp, nên đơn cũ cũng hiển thị đúng tên mới. |

### UC-22 Quản lý khách hàng

**Tác nhân:** Quản trị viên. Chỉ áp dụng cho tài khoản vai trò `MEMBER`.

| Mã | Quy tắc |
| --- | --- |
| BR-22.1 | Danh sách khách hàng mới nhất trước, trang bắt đầu từ 1, tối đa 50 dòng mỗi trang. Tìm theo tên đăng nhập hoặc email (khớp một phần, không phân biệt hoa thường) và lọc theo trạng thái `ACTIVE` hoặc `INACTIVE`. |
| BR-22.2 | Tài khoản không phải `MEMBER` (kể cả quản trị viên) không xem hay thay đổi được qua chức năng này → 404 (mã 1404). |
| BR-22.3 | **Vô hiệu hoá** tài khoản (`INACTIVE`) vừa chặn đăng nhập, vừa **đăng xuất khỏi mọi thiết bị ngay** do tăng phiên bản token (BR-02.4). Kích hoạt lại không cần đổi mật khẩu. |
| BR-22.4 | **Thu hồi phiên** đăng xuất mọi thiết bị mà vẫn giữ tài khoản hoạt động. |
| BR-22.5 | Quản trị viên xem hồ sơ khách hàng nhưng không sửa (BR-03.5). Đơn của khách hàng bị vô hiệu hoá vẫn giữ nguyên. |

## 7. Vòng đời trạng thái

### 7.1 Phim

| Từ | Đến | Điều kiện |
| --- | --- | --- |
| (nhập TMDB) | `DRAFT` | Nhập phim (UC-13) |
| `DRAFT` | `APPROVED` | Đủ 5 thông tin bắt buộc (BR-14.6) |
| `DRAFT`, `APPROVED` | `ARCHIVED` | Không còn vé đã bán cho suất tương lai (BR-15.2) |
| `ARCHIVED` | — | Trạng thái cuối |

### 7.2 Kế hoạch phát hành

| Từ | Đến được |
| --- | --- |
| `PLANNED` | `OPEN`, `CLOSED` |
| `OPEN` | `SUSPENDED`, `CLOSED` |
| `SUSPENDED` | `OPEN`, `CLOSED` |
| `CLOSED` | không chuyển được nữa |

### 7.3 Suất chiếu

| Từ | Đến | Cách xảy ra |
| --- | --- | --- |
| (tạo tự động) | `SCHEDULED` | Tạo suất không chọn mở bán ngay |
| (tạo tự động) | `ON_SALE` | Tạo suất có chọn mở bán ngay |
| `SCHEDULED` | `ON_SALE` | Mở bán lần tạo hoặc mở bán từng suất (suất chưa bắt đầu) |
| `ON_SALE` | `SUSPENDED` | Tạm dừng thủ công, hoặc kế hoạch bị tạm ngưng/đóng khi chưa có vé |
| `SUSPENDED` | `ON_SALE` | Mở bán lại (suất chưa bắt đầu) |
| `SCHEDULED`, `ON_SALE`, `SUSPENDED` | `CANCELLED` | Huỷ thủ công (chưa có vé), hoặc lưu trữ phim |
| `COMPLETED` | — | Có trong mô hình nhưng hệ thống chưa tự đặt (BR-19.6) |

### 7.4 Đơn đặt vé

| Từ | Đến | Cách xảy ra |
| --- | --- | --- |
| (tạo) | `PENDING_PAYMENT` | Giữ ghế thành công |
| `PENDING_PAYMENT` | `CONFIRMED` | Thanh toán thành công |
| `PENDING_PAYMENT` | `EXPIRED` | Quá hạn giữ ghế |
| `PENDING_PAYMENT` | `CANCELLED` | Tạo đơn mới cùng suất, suất bị huỷ, kế hoạch ngưng/đóng, phim bị lưu trữ |
| `EXPIRED`, `CANCELLED` | `CONFIRMED` | Chỉ khi tiền về muộn và lấy lại được đúng ghế (BR-09.13) |

`paymentStatus` của đơn đi theo: `NOT_STARTED` → `PENDING` (bắt đầu thanh toán) → `SUCCEEDED` hoặc `FAILED`.

### 7.5 Giao dịch thanh toán

| Từ | Đến | Cách xảy ra |
| --- | --- | --- |
| (tạo) | `PENDING` | Bắt đầu thanh toán |
| `PENDING` | `PAID` | Nhận kết quả thành công hợp lệ |
| `PENDING` | `FAILED` | Nhận kết quả thất bại hoặc khách huỷ |
| `PENDING` quá hạn | hiển thị `EXPIRED` | Hết hạn của giao dịch (suy ra khi đọc, không ghi lại) |

### 7.6 Lần tạo suất tự động

| Từ | Đến | Cách xảy ra |
| --- | --- | --- |
| (chạy xong) | `COMPLETED` | Tạo thành công |
| `COMPLETED` | `DISCARDED` | Huỷ lần tạo và không còn suất nào |

Trạng thái `FAILED` có trong mô hình nhưng hệ thống chưa ghi.

## 8. Phụ lục dữ liệu cấu hình

### 8.1 Rạp và hồ sơ nhu cầu

| Mã | Rạp | Giờ mở cửa (T2–T5) | Giờ mở cửa (T6–CN) | Mức nhu cầu | Điểm | Tối thiểu/ngày | Tối đa/ngày |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CinePrime Ninh Kiều | 08:30–23:30 | 08:00–24:00 | HIGH | 90 | 2 | 8 |
| 2 | CinePrime Cái Răng | 08:30–23:30 | 08:00–24:00 | MEDIUM | 70 | 2 | 6 |
| 3 | CinePrime Bình Thủy | 09:00–23:00 | 08:30–23:30 | MEDIUM | 60 | 1 | 5 |
| 4 | CinePrime Ô Môn | 09:00–23:00 | 08:30–23:30 | LOW | 40 | 1 | 4 |
| 5 | CinePrime Thốt Nốt | 09:00–22:30 | 08:30–23:00 | LOW | 35 | 1 | 3 |

Tối thiểu/tối đa là số suất mỗi phim mỗi ngày tại rạp. Rạp đặt tên hư cấu, địa chỉ chỉ ghi đến cấp quận.

### 8.2 Phòng và sơ đồ ghế

| Loại phòng | Số ghế | Cách bố trí |
| --- | --- | --- |
| `SMALL` | 60 (6 hàng × 10) | Hàng A–D thường, E VIP, F ghế đôi |
| `STANDARD` | 80 (8 hàng × 10) | Hàng A–D thường, E–F VIP, G–H ghế đôi |
| `LARGE` | 120 (10 hàng × 12) | Hàng A–E thường, F–H VIP, I–J ghế đôi |

Ghế đôi ghép theo cặp liền nhau (1–2, 3–4, …).

| Rạp | Phòng (loại, định dạng) |
| --- | --- |
| Ninh Kiều | P1 STANDARD 2D · P2 STANDARD 2D · P3 STANDARD 2D/3D · P4 LARGE 2D/3D |
| Cái Răng | P1 LARGE 2D/3D · P2 STANDARD 2D · P3 SMALL 2D |
| Bình Thủy | P1 STANDARD 2D/3D · P2 STANDARD 2D · P3 SMALL 2D |
| Ô Môn | P1 STANDARD 2D/3D · P2 SMALL 2D |
| Thốt Nốt | P1 STANDARD 2D · P2 SMALL 2D |

### 8.3 Thực đơn bắp nước

| Mã | Món | Giá | Ghi chú |
| --- | --- | --- | --- |
| COMBO1 | Combo Solo | 79.000 ₫ | 1 bắp vừa + 1 nước ngọt; chọn đúng 1 loại nước |
| COMBO2 | Combo Đôi | 129.000 ₫ | 1 bắp lớn + 2 nước ngọt; chọn đúng 2 loại nước |
| COMBO3 | Combo Party | 249.000 ₫ | 2 bắp lớn + 4 nước ngọt + 1 nachos phô mai |
| COMBO4 | Combo Nachos & Hot Dog | 169.000 ₫ | 1 nachos + 2 hot dog + 2 nước ngọt; chọn đúng 2 loại nước |
| COMBO5 | Combo Caramel | 109.000 ₫ | 1 bắp caramel + 1 snack khoai tây + 1 nước cam |
| POP-M | Bắp rang bơ vừa | 45.000 ₫ | |
| POP-L | Bắp rang bơ lớn | 59.000 ₫ | |
| COLA | Coca-Cola | 29.000 ₫ | |
| SPRITE | Sprite | 29.000 ₫ | |
| ORANGE | Nước cam | 29.000 ₫ | |
| WATER | Nước suối | 20.000 ₫ | |
| NACHOS | Nachos phô mai | 49.000 ₫ | |
| HOTDOG | Hot dog | 39.000 ₫ | |

Danh sách nước được chọn trong combo: Coca-Cola, Sprite, Nước cam. Mọi rạp bán cùng một thực đơn.

### 8.4 Khuyến mãi

| Mã | Tên | Phạm vi | Mức giảm | Điều kiện tối thiểu | Giới hạn |
| --- | --- | --- | --- | --- | --- |
| WELCOME10 | Chào bạn mới | Cả đơn | 10%, tối đa 50.000 ₫ | Đơn từ 100.000 ₫ | Mỗi tài khoản dùng một lần |
| VE15K | Giảm tiền vé | Tiền vé | 15.000 ₫ | Tiền vé từ 150.000 ₫ | Không |
| BAPNUOC20 | Giảm bắp nước | Bắp nước | 20.000 ₫ | Bắp nước từ 60.000 ₫ | Không |

### 8.5 Bảng giá mặc định (giá ghế thường, 2D, ngày thường)

| Khung giờ | Giá nền | Rạp HIGH (Ninh Kiều) | Rạp MEDIUM (Cái Răng, Bình Thủy) | Rạp LOW (Ô Môn, Thốt Nốt) |
| --- | --- | --- | --- | --- |
| Sáng | 55.000 ₫ | 65.000 ₫ | 60.000 ₫ | 55.000 ₫ |
| Chiều | 65.000 ₫ | 75.000 ₫ | 70.000 ₫ | 65.000 ₫ |
| Tối | 80.000 ₫ | 90.000 ₫ | 85.000 ₫ | 80.000 ₫ |
| Khuya | 65.000 ₫ | 75.000 ₫ | 70.000 ₫ | 65.000 ₫ |

Quy tắc suy ra các mức còn lại: **cuối tuần cộng 15.000 ₫**, **3D cộng 20.000 ₫**; rạp HIGH cộng 10.000 ₫, MEDIUM cộng 5.000 ₫, LOW không cộng. Sau đó nhân hệ số hạng ghế (BR-20.3).

## 9. Mã lỗi nghiệp vụ

| Mã | HTTP | Ý nghĩa |
| --- | --- | --- |
| 1006 | 401 | Sai tên đăng nhập hoặc mật khẩu |
| 1007 | 403 | Tài khoản bị vô hiệu hoá |
| 1404 | 404 | Không tìm thấy tài khoản khách hàng |
| 2002 | 404 | Không tìm thấy phim (hoặc phim chưa hiển thị cho khách) |
| 2010 | 409 | Phim TMDB đã được nhập |
| 2011 | 409 | Chưa thể duyệt, còn thiếu thông tin |
| 2013 | 409 | Chưa thể lưu trữ vì còn vé đã bán cho suất tương lai |
| 2014 | 409 | Phim đã lưu trữ, không sửa được |
| 2015 | 409 | Chỉ phim nháp mới cần duyệt |
| 2501 | 404 | Không tìm thấy suất chiếu |
| 2502 | 409 | Suất chiếu đã đóng bán vé |
| 2503 | 409 | Ghế vừa có người khác giữ |
| 2504 | 404 | Không tìm thấy đơn đặt vé |
| 2505 | 409 | Đơn không còn ở trạng thái chờ thanh toán |
| 2506 | 409 | Đang có giao dịch thanh toán chưa hoàn tất |
| 2600 | 400 | Mã khuyến mãi không tồn tại |
| 2601 | 400 | Đơn chưa đủ điều kiện của mã |
| 2602 | 400 | Bạn đã sử dụng mã này |
| 2701 | 404 | Chưa có giao dịch cho đơn |
| 2702 | 503 | Cổng thanh toán đang bảo trì (chưa cấu hình) |
| 3001 | 404 | Rạp chưa có bảng giá |
| 3002 | 409 | Bảng giá chưa có mức cho ngày, giờ, định dạng này |
| 3101 | 409 | Chỉ phim đã duyệt mới có kế hoạch phát hành |
| 3102 | 404 | Không tìm thấy kế hoạch phát hành |
| 3103 | 409 | Chuyển trạng thái kế hoạch không hợp lệ |
| 3104 | 409 | Kế hoạch đã có suất chiếu, không xoá được |
| 3201 | 409 | Chưa chọn phim đã duyệt khi tạo suất |
| 3202 | 404 | Không tìm thấy lần tạo suất |
| 3203 | 409 | Lần tạo suất không còn hiệu lực |
| 3204 | 409 | Có phim chưa đủ điều kiện tạo suất (chưa có kế hoạch phát hành phù hợp) |
| 4090–4092 | 409 | Trùng tên đăng nhập hoặc email khi đăng ký |
| 4290 | 429 | Hỏi trợ lý AI quá nhiều lần |

Lỗi dữ liệu gửi lên không hợp lệ trả 400 kèm thông báo của trường đầu tiên sai. Thiếu hoặc hết hạn token trả 401; thiếu quyền trả 403; lỗi không lường trước trả 500 với thông báo chung.

## 10. Giới hạn và khoảng trống đã biết

Phần này liệt kê những chỗ hệ thống chưa thực thi quy tắc hoặc thực thi chưa đầy đủ, để người đọc không hiểu nhầm là đã có.

| # | Nội dung | Hệ quả |
| --- | --- | --- |
| 1 | **Hồ sơ đầy đủ chỉ kiểm tra ở giao diện** (BR-03.6). Đặt vé nhanh (UC-11) và gọi API trực tiếp không cần hồ sơ đầy đủ. | Khách có hồ sơ trống vẫn đặt được qua đường đặt nhanh. |
| 2 | **Không có IPN của VNPay** (BR-09.18). Xác nhận chỉ qua trang trả về có chữ ký. | Nếu khách đóng trình duyệt trước khi VNPay chuyển về trang trả về, tiền có thể bị trừ mà đơn không được xác nhận và hết hạn. Khi đó chưa có cơ chế tự đối soát. |
| 3 | **Hoàn tiền thủ công** (BR-09.13). | Thanh toán muộn mà mất ghế chỉ hiển thị thông báo liên hệ hotline. |
| 4 | **Không có chức năng quét và soát vé** (BR-10.9). | Mã QR chỉ để hiển thị; chưa đánh dấu vé đã sử dụng. |
| 5 | **Suất chiếu không tự `COMPLETED`** (BR-19.6). | Suất đã qua giờ vẫn giữ trạng thái cũ; chỉ không còn đặt được. |
| 6 | **Rạp, phòng, thực đơn, khuyến mãi là cấu hình trong mã** (BR-GEN.8). | Muốn thêm rạp hoặc đổi thực đơn phải sửa mã và triển khai lại. Bảng giá thì sửa được trên giao diện admin. |
| 7 | **Hết hạn giữ ghế xử lý theo kiểu "khi được đọc"** (BR-12.1). | Không có tiến trình nền; đơn quá hạn chỉ đổi trạng thái khi có người truy cập. Số liệu hiển thị cho khách vẫn đúng nhờ BR-12.2. |
| 8 | **Bộ đếm giới hạn gọi AI lưu trong bộ nhớ tiến trình** (BR-11.2). | Mất khi khởi động lại và không chia sẻ giữa nhiều server. |
| 9 | **Khác biệt định nghĩa cuối tuần:** chấm điểm xếp lịch tính Thứ Bảy–Chủ nhật (BR-17.13), còn tính giá tính Thứ Sáu–Chủ nhật (BR-20.1). | Đây là chủ ý nhưng dễ nhầm khi đọc. |
| 10 | **Hiển thị theo kế hoạch không kiểm tra ngày bắt đầu** (BR-04.3). Kế hoạch `OPEN` có ngày bắt đầu ở tương lai vẫn làm phim hiện ở nhóm Sắp chiếu ngay. | Dùng `PLANNED` nếu chưa muốn phim hiển thị. |
| 11 | **Đặt nhanh có thể để lại đơn không có bắp nước** nếu bước thêm bắp nước lỗi sau khi giữ ghế (BR-11.13). | Đơn vẫn hợp lệ và giữ ghế; khách thêm bắp nước thủ công ở màn thanh toán. |
| 12 | **Tạm ngưng kế hoạch rồi mở lại không tự mở bán lại suất** (BR-16.6). | Admin phải mở lại từng suất hoặc tạo lần xếp lịch mới. |
| 13 | **Không có thông báo đẩy, email hay SMS** cho đơn, nhắc giờ chiếu hoặc hoàn tiền. | Khách chỉ thấy thông tin khi mở ứng dụng. |
| 14 | **Phân quyền chỉ có hai vai trò** (`MEMBER`, `ADMIN`). Không có nhân viên rạp, quản lý theo rạp. | Mọi quản trị viên thao tác được trên toàn bộ chuỗi rạp. |
