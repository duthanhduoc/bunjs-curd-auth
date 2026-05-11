import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import { HTTPException } from 'hono/http-exception'
import auth from './routes/auth'
import products from './routes/products'

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', logger())

// Serve uploaded images as static files
app.use('/uploads/*', serveStatic({ root: './' }))

// Health check
app.get('/', (c) =>
  c.json({ message: 'Bun API is running!', version: '1.0.0' })
)

// Routes
app.route('/api/auth', auth)
app.route('/api/products', products)

// 404 handler
app.notFound((c) => c.json({ error: 'Route not found' }, 404))

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  console.error('[Error]', err.message)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(Bun.env.PORT ?? 3000)
console.log(`🚀 Server running at http://localhost:${port}`)

export default { port, fetch: app.fetch }
