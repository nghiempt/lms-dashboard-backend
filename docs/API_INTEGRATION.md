# API Integration Guide — cho Frontend

> Base URL: `http://<host>:3001/api/v1`
> Auth header: `Authorization: Bearer <accessToken>` (trừ endpoint ghi 🌐 Public).
> Mọi response bọc trong `{ success, data, meta, error }` — FE đọc `data` (và `meta` cho list phân trang).

Mục lục:
1. [Quy ước chung](#1-quy-ước-chung)
2. [Auth — Đăng nhập / Đăng ký](#2-auth)
3. [Mapping theo 7 tab của Học viên](#3-mapping-theo-tab-học-viên)
4. [Tham chiếu đầy đủ endpoint (Admin + Student)](#4-tham-chiếu-đầy-đủ)

---

## 1. Quy ước chung

### Response thành công
```json
{ "success": true, "data": { ... }, "meta": null, "error": null }
```
### Response list (phân trang)
```json
{ "success": true, "data": [ ... ],
  "meta": { "page":1, "limit":20, "total":42, "totalPages":3, "hasNext":true, "hasPrev":false },
  "error": null }
```
### Response lỗi
```json
{ "success": false, "data": null, "meta": null,
  "error": { "code":"UNAUTHORIZED", "message":"...", "details": null } }
```

### Luồng token
- Login/Register/Google → trả `{ user, accessToken, refreshToken, expiresIn }`.
- Access token hết hạn → gọi `POST /auth/refresh` với `refreshToken` để lấy cặp mới (token cũ bị xoay vòng).
- Logout → `POST /auth/logout` (thu hồi refresh token).

### Thiết bị (giới hạn 2)
FE sinh 1 `deviceId` ổn định (vd. fingerprint/uuid lưu localStorage) và gửi kèm khi `register/login/google`. Nếu vượt quá 2 thiết bị → lỗi `403` với message gợi ý gỡ bớt; FE gọi `GET /devices/me` để hiển thị & `DELETE /devices/me/:id` để gỡ.

---

## 2. Auth

| Màn hình | Method | Endpoint | Body | Trả về |
|---|---|---|---|---|
| Đăng ký | 🌐 POST | `/auth/register` | `{ fullName, email, password, deviceId, deviceName? }` | `{ user, accessToken, refreshToken }` + gửi mail verify |
| Đăng nhập | 🌐 POST | `/auth/login` | `{ email, password, deviceId, deviceName? }` | `{ user, device, accessToken, refreshToken }` |
| Google | 🌐 POST | `/auth/google` | `{ idToken, deviceId }` | như login |
| Quên mật khẩu | 🌐 POST | `/auth/forgot-password` | `{ email }` | message (luôn 200) |
| Đặt lại mật khẩu | 🌐 POST | `/auth/reset-password` | `{ token, newPassword }` | message |
| Xác thực email | 🌐 POST | `/auth/verify-email` | `{ token }` | message |
| Gửi lại verify | 🌐 POST | `/auth/resend-verify` | `{ email }` | message |
| Refresh | 🌐 POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| Đăng xuất | POST | `/auth/logout` | `{ refreshToken }` | message |
| Thông tin tôi | GET | `/auth/me` | — | user |
| Đổi mật khẩu | POST | `/auth/change-password` | `{ currentPassword, newPassword }` | message |

`user` object: `{ id, email, fullName, phone, avatarUrl, bio, role, status, notifyEmail, notifyStudyReminder, notifyCommunity, ... }`.

---

## 3. Mapping theo tab (Học viên)

### 🏠 Tab "Tổng quan" (Dashboard — `/`)
| Phần UI | Endpoint |
|---|---|
| 5 thẻ stats (khóa đã mua, tổng giờ, video đã xem, còn lại, % hoàn thành) | `GET /my/dashboard` → `coursesBought, totalHours, videosWatched, videosRemaining, completionRate` |
| Biểu đồ "Giờ học 7 ngày" | `GET /my/study-stats?days=7` → `data:[{date,hours}], totalHours` |
| Donut "Tỷ lệ hoàn thành" | `GET /my/dashboard` → `completionRate` (+ `videosWatched`/tổng) |
| Bảng "Khóa học của tôi" | `GET /my/dashboard` → `courses[]` (hoặc `GET /my/courses`) |

### 📚 Tab "Khóa học của tôi" (`/courses`)
| Phần UI | Endpoint |
|---|---|
| Danh sách card khoá đã đăng ký + filter trạng thái | `GET /my/courses?status=LEARNING\|COMPLETED\|EXPIRED` |
| Bấm "Tiếp tục học" → chi tiết khoá (chương/bài + trạng thái khoá) | `GET /courses/:id/detail` |
| Phát 1 bài học (video signed URL + watermark) | `GET /courses/lessons/:lessonId/play` |
| Cập nhật tiến độ khi xem | `POST /my/progress` `{ lessonId, watchedSec, lastPositionSec, status? }` |
| Ghi giờ học | `POST /my/study-session` `{ lessonId?, durationSec }` |
| (mua thêm khoá) catalog | 🌐 `GET /courses/catalog` |

`GET /courses/:id/detail` trả `chapters[].lessons[]` với `{ locked, isPreview, progress:{status,watchedSec,lastPositionSec} }`. FE chỉ cho bấm khi `locked=false`.

`GET /courses/lessons/:id/play` trả:
```json
{ "id","title","type","video": {
    "embedUrl":"https://iframe.mediadelivery.net/embed/...?token=...&expires=...&watermark=email",
    "hlsUrl":"...", "thumbnailUrl":"...", "expiresAt":"...", "watermark":"student@email" },
  "attachments":[{ "id","title","url" }] }
```
> Nhúng `video.embedUrl` vào iframe. URL tự hết hạn theo `expiresAt`.

### 📈 Tab "Tiến độ học" (`/progress`)
| Phần UI | Endpoint |
|---|---|
| Thẻ "Chuỗi học liên tục" | `GET /my/study-stats` → `streak` |
| "Bài giảng đã xem" / "Giờ học tuần" | `GET /my/dashboard` + `GET /my/study-stats` |
| Biểu đồ giờ học 7 ngày | `GET /my/study-stats?days=7` |
| Tiến độ theo khóa (progress bar) | `GET /my/courses` → mỗi item có `progressPct` |

### 💳 Tab "Thanh toán" (`/payment`)
| Phần UI | Endpoint |
|---|---|
| 3 thẻ (tổng đã thanh toán, khóa sở hữu, hóa đơn chờ) | `GET /orders/my/summary` |
| Lịch sử hóa đơn | `GET /orders/my?status=&page=` → mỗi order có `code, total, status, items[], payments[]` |
| Chi tiết 1 hóa đơn | `GET /orders/my/:id` |
| Tạo đơn mua khoá | `POST /orders` `{ courseIds:[], note? }` |
| Lấy QR/thông tin chuyển khoản | `POST /payments/orders/:orderId/checkout` → `{ qrUrl, bank, transferContent, amount }` |
| Huỷ đơn chờ | `PATCH /orders/my/:id/cancel` |

> Sau khi học viên CK, **SePay tự gọi webhook** → đơn chuyển `PAID`, tạo enrollment, gửi mail. FE chỉ cần poll `GET /orders/my/:id` để cập nhật trạng thái.

### 👥 Tab "Cộng đồng" (`/community`)
| Phần UI | Endpoint |
|---|---|
| Các nhóm cộng đồng | 🌐 `GET /community/groups` |
| Bài viết nổi bật | 🌐 `GET /community/posts?featured=true` |

### 🔔 Tab "Thông báo" (`/notifications` + chuông topbar)
| Phần UI | Endpoint |
|---|---|
| Danh sách (Hôm nay/Trước đó) + badge số mới | `GET /notifications/me?unread=` → `meta.unreadCount` |
| Đánh dấu 1 đã đọc | `PATCH /notifications/me/:id/read` |
| Đánh dấu tất cả đã đọc | `PATCH /notifications/me/read-all` |

### ⚙️ Tab "Cài đặt" (`/settings`)
| Phần UI | Endpoint |
|---|---|
| Hồ sơ cá nhân (load) | `GET /users/me` |
| Lưu hồ sơ (tên, sđt, bio, avatar) | `PATCH /users/me` `{ fullName?, phone?, bio?, avatarUrl? }` |
| Đổi ảnh đại diện | `POST /media/presign` → PUT lên MinIO → `POST /media/confirm` → lấy `url` → `PATCH /users/me {avatarUrl}` |
| Đổi mật khẩu | `POST /auth/change-password` `{ currentPassword, newPassword }` |
| Toggle thông báo (3 switch) | `PATCH /users/me/notifications` `{ notifyEmail?, notifyStudyReminder?, notifyCommunity? }` |
| Quản lý thiết bị đăng nhập | `GET /devices/me`, `DELETE /devices/me/:id` |

#### Luồng upload avatar (MinIO)
```
1) POST /media/presign { fileName, contentType:"image/png", folder:"avatars" }
   → { uploadUrl, objectKey, publicUrl }
2) PUT <uploadUrl>  (body = file, header Content-Type giống bước 1)   // gọi thẳng MinIO
3) POST /media/confirm { objectKey, fileName, type:"IMAGE", folder:"avatars" } → media
4) PATCH /users/me { avatarUrl: media.url }
```
> Hoặc đơn giản hơn: `POST /media/upload` (multipart, field `file`) — server tự upload, trả luôn `{ url }`.

---

## 3B. Mapping theo trang Admin

> Tất cả route admin cần token có `role=ADMIN`.

### 🏠 `/admin` — Tổng quan
| Phần UI | Endpoint |
|---|---|
| 4 thẻ (doanh thu tháng, tổng học viên, đơn mới, số khóa) | `GET /stats/overview` → `revenueThisMonth, students, newOrdersThisMonth, courses` |
| Biểu đồ doanh thu 6 tháng | `GET /stats/revenue?months=6` → `data:[{month,revenue,count}]` |
| Khóa bán chạy | `GET /stats/top-courses?limit=5` → `[{title,revenue,sales,studentsCount}]` |
| Đơn hàng gần đây | `GET /orders?limit=5` → mỗi đơn có `user`, `items`, `status` |

### 📚 `/admin/courses` — Quản lý khóa học
| Phần UI | Endpoint |
|---|---|
| Bảng khóa (giá, học viên, doanh thu, trạng thái, "6 chương · 27 bài") | `GET /courses?page=` → mỗi item: `chapterCount, lessonCount, studentsCount, revenue, price, status` |
| Thêm khóa (modal) | `POST /courses` `{ title, price, status, description }` |
| Sửa / Xóa | `PATCH /courses/:id` · `DELETE /courses/:id` · publish: `PATCH /courses/:id/publish {publish:true}` |

### ✏️ `/admin/courses/edit` — Chương & bài học
| Phần UI | Endpoint |
|---|---|
| Tải cấu trúc khóa (chương + bài) | `GET /courses/:id` (admin, full tree) |
| Thêm/sửa/xóa chương | `POST /courses/:courseId/chapters` · `PATCH /courses/chapters/:id` · `DELETE /courses/chapters/:id` |
| Thêm/sửa/xóa bài học | `POST /courses/chapters/:chapterId/lessons` · `PATCH /courses/lessons/:id` · `DELETE /courses/lessons/:id` |
| Sắp xếp lại | `PATCH /courses/:courseId/chapters/reorder` · `PATCH /courses/chapters/:chapterId/lessons/reorder` `{ ids:[] }` |

Field bài học khớp UI: `videoSource` (`BUNNY`\|`YOUTUBE`), `bunnyVideoId` hoặc `videoUrl` (YouTube), `level` (`BASIC`=Cơ bản\|`ADVANCED`=Nâng cao), `isPreview` (Miễn phí↔true / Có phí↔false), `isLocked` (Khóa↔true / Mở khóa↔false).
> Upload video Bunny: `POST /courses/lessons/:id/video` → trả `uploadUrl + apiKey + videoId` để FE upload file lên Bunny.

### 👥 `/admin/students` — Quản lý học viên
| Phần UI | Endpoint |
|---|---|
| Bảng (số khóa, tiến độ, ngày tham gia, trạng thái) | `GET /users/students?page=&status=&search=` → mỗi item: `courseCount, avgProgress, totalSpent, status, createdAt` |
| Drawer chi tiết (khóa đã mua, tổng chi tiêu) | `GET /users/students/:id` → `courses[], totalSpent, devices[]` |
| Lưu (tên/email/trạng thái) | `PATCH /users/students/:id` `{ fullName?, email?, status? }` |
| Khóa / Mở khóa nhanh | `PATCH /users/students/:id/lock` · `/unlock` |
| Xóa | `DELETE /users/students/:id` |
| Thiết bị của học viên (gỡ) | `GET /devices/admin?userId=` · `DELETE /devices/admin/:id` |

### 🛒 `/admin/orders` — Đơn hàng & thanh toán
| Phần UI | Endpoint |
|---|---|
| 4 thẻ (tổng DT, đơn thành công, chờ xử lý, hoàn tiền) | `GET /orders/summary` → `totalRevenue, successCount, pendingCount, refundCount` |
| Bảng đơn hàng | `GET /orders?status=&page=` |
| Xác nhận CK thủ công | `PATCH /orders/:id/confirm` |
| Hoàn tiền | `PATCH /orders/:id/refund` |

### 📁 `/admin/resources` — Kho tài liệu
| Phần UI | Endpoint |
|---|---|
| Bảng tài liệu (tên, loại, dung lượng, thuộc khóa, lượt tải) | `GET /documents/admin?page=` → `fileType, sizeBytes, course, downloadCount` |
| Upload file → tạo tài liệu | `POST /media/presign` → PUT MinIO → `POST /media/confirm` → `POST /documents` `{ title, kind, mediaId, fileType, sizeBytes, courseId? }` |
| Xóa | `DELETE /documents/:id` |

### 📣 `/admin/announcements` + `/admin/notifications` — Thông báo
| Phần UI | Endpoint |
|---|---|
| Tạo & gửi (Tất cả / theo khóa) | `POST /notifications/send` `{ title, body, scope:"ALL"\|"COURSE"\|"USER", courseId?, userIds?, asDraft? }` |
| Lưu nháp | như trên với `asDraft:true` (status=DRAFT) |
| Bảng thông báo đã tạo (tiêu đề, đối tượng, ngày, trạng thái) | `GET /notifications/admin?page=` → `status, scope, _count.recipients, sentAt` |
| Sửa nháp | `PATCH /notifications/admin/:id` |
| Gửi 1 nháp | `POST /notifications/admin/:id/send` |
| Xóa | `DELETE /notifications/admin/:id` |

### 📊 `/admin/activity` — Nhật ký hoạt động
| Phần UI | Endpoint |
|---|---|
| Bảng (tài khoản, thời gian, hành động, IP, thiết bị) | `GET /activity?page=&userId=&type=` → `user, action, type, ipAddress, deviceLabel, createdAt` |
| Nhật ký xem video riêng (watermark, chống share) | `GET /access-logs` · `GET /access-logs/suspicious` |

Hệ thống tự ghi activity khi: `LOGIN` (đăng nhập), `PURCHASE` (mua khóa), `VIEW_LESSON` (xem bài).

### ⚙️ `/admin/settings` — Cài đặt
| Phần UI | Endpoint |
|---|---|
| Hồ sơ admin (tên/email/avatar) | `GET /users/me` · `PATCH /users/me` |
| Đổi mật khẩu | `POST /auth/change-password` |
| Thông tin website (tên, email, hotline, social) | `GET /settings?group=` · `POST /settings` `{ items:[{key,value,group}] }` |
| Toggle cổng thanh toán / thông báo | lưu qua `POST /settings` (key-value, vd. `payment.vnpay=true`) |

---

## 4. Tham chiếu đầy đủ

> 🌐 = Public (không cần token). 🔒A = chỉ Admin.

### Auth — `/auth`
| Method | Path |
|---|---|
| 🌐 POST | `/auth/register`, `/auth/login`, `/auth/google` |
| 🌐 POST | `/auth/verify-email`, `/auth/resend-verify`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh` |
| POST | `/auth/logout`, `/auth/change-password` · GET `/auth/me` |

### Users — `/users`
| Method | Path | Quyền |
|---|---|---|
| GET | `/users/me` | student |
| PATCH | `/users/me` · `/users/me/notifications` | student |
| GET | `/users/students` (list, filter `status`, search) | 🔒A |
| GET | `/users/students/:id` | 🔒A |
| POST | `/users/students` | 🔒A |
| PATCH | `/users/students/:id` | 🔒A |
| PATCH | `/users/students/:id/lock` · `/unlock` | 🔒A |
| DELETE | `/users/students/:id` | 🔒A |

### Admins & RBAC — `/admins` (🔒A)
`GET /admins` · `POST /admins` · `PATCH /admins/:id/roles` ·
`GET /admins/roles/all` · `POST /admins/roles` · `PATCH /admins/roles/:id` · `DELETE /admins/roles/:id` ·
`GET /admins/permissions/all`

### Devices — `/devices`
`GET /devices/me` · `DELETE /devices/me/:id` · 🔒A `GET /devices/admin?userId=` · 🔒A `DELETE /devices/admin/:id`

### Courses — `/courses`
| Method | Path | Quyền |
|---|---|---|
| 🌐 GET | `/courses/catalog` | public |
| GET | `/courses/:id/detail` | student |
| GET | `/courses/lessons/:lessonId/play` | student |
| GET | `/courses` (admin list) · `/courses/:id` (full tree) | 🔒A |
| POST | `/courses` · PATCH `/courses/:id` · PATCH `/courses/:id/publish` · DELETE `/courses/:id` | 🔒A |
| POST | `/courses/:courseId/chapters` · PATCH `/courses/chapters/:id` · DELETE `/courses/chapters/:id` | 🔒A |
| PATCH | `/courses/:courseId/chapters/reorder` `{ ids:[] }` | 🔒A |
| POST | `/courses/chapters/:chapterId/lessons` · PATCH `/courses/lessons/:id` · DELETE `/courses/lessons/:id` | 🔒A |
| PATCH | `/courses/chapters/:chapterId/lessons/reorder` | 🔒A |
| POST | `/courses/lessons/:id/video` (tạo video Bunny để upload) | 🔒A |
| POST | `/courses/lessons/:id/access` `{ userId, unlocked }` (mở/khoá riêng) | 🔒A |

### Progress / Learning (student)
`GET /my/courses?status=` · `GET /my/dashboard` · `GET /my/study-stats?days=7` ·
`POST /my/progress` · `POST /my/study-session`

### Orders — `/orders`
| Method | Path | Quyền |
|---|---|---|
| POST | `/orders` `{ courseIds, note? }` | student |
| GET | `/orders/my` · `/orders/my/summary` · `/orders/my/:id` | student |
| PATCH | `/orders/my/:id/cancel` | student |
| GET | `/orders` (list all) | 🔒A |
| PATCH | `/orders/:id/confirm` (xác nhận CK thủ công) | 🔒A |

### Payments — `/payments`
`POST /payments/orders/:orderId/checkout` (student) · 🌐 `POST /payments/sepay/webhook` (SePay gọi)

### Stats — `/stats` (🔒A)
`GET /stats/overview` · `/stats/revenue?months=12` · `/stats/top-courses?limit=5` · `/stats/student-growth?months=12`

### Media — `/media`
`POST /media/presign` · `POST /media/confirm` · `POST /media/upload` (multipart) · 🔒A `GET /media` · 🔒A `DELETE /media/:id`

### Access Logs — `/access-logs` (🔒A)
`GET /access-logs?userId=&lessonId=` · `GET /access-logs/suspicious?hours=24&threshold=3`

### Content — articles & landing
🌐 `GET /articles` · 🌐 `GET /articles/:slug` · 🌐 `GET /landing` ·
🔒A `GET /admin/articles` · `POST /admin/articles` · `PATCH /admin/articles/:id` · `DELETE /admin/articles/:id` ·
🔒A `GET /admin/landing` · `POST /admin/landing` · `DELETE /admin/landing/:key`

### Menus — `/menus`
🌐 `GET /menus?location=header` (cây) · 🔒A `GET /menus/all` · `POST /menus` · `PATCH /menus/reorder` · `PATCH /menus/:id` · `DELETE /menus/:id`

### Documents — `/documents`
`GET /documents` (student, public docs) · 🔒A `GET /documents/admin` · `POST /documents` · `PATCH /documents/:id` · `DELETE /documents/:id`

### Notifications — `/notifications`
`GET /notifications/me?unread=` · `PATCH /notifications/me/:id/read` · `PATCH /notifications/me/read-all` · 🔒A `POST /notifications/send` `{ title, body, scope:ALL\|USER, userIds?, type?, link? }`

### Community — `/community`
🌐 `GET /community/groups` · 🌐 `GET /community/posts?featured=` ·
🔒A `POST/PATCH/DELETE /community/groups[/:id]` · 🔒A `POST/PATCH/DELETE /community/posts[/:id]`

### Settings — `/settings`
🌐 `GET /settings/public` · 🔒A `GET /settings?group=` · 🔒A `POST /settings` `{ items:[{key,value,group,type,label}] }`

---

## 5. Gợi ý đổi FE từ mock sang API thật

Trong `lib/auth.ts` hiện đang fake. Khi ráp API:
1. `verifyCredentials()` → gọi `POST /auth/login`, lưu `accessToken`/`refreshToken`.
2. `getCurrentUser()` → đọc từ `GET /auth/me` (hoặc cache user trả về lúc login).
3. Tạo 1 `apiClient` (fetch wrapper) tự gắn `Authorization` và tự `refresh` khi nhận 401.
4. Các trang `dashboard/courses/progress/payment/notifications/settings/community` thay mảng hằng (`STATS`, `COURSES`, `INVOICES`, ...) bằng dữ liệu fetch theo bảng mapping ở mục 3.
