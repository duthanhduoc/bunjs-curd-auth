import { faker } from '@faker-js/faker'
import db from './database'

const PRODUCT_COUNT = 500

console.log('Seeding database...')

// Create admin user
const hashedPassword = await Bun.password.hash('admin123')
try {
  db.query('INSERT INTO users (username, password) VALUES (?, ?)').run(
    'admin',
    hashedPassword
  )
  console.log(
    '✅ Admin user created  —  username: admin  |  password: admin123'
  )
} catch {
  console.log('ℹ️  Admin user already exists, skipping.')
}

// Generate and insert fake products using a prepared statement for performance
const insert = db.prepare(
  'INSERT INTO products (name, description, price, stock, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
)

function randomISODate(from: Date, to: Date): string {
  const ms = faker.date.between({ from, to }).getTime()
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

const insertMany = db.transaction(() => {
  for (let i = 0; i < PRODUCT_COUNT; i++) {
    const productName = `${faker.commerce.productAdjective()} ${faker.commerce.product()} ${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`
    const description = faker.commerce.productDescription()
    const price = parseFloat(
      faker.commerce.price({ min: 1, max: 5000, dec: 2 })
    )
    const stock = faker.number.int({ min: 0, max: 500 })
    const image = faker.image.url({ width: 400, height: 400 })

    // created_at: random within the past 2 years
    const rangeStart = new Date('2024-01-01T00:00:00Z')
    const now = new Date()
    const createdAt = randomISODate(rangeStart, now)

    // updated_at: random between created_at and now
    const updatedAt = randomISODate(new Date(createdAt), now)

    insert.run(
      productName,
      description,
      price,
      stock,
      image,
      createdAt,
      updatedAt
    )
  }
})

insertMany()
console.log(`✅ Created ${PRODUCT_COUNT} fake products`)

console.log('\n🌱 Seed completed!')
