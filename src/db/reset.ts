import { unlinkSync, existsSync } from 'fs'

const DB_FILE = 'database.sqlite'
const WAL_FILE = `${DB_FILE}-wal`
const SHM_FILE = `${DB_FILE}-shm`

for (const file of [DB_FILE, WAL_FILE, SHM_FILE]) {
  if (existsSync(file)) {
    unlinkSync(file)
    console.log(`🗑️  Deleted ${file}`)
  }
}

console.log('✅ Database reset complete. Run "bun run seed" to re-seed.')
