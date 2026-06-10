const { Pool } = require('pg')

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://tabup:${process.env.POSTGRES_PASSWORD}@localhost:5432/tabup`

const pool = new Pool({ connectionString })

module.exports = pool
