const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",        // Twój użytkownik PostgreSQL
  host: "localhost",       // lokalny serwer
  database: "zlecenia_db", // nazwa bazy
  password: "postgres",    // hasło użytkownika
  port: 5432,              // standardowy port PostgreSQL
});

module.exports = pool;
