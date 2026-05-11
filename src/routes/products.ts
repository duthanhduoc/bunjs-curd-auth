import { Hono } from 'hono'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import db from '../db/database'
import { authMiddleware } from '../middleware/auth'
import type { Product } from '../types'

const products = new Hono()

const UPLOADS_DIR = 'uploads'
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

await mkdir(UPLOADS_DIR, { recursive: true })
// Protect all product routes with JWT
products.use('*', authMiddleware)

// GET /api/products - Lấy danh sách sản phẩm (phân trang, tìm kiếm, sắp xếp)
products.get('/', (c) => {
  // --- Query params ---
  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 10)))
  const search = (c.req.query('search') ?? '').trim()

  const ALLOWED_SORT_BY = ['name', 'price', 'stock', 'created_at'] as const
  const ALLOWED_ORDER = ['asc', 'desc'] as const
  type SortBy = (typeof ALLOWED_SORT_BY)[number]
  type Order = (typeof ALLOWED_ORDER)[number]

  const sortBy: SortBy = (ALLOWED_SORT_BY as readonly string[]).includes(
    c.req.query('sort_by') ?? ''
  )
    ? (c.req.query('sort_by') as SortBy)
    : 'created_at'

  const order: Order =
    (c.req.query('order') ?? '').toLowerCase() === 'asc' ? 'asc' : 'desc'

  const offset = (page - 1) * limit
  const pattern = `%${search}%`

  // --- Queries ---
  const total = (
    db
      .query('SELECT COUNT(*) as count FROM products WHERE name LIKE ?')
      .get(pattern) as { count: number }
  ).count

  // Column and order are validated above — safe to interpolate
  const list = db
    .query(
      `SELECT * FROM products
       WHERE name LIKE ?
       ORDER BY ${sortBy} ${order}
       LIMIT ? OFFSET ?`
    )
    .all(pattern, limit, offset) as Product[]

  return c.json({
    data: list,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  })
})

// GET /api/products/:id - Xem chi tiết sản phẩm
products.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400)

  const product = db
    .query('SELECT * FROM products WHERE id = ?')
    .get(id) as Product | null
  if (!product) return c.json({ error: 'Product not found' }, 404)

  return c.json({ data: product })
})

// POST /api/products - Thêm sản phẩm
products.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    description?: string
    price: number
    stock?: number
  }>()
  const { name, description, price, stock = 0 } = body

  const errors: Record<string, string> = {}
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.name = 'Name is required'
  }
  if (price === undefined || price === null) {
    errors.price = 'Price is required'
  } else if (typeof price !== 'number' || isNaN(price)) {
    errors.price = 'Price must be a number'
  } else if (price < 0) {
    errors.price = 'Price must not be negative'
  }
  if (stock !== undefined && (typeof stock !== 'number' || isNaN(stock))) {
    errors.stock = 'Stock must be a number'
  } else if (stock < 0) {
    errors.stock = 'Stock must not be negative'
  }
  if (Object.keys(errors).length > 0) {
    return c.json({ errors }, 422)
  }

  const created = db
    .query(
      'INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?) RETURNING *'
    )
    .get(name, description ?? null, price, stock) as Product

  return c.json({ message: 'Product created', data: created }, 201)
})

// POST /api/products/:id/image - Upload ảnh sản phẩm
products.post('/:id/image', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400)

  const existing = db
    .query('SELECT id, image FROM products WHERE id = ?')
    .get(id) as Pick<Product, 'id' | 'image'> | null
  if (!existing) return c.json({ error: 'Product not found' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('image')

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Field "image" (file) is required' }, 400)
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return c.json(
      { error: 'Only JPEG, PNG, WebP, and GIF images are allowed' },
      415
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File size must not exceed 5 MB' }, 413)
  }

  // Delete old image file if exists
  if (existing.image) {
    const oldPath = existing.image.replace(/^\//, '')
    try {
      ;(await Bun.file(oldPath).exists()) && Bun.file(oldPath)
    } catch {}
    try {
      require('node:fs').unlinkSync(oldPath)
    } catch {}
  }

  const ext = extname(file.name) || '.' + file.type.split('/')[1]
  const filename = `product-${id}-${Date.now()}${ext}`
  const filepath = `${UPLOADS_DIR}/${filename}`

  await Bun.write(filepath, await file.arrayBuffer())

  const imageUrl = `/uploads/${filename}`
  const updated = db
    .query(
      "UPDATE products SET image = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ? RETURNING *"
    )
    .get(imageUrl, id) as Product

  return c.json({ message: 'Image uploaded successfully', data: updated })
})

// PUT /api/products/:id - Sửa sản phẩm
products.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400)

  const existing = db.query('SELECT id FROM products WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'Product not found' }, 404)

  const body = await c.req.json<{
    name?: string
    description?: string
    price?: number
    stock?: number
  }>()
  const { name, description, price, stock } = body

  const errors: Record<string, string> = {}
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    errors.name = 'Name must be a non-empty string'
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || isNaN(price)) {
      errors.price = 'Price must be a number'
    } else if (price < 0) {
      errors.price = 'Price must not be negative'
    }
  }
  if (stock !== undefined) {
    if (typeof stock !== 'number' || isNaN(stock)) {
      errors.stock = 'Stock must be a number'
    } else if (stock < 0) {
      errors.stock = 'Stock must not be negative'
    }
  }
  if (Object.keys(errors).length > 0) {
    return c.json({ errors }, 422)
  }

  const updated = db
    .query(
      `UPDATE products
       SET name        = COALESCE(?, name),
           description = COALESCE(?, description),
           price       = COALESCE(?, price),
           stock       = COALESCE(?, stock),
           updated_at  = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?
       RETURNING *`
    )
    .get(
      name ?? null,
      description ?? null,
      price ?? null,
      stock ?? null,
      id
    ) as Product

  return c.json({ message: 'Product updated', data: updated })
})

// DELETE /api/products/:id - Xóa sản phẩm
products.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400)

  const existing = db.query('SELECT id FROM products WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'Product not found' }, 404)

  db.query('DELETE FROM products WHERE id = ?').run(id)
  return c.json({ message: 'Product deleted successfully' })
})

export default products
