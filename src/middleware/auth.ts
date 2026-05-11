import { verify } from 'hono/jwt'
import type { Context, Next } from 'hono'

const JWT_SECRET = Bun.env.JWT_SECRET ?? 'super-secret-jwt-key'

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', code: 'MISSING_TOKEN' }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256')
    c.set('jwtPayload', payload)
    await next()
  } catch (e) {
    if (e instanceof Error && e.name === 'JwtTokenExpired') {
      return c.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, 401)
    }
    return c.json({ error: 'Unauthorized', code: 'INVALID_TOKEN' }, 401)
  }
}
