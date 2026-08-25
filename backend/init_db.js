const pool = require('./db');

async function initDb() {
  try {
    console.log('Inicjalizacja schematu bazy danych...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) DEFAULT 'company',
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        company_name VARCHAR(255),
        nip VARCHAR(50),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'new',
        price NUMERIC(12,2),
        vat_rate INTEGER DEFAULT 23,
        notes TEXT,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        deadline TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS issues (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        description TEXT,
        status VARCHAR(50) DEFAULT 'open',
        user_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_id INTEGER,
        action TEXT,
        target_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS accounting_entries (
        id SERIAL PRIMARY KEY,
        entry_type TEXT,
        date DATE,
        number TEXT,
        contractor TEXT,
        net_amount NUMERIC(12,2),
        vat_rate INTEGER,
        vat_amount NUMERIC(12,2),
        gross_amount NUMERIC(12,2),
        category TEXT,
        is_car_cost BOOLEAN DEFAULT false,
        is_ready BOOLEAN DEFAULT false,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS accounting_settings (
        id SERIAL PRIMARY KEY,
        year INTEGER,
        month INTEGER,
        carried_vat NUMERIC(12,2) DEFAULT 0,
        manual_profit NUMERIC(12,2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS order_costs (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        title TEXT,
        amount NUMERIC(12,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        description TEXT,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'draft',
        total_net NUMERIC(12,2) DEFAULT 0,
        total_vat NUMERIC(12,2) DEFAULT 0,
        total_gross NUMERIC(12,2) DEFAULT 0,
        valid_until DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS offer_items (
        id SERIAL PRIMARY KEY,
        offer_id INTEGER REFERENCES offers(id) ON DELETE CASCADE,
        title VARCHAR(255),
        description TEXT,
        quantity NUMERIC(12,2) DEFAULT 1,
        unit VARCHAR(50) DEFAULT 'szt.',
        unit_price_net NUMERIC(12,2) DEFAULT 0,
        net_amount NUMERIC(12,2) DEFAULT 0,
        vat_rate INTEGER DEFAULT 23,
        vat_amount NUMERIC(12,2) DEFAULT 0,
        gross_amount NUMERIC(12,2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ksef_settings (
        id SERIAL PRIMARY KEY,
        nip VARCHAR(50),
        environment VARCHAR(50) DEFAULT 'test',
        encrypted_token TEXT,
        iv VARCHAR(255),
        tag VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ksef_invoices (
        id SERIAL PRIMARY KEY,
        ksef_reference_number VARCHAR(255),
        invoice_number VARCHAR(255),
        contractor_name VARCHAR(255),
        contractor_nip VARCHAR(50),
        date DATE,
        net_amount NUMERIC(12,2),
        vat_rate INTEGER,
        vat_amount NUMERIC(12,2),
        gross_amount NUMERIC(12,2),
        is_imported BOOLEAN DEFAULT false,
        accounting_entry_id INTEGER REFERENCES accounting_entries(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure default admin user exists
    const adminCheck = await pool.query("SELECT * FROM users WHERE email = 'admin@example.com' OR role = 'admin'");
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        "INSERT INTO users (email, password_hash, role, is_active) VALUES ('admin@example.com', $1, 'admin', true)",
        [hash]
      );
      console.log("Konto administratora utworzone: admin@example.com / admin123");
    } else {
      console.log("Konto administratora już istnieje.");
    }

    console.log("Struktura bazy danych została pomyślnie utwożona/zaktualizowana!");
  } catch (err) {
    console.error("Błąd podczas inicjalizacji bazy danych:", err);
  } finally {
    await pool.end();
  }
}

initDb();
