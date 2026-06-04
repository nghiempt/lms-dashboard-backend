# LMS Dashboard — Backend

Backend cho hệ thống LMS (Learning Management System) với 2 role **Admin** và **Học viên**.

> **Stack:** NestJS 10 · TypeScript (strict) · Prisma · PostgreSQL · MinIO/S3 · Bunny Stream · SePay · JWT · Pino.

---

## 1. Kiến trúc

```
src/
├── config/                # đọc & type-hoá biến môi trường
├── prisma/                # PrismaService (global)
├── common/                # interceptor, filter, guard, decorator, dto chung
│   ├── interceptors/      # ResponseInterceptor — format { success, data, meta, error }
│   ├── filters/           # AllExceptionsFilter — chuẩn hoá lỗi
│   ├── guards/            # JwtAuthGuard (global) + RolesGuard (role + permission)
│   ├── decorators/        # @Public, @Roles, @RequirePermissions, @CurrentUser
│   └── dto/               # PaginationQueryDto + helper paginate()
├── integrations/          # service tích hợp bên thứ 3 (global module)
│   ├── mail/              # SMTP (nodemailer)
│   ├── storage/           # MinIO/S3 (presigned URL)
│   └── bunny/             # Bunny Stream (signed URL + watermark)
└── modules/               # mỗi feature 1 module (Controller → Service → Prisma)
    ├── auth/ users/ admins/ devices/
    ├── courses/ progress/
    ├── orders/ payments/ stats/
    ├── media/ access-logs/
    └── content/ menus/ documents/ notifications/ community/ settings/
```

Mỗi module = 1 feature hoàn chỉnh. **Business logic ở Service**, Controller chỉ định tuyến + guard, Prisma xử lý DB.

---

## 2. Chạy dự án

```bash
# 1. cài dependencies
npm install

# 2. điền biến môi trường (DB & MinIO đã host sẵn — chỉ cần điền host/key)
cp .env.example .env   # rồi sửa giá trị

# 3. tạo schema trên DB (lần đầu) + generate client
npm run prisma:generate
npm run prisma:migrate     # tạo migration & áp lên DB
#   hoặc khi DB đã có sẵn cấu trúc: npx prisma db push

# 4. seed dữ liệu mẫu (admin + học viên + khoá học demo)
npm run db:seed

# 5. chạy
npm run start:dev          # http://localhost:3001/api/v1
```

- Swagger UI: `http://localhost:3001/api/docs`
- Tài khoản seed: `admin@admin.com / admin123` · `student@lms.com / student123`

---

## 3. Biến môi trường

Xem `.env.example`. Các nhóm cần điền **giá trị thật** (DB/MinIO đã host, các dịch vụ còn lại bạn fill key sau):

| Nhóm | Biến chính | Ghi chú |
|------|-----------|---------|
| Database | `DATABASE_URL` | PostgreSQL đã host |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_MAIL_SECRET` | bí mật ngẫu nhiên |
| Device | `MAX_DEVICES_PER_USER` | mặc định 2 |
| Email | `MAIL_*` | SMTP gửi mail |
| Google | `GOOGLE_CLIENT_ID/SECRET` | đăng nhập Google |
| MinIO | `S3_*` | đã host |
| Bunny | `BUNNY_STREAM_*`, `BUNNY_TOKEN_AUTH_KEY` | video |
| SePay | `SEPAY_*` | thanh toán + webhook |
| GA | `GA_*` | thống kê |

---

## 4. Quy ước API

- **Prefix & version:** mọi endpoint dưới `/api/v1`.
- **Auth:** `Authorization: Bearer <accessToken>`. Endpoint `@Public()` không cần token.
- **Response thống nhất:**

```json
{ "success": true, "data": {}, "meta": null, "error": null }
```

Lỗi:

```json
{ "success": false, "data": null, "meta": null,
  "error": { "code": "NOT_FOUND", "message": "...", "details": null } }
```

- **Pagination:** `?page=1&limit=20&search=&sortBy=createdAt&sortOrder=desc`. `meta` chứa `{ page, limit, total, totalPages, hasNext, hasPrev }`.

> 📄 Chi tiết toàn bộ endpoint & cách FE ráp vào từng tab: **[docs/API_INTEGRATION.md](docs/API_INTEGRATION.md)**
> 📄 Sơ đồ ERD & mô tả bảng: **[docs/ERD.md](docs/ERD.md)**

---

## 5. Tích hợp bên thứ 3 (tóm tắt)

- **Email:** verify tài khoản, reset mật khẩu, email khi thanh toán thành công.
- **MinIO:** FE xin presigned URL (`POST /media/presign`) → PUT thẳng lên bucket → xác nhận (`POST /media/confirm`).
- **Bunny:** khi học viên mở bài học (`GET /courses/lessons/:id/play`) server trả `embedUrl` có **token hết hạn + watermark email** → chống chia sẻ. Mỗi lần phát ghi `VideoAccessLog`.
- **SePay:** `POST /payments/orders/:id/checkout` trả QR + thông tin CK. SePay gọi webhook `POST /payments/sepay/webhook` → server đối soát theo mã đơn `INV-xxxxxx` → fulfill (tạo enrollment) → gửi mail.
- **Google Analytics:** trả `measurementId` trong `GET /stats/overview` & `GET /settings/public` để FE nhúng.
