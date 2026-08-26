const { Pool } = require("pg");

const isLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1");

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isLocal ? false : { rejectUnauthorized: false }
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "zlecenia_db",
        password: "postgres",
        port: 5432,
      }
);

module.exports = pool;
