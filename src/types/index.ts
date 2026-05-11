export interface User {
  id: number
  username: string
  password: string
  created_at: string
}

export interface Product {
  id: number
  name: string
  description: string | null
  price: number
  stock: number
  image: string | null
  created_at: string
  updated_at: string
}

export interface JWTPayload {
  userId: number
  username: string
  exp?: number
}

export interface RefreshToken {
  id: number
  token: string
  user_id: number
  expires_at: string
  revoked: number
  created_at: string
}
