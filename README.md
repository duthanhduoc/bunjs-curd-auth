# Bun RESTful API

API RESTful xây dựng bằng **Bun.js** + **Hono** + **SQLite**.

## Prompt Postman AI

Tạo cho tôi 1 Collection có tên là "Bun api react 2026" và 1 environment có tên là "Bun api react 2026" theo các api endpoint ở trong Document dưới đây

Yêu cầu:

- Environment cung cấp đầy đủ các biến cần thiết để thực hiện các API endpoint một cách thuận tiện
- Login và refresh token thì access token và refresh token tự động lưu vào trong environment
- Logout thì tự động xóa refresh token và access token ra khỏi environment
- Các API cần Authorization thì nên mặc định là "Inherit auth from parent" để dễ dàng quản lý token

## Yêu cầu

- [Bun](https://bun.sh) >= 1.0

## Cài đặt & chạy

```bash
# Cài dependencies
bun install

# Seed dữ liệu mẫu (tạo user admin + sản phẩm demo)
bun run seed

# Chạy server dev (tự reload khi có thay đổi)
bun run dev

# Chạy production
bun run start

# Reset + seed lại trong một lệnh
bun run reset:seed
```

Server chạy tại `http://localhost:3000`

---

## Cấu trúc thư mục

```
bun-api/
├── .env                  # Biến môi trường
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Entry point
    ├── db/
    │   ├── database.ts   # Khởi tạo SQLite
    │   ├── seed.ts       # Dữ liệu mẫu
    │   └── reset.ts      # Reset database
    ├── routes/
    │   ├── auth.ts       # Auth (login, logout, refresh, me)
    │   └── products.ts   # CRUD sản phẩm
    └── types/
        └── index.ts      # TypeScript interfaces
```

## Tài khoản mặc định

| Username | Password |
| -------- | -------- |
| admin    | admin123 |

---

## API Endpoints

Base URL: `http://localhost:3000`

Các endpoint có 🔒 yêu cầu header:

```
Authorization: Bearer <accessToken>
```

---

### POST `/api/auth/login`

Đăng nhập, nhận về cặp access token và refresh token.

**Request body**

```json
{
  "username": "admin",
  "password": "admin123"
}
```

| Field      | Type   | Bắt buộc | Mô tả         |
| ---------- | ------ | -------- | ------------- |
| `username` | string | ✅       | Tên đăng nhập |
| `password` | string | ✅       | Mật khẩu      |

**Response `200`**

```json
{
  "message": "Login successful",
  "accessToken": "<jwt>",
  "refreshToken": "<random_string>",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

**Response lỗi**

| Status | Body                                                     | Nguyên nhân                |
| ------ | -------------------------------------------------------- | -------------------------- |
| `422`  | `{ "errors": { "username": "...", "password": "..." } }` | Thiếu hoặc rỗng các field  |
| `401`  | `{ "error": "Invalid credentials" }`                     | Sai username hoặc password |

---

### POST `/api/auth/refresh`

Dùng refresh token để lấy cặp token mới (rotation — token cũ bị vô hiệu hóa ngay).

**Request body**

```json
{
  "refreshToken": "<refresh_token>"
}
```

**Response `200`**

```json
{
  "message": "Token refreshed successfully",
  "accessToken": "<jwt_mới>",
  "refreshToken": "<refresh_token_mới>"
}
```

**Response lỗi**

| Status | Body                                            | Nguyên nhân                                 |
| ------ | ----------------------------------------------- | ------------------------------------------- |
| `400`  | `{ "error": "Refresh token is required" }`      | Thiếu refreshToken trong body               |
| `401`  | `{ "error": "Invalid refresh token" }`          | Token không tồn tại                         |
| `401`  | `{ "error": "Refresh token has been revoked" }` | Token đã bị thu hồi (logout hoặc đã rotate) |
| `401`  | `{ "error": "Refresh token has expired" }`      | Token hết hạn (sau 7 ngày)                  |

---

### POST `/api/auth/logout`

Đăng xuất, vô hiệu hóa refresh token.

**Request body**

```json
{
  "refreshToken": "<refresh_token>"
}
```

| Field          | Type   | Bắt buộc | Mô tả                                      |
| -------------- | ------ | -------- | ------------------------------------------ |
| `refreshToken` | string | ❌       | Nếu gửi kèm thì refresh token sẽ bị revoke |

**Response `200`**

```json
{
  "message": "Logout successful"
}
```

---

### GET `/api/auth/me` 🔒

Lấy thông tin user đang đăng nhập.

**Response `200`**

```json
{
  "data": {
    "id": 1,
    "username": "admin",
    "created_at": "2026-05-11T06:13:18Z"
  }
}
```

---

### GET `/api/products` 🔒

Lấy danh sách sản phẩm với phân trang, tìm kiếm và sắp xếp.

**Query parameters**

| Param     | Type    | Mặc định     | Mô tả                                                |
| --------- | ------- | ------------ | ---------------------------------------------------- |
| `page`    | integer | `1`          | Trang hiện tại                                       |
| `limit`   | integer | `10`         | Số sản phẩm mỗi trang (tối đa 100)                   |
| `search`  | string  | _(trống)_    | Tìm kiếm theo tên sản phẩm (LIKE)                    |
| `sort_by` | string  | `created_at` | Sắp xếp theo: `name`, `price`, `stock`, `created_at` |
| `order`   | string  | `desc`       | Chiều sắp xếp: `asc`, `desc`                         |

**Ví dụ**

```
GET /api/products?page=2&limit=20&search=laptop&sort_by=price&order=asc
```

**Response `200`**

```json
{
  "data": [
    {
      "id": 1,
      "name": "Laptop Dell XPS 15",
      "description": "Laptop hiệu năng cao, màn hình 15.6 inch OLED",
      "price": 1299.99,
      "stock": 10,
      "image": "https://picsum.photos/seed/abc123/400/400",
      "created_at": "2025-03-15T08:22:10Z",
      "updated_at": "2026-01-04T14:55:43Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### GET `/api/products/:id` 🔒

Lấy chi tiết một sản phẩm theo ID.

**Response `200`**

```json
{
  "data": {
    "id": 1,
    "name": "Laptop Dell XPS 15",
    "description": "Laptop hiệu năng cao, màn hình 15.6 inch OLED",
    "price": 1299.99,
    "stock": 10,
    "image": "https://picsum.photos/seed/abc123/400/400",
    "created_at": "2025-03-15T08:22:10Z",
    "updated_at": "2026-01-04T14:55:43Z"
  }
}
```

**Response lỗi**

| Status | Body                                | Nguyên nhân      |
| ------ | ----------------------------------- | ---------------- |
| `400`  | `{ "error": "Invalid product ID" }` | ID không phải số |
| `404`  | `{ "error": "Product not found" }`  | Không tìm thấy   |

---

### POST `/api/products` 🔒

Thêm sản phẩm mới.

**Request body**

```json
{
  "name": "iPhone 15 Pro",
  "description": "Smartphone Apple mới nhất",
  "price": 999.99,
  "stock": 25
}
```

| Field         | Type    | Bắt buộc | Mô tả                          |
| ------------- | ------- | -------- | ------------------------------ |
| `name`        | string  | ✅       | Tên sản phẩm                   |
| `price`       | number  | ✅       | Giá (>= 0)                     |
| `description` | string  | ❌       | Mô tả sản phẩm                 |
| `stock`       | integer | ❌       | Số lượng tồn kho (mặc định: 0) |

**Response `201`**

```json
{
  "message": "Product created",
  "data": {
    "id": 6,
    "name": "iPhone 15 Pro",
    "description": "Smartphone Apple mới nhất",
    "price": 999.99,
    "stock": 25,
    "image": null,
    "created_at": "2026-05-11T07:00:00Z",
    "updated_at": "2026-05-11T07:00:00Z"
  }
}
```

**Response lỗi**

| Status | Body                                                              | Nguyên nhân        |
| ------ | ----------------------------------------------------------------- | ------------------ |
| `422`  | `{ "errors": { "name": "...", "price": "...", "stock": "..." } }` | Field không hợp lệ |

---

### PUT `/api/products/:id` 🔒

Cập nhật thông tin sản phẩm. Chỉ cần gửi các field muốn thay đổi.

**Request body** (tất cả đều tùy chọn)

```json
{
  "name": "Tên mới",
  "description": "Mô tả mới",
  "price": 899.99,
  "stock": 30
}
```

**Response `200`**

```json
{
  "message": "Product updated",
  "data": {
    "id": 1,
    "name": "Tên mới",
    "description": "Mô tả mới",
    "price": 899.99,
    "stock": 30,
    "image": "https://picsum.photos/seed/abc123/400/400",
    "created_at": "2025-03-15T08:22:10Z",
    "updated_at": "2026-05-11T07:10:00Z"
  }
}
```

**Response lỗi**

| Status | Body                                                              | Nguyên nhân        |
| ------ | ----------------------------------------------------------------- | ------------------ |
| `400`  | `{ "error": "Invalid product ID" }`                               | ID không phải số   |
| `404`  | `{ "error": "Product not found" }`                                | Không tìm thấy     |
| `422`  | `{ "errors": { "name": "...", "price": "...", "stock": "..." } }` | Field không hợp lệ |

---

### POST `/api/products/:id/image` 🔒

Upload hình ảnh cho sản phẩm. Dùng `multipart/form-data`.

**Request**

- Content-Type: `multipart/form-data`
- Form field: `image` — file ảnh (jpeg, png, webp, gif, tối đa 5 MB)

**Response `200`**

```json
{
  "message": "Image uploaded successfully",
  "data": {
    "id": 1,
    "name": "Laptop Dell XPS 15",
    "description": "Laptop hiệu năng cao, màn hình 15.6 inch OLED",
    "price": 1299.99,
    "stock": 10,
    "image": "/uploads/1-1747000000000.jpg",
    "created_at": "2025-03-15T08:22:10Z",
    "updated_at": "2026-05-11T07:10:00Z"
  }
}
```

**Response lỗi**

| Status | Body                                                              | Nguyên nhân                 |
| ------ | ----------------------------------------------------------------- | --------------------------- |
| `400`  | `{ "error": "Invalid product ID" }`                               | ID không phải số            |
| `400`  | `{ "error": "No image file provided" }`                           | Không có file trong request |
| `400`  | `{ "error": "Invalid file type. Allowed: jpeg, png, webp, gif" }` | Sai định dạng file          |
| `400`  | `{ "error": "File too large. Maximum size is 5MB" }`              | File vượt quá 5 MB          |
| `404`  | `{ "error": "Product not found" }`                                | Không tìm thấy sản phẩm     |

> File ảnh được lưu tại thư mục `uploads/` và truy cập qua URL `/uploads/<filename>`.

---

### DELETE `/api/products/:id` 🔒

Xóa sản phẩm theo ID.

**Response `200`**

```json
{
  "message": "Product deleted successfully"
}
```

**Response lỗi**

| Status | Body                                | Nguyên nhân      |
| ------ | ----------------------------------- | ---------------- |
| `400`  | `{ "error": "Invalid product ID" }` | ID không phải số |
| `404`  | `{ "error": "Product not found" }`  | Không tìm thấy   |
