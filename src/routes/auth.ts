import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { authMiddleware } from '../middleware/auth'
import db from '../db/database'
import type { User, RefreshToken } from '../types'
import ms, { type StringValue } from 'ms'
const auth = new Hono()
const JWT_SECRET = Bun.env.JWT_SECRET ?? 'super-secret-jwt-key'

const ACCESS_TOKEN_TTL = ms(
  (Bun.env.ACCESS_TOKEN_TTL as StringValue | undefined) ?? '15m'
)
const REFRESH_TOKEN_TTL = ms((Bun.env.REFRESH_TOKEN_TTL as StringValue) ?? '7d')

function generateRefreshToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString(
    'base64url'
  )
}

async function createTokenPair(userId: number, username: string) {
  const accessToken = await sign(
    {
      userId,
      username,
      exp: Math.floor(Date.now() / 1000) + Math.floor(ACCESS_TOKEN_TTL / 1000)
    },
    JWT_SECRET
  )

  const refreshToken = generateRefreshToken()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL).toISOString()

  db.query(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(refreshToken, userId, expiresAt)

  return { accessToken, refreshToken }
}

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>()
  const { username, password } = body

  const errors: Record<string, string> = {}
  if (!username || typeof username !== 'string' || username.trim() === '') {
    errors.username = 'Username is required'
  }
  if (!password || typeof password !== 'string') {
    errors.password = 'Password is required'
  }
  if (Object.keys(errors).length > 0) {
    return c.json({ errors }, 422)
  }

  const user = db
    .query('SELECT * FROM users WHERE username = ?')
    .get(username) as User | null

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const isValid = await Bun.password.verify(password, user.password)
  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const { accessToken, refreshToken } = await createTokenPair(
    user.id,
    user.username
  )

  return c.json({
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username }
  })
})

// POST /api/auth/refresh
auth.post('/refresh', async (c) => {
  const body = await c.req.json<{ refreshToken: string }>()
  const { refreshToken } = body

  if (!refreshToken) {
    return c.json({ error: 'Refresh token is required' }, 400)
  }

  const stored = db
    .query('SELECT * FROM refresh_tokens WHERE token = ?')
    .get(refreshToken) as RefreshToken | null

  if (!stored) {
    return c.json({ error: 'Invalid refresh token' }, 401)
  }
  if (stored.revoked) {
    return c.json({ error: 'Refresh token has been revoked' }, 401)
  }
  if (new Date(stored.expires_at) < new Date()) {
    return c.json({ error: 'Refresh token has expired' }, 401)
  }

  const user = db
    .query('SELECT id, username FROM users WHERE id = ?')
    .get(stored.user_id) as Pick<User, 'id' | 'username'> | null

  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  // Rotate: revoke old token, issue new pair
  db.query('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(stored.id)

  const { accessToken, refreshToken: newRefreshToken } = await createTokenPair(
    user.id,
    user.username
  )

  return c.json({
    message: 'Token refreshed successfully',
    accessToken,
    refreshToken: newRefreshToken
  })
})

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({}))
  const { refreshToken } = body as { refreshToken?: string }

  if (refreshToken) {
    db.query('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(
      refreshToken
    )
  }

  return c.json({ message: 'Logout successful' })
})

// GET /api/auth/me  (protected)
auth.get('/me', authMiddleware, (c) => {
  const payload = c.get('jwtPayload') as { userId: number; username: string }
  const user = db
    .query('SELECT id, username, created_at FROM users WHERE id = ?')
    .get(payload.userId) as Omit<User, 'password'> | null

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({ data: user })
})

export default auth
