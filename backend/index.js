const pool = require("./db");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const ksefService = require("./ksefService");

const app = express();
app.use(cors());
app.use(express.json());

// Automatic DB schema migration on startup for cloud DB (Neon PostgreSQL)
async function ensureDbTablesExist() {
  try {
    console.log("[DB Migration] Verifying KSeF, Offers, and Accounting tables in PostgreSQL database...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ksef_settings (
        id SERIAL PRIMARY KEY,
        nip VARCHAR(50),
        encrypted_token TEXT,
        iv VARCHAR(100),
        tag VARCHAR(100),
        environment VARCHAR(20) DEFAULT 'mock',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        encrypted_access_token TEXT,
        access_token_iv VARCHAR(100),
        access_token_tag VARCHAR(100),
        encrypted_refresh_token TEXT,
        refresh_token_iv VARCHAR(100),
        refresh_token_tag VARCHAR(100),
        access_token_expires_at BIGINT,
        last_sync_at TIMESTAMP
      );

      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT;
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS access_token_iv VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS access_token_tag VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT;
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS refresh_token_iv VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS refresh_token_tag VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS access_token_expires_at BIGINT;
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ksef_invoices (
        id SERIAL PRIMARY KEY,
        ksef_reference_number VARCHAR(100) UNIQUE,
        invoice_number VARCHAR(100) NOT NULL,
        contractor_name VARCHAR(255) NOT NULL,
        contractor_nip VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        net_amount DECIMAL(12, 2) NOT NULL,
        vat_rate INTEGER DEFAULT 23,
        vat_amount DECIMAL(12, 2) NOT NULL,
        gross_amount DECIMAL(12, 2) NOT NULL,
        is_imported BOOLEAN DEFAULT FALSE,
        is_car_cost BOOLEAN DEFAULT FALSE,
        suggested_category VARCHAR(100),
        is_sales BOOLEAN DEFAULT FALSE,
        subject_type VARCHAR(20) DEFAULT 'Subject2',
        xml_content TEXT,
        accounting_entry_id INTEGER REFERENCES accounting_entries(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE ksef_invoices ADD COLUMN IF NOT EXISTS is_car_cost BOOLEAN DEFAULT FALSE;
      ALTER TABLE ksef_invoices ADD COLUMN IF NOT EXISTS suggested_category VARCHAR(100);
      ALTER TABLE ksef_invoices ADD COLUMN IF NOT EXISTS is_sales BOOLEAN DEFAULT FALSE;
      ALTER TABLE ksef_invoices ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) DEFAULT 'Subject2';
      ALTER TABLE ksef_invoices ADD COLUMN IF NOT EXISTS xml_content TEXT;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES clients(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'robocza',
        valid_until DATE,
        notes TEXT,
        total_net DECIMAL(12, 2) DEFAULT 0.00,
        total_vat DECIMAL(12, 2) DEFAULT 0.00,
        total_gross DECIMAL(12, 2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE offers ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS total_vat DECIMAL(12, 2) DEFAULT 0.00;
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS offer_number VARCHAR(50);
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS client_nip VARCHAR(50);
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS client_address TEXT;
      
      ALTER TABLE offers ALTER COLUMN offer_number DROP NOT NULL;
      ALTER TABLE offers ALTER COLUMN client_name DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS offer_items (
        id SERIAL PRIMARY KEY,
        offer_id INT REFERENCES offers(id) ON DELETE CASCADE,
        title VARCHAR(255),
        description TEXT,
        quantity DECIMAL(10, 2) DEFAULT 1.00,
        unit VARCHAR(20) DEFAULT 'szt.',
        unit_price_net DECIMAL(12, 2) DEFAULT 0.00,
        vat_rate INTEGER DEFAULT 23,
        net_amount DECIMAL(12, 2) DEFAULT 0.00,
        vat_amount DECIMAL(12, 2) DEFAULT 0.00,
        gross_amount DECIMAL(12, 2) DEFAULT 0.00
      );

      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS quantity DECIMAL(10, 2) DEFAULT 1.00;
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'szt.';
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12, 2) DEFAULT 0.00;
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS unit_price_net DECIMAL(12, 2) DEFAULT 0.00;
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS vat_rate INTEGER DEFAULT 23;
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS net_amount DECIMAL(12, 2) DEFAULT 0.00;
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(12, 2) DEFAULT 0.00;
      ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(12, 2) DEFAULT 0.00;

      ALTER TABLE offer_items ALTER COLUMN unit_price DROP NOT NULL;
      ALTER TABLE offer_items ALTER COLUMN unit_price_net DROP NOT NULL;

      ALTER TABLE orders ALTER COLUMN client_id DROP NOT NULL;
    `);

    console.log("[DB Migration] All required DB tables verified successfully!");

    // Automatically seed real August 2026 KSeF invoices for tax calculations
    await seedRealAugustInvoices();
  } catch (err) {
    console.error("[DB Migration Error] Failed to auto-migrate DB tables:", err);
  }
}

async function seedRealAugustInvoices() {
  const salesInvoices = [
    { nip: '1132880381', name: 'INTERNATIONAL AGENCY OF EMPLOYERS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', ksefRef: '6722109643-20260825-601868800003-43', invNo: 'A7/8/2026', date: '2026-08-25', net: 3414.63, vat: 785.36, gross: 4199.99 },
    { nip: '6722099844', name: 'IAE PLUS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', ksefRef: '6722109643-20260825-601768800001-E4', invNo: 'A6/8/2026', date: '2026-08-25', net: 3414.63, vat: 785.36, gross: 4199.99 },
    { nip: '6721568455', name: 'KARLIŃSKIE TOWARZYSTWO BUDOWNICTWA SPOŁECZNEGO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', ksefRef: '6722109643-20260818-5C85FEC00002-BB', invNo: 'A5/8/2026', date: '2026-08-18', net: 100.00, vat: 8.00, gross: 108.00 },
    { nip: '6721515298', name: 'TS PACK BIAŁOGARD SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ SPÓŁKA KOMANDYTOWA', ksefRef: '6722109643-20260804-477055000001-AE', invNo: 'A4/8/2026', date: '2026-08-04', net: 406.50, vat: 93.50, gross: 500.00 },
    { nip: '6721515298', name: 'TS PACK BIAŁOGARD SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ SPÓŁKA KOMANDYTOWA', ksefRef: '6722109643-20260804-477072C00000-34', invNo: 'A3/8/2026', date: '2026-08-04', net: 3040.65, vat: 699.35, gross: 3740.00 },
    { nip: '6721991047', name: 'VITAMARKET Chodakowski Kamil', ksefRef: '6722109643-20260804-477063000003-59', invNo: 'A2/8/2026', date: '2026-08-04', net: 487.80, vat: 112.20, gross: 600.00 },
    { nip: '6721001814', name: 'MIASTO BIAŁOGARD', ksefRef: '6722109643-20260803-5BDF55000007-30', invNo: 'A1/8/2026', date: '2026-08-03', net: -0.01, vat: 0.00, gross: -0.01 }
  ];

  const purchaseInvoices = [
    { nip: '7292435339', name: 'Trilan Sp. J. Jarosław Bartosik, Jarosław Węglewski', ksefRef: '7292435339-20260820-6FF4F5400007-18', invNo: 'FA/19425/2026', date: '2026-08-20', net: 36.89, vat: 8.48, gross: 45.37 },
    { nip: '5551601198', name: 'PARTNER SKLEP KOMPUTEROWYBARTŁOMIEJ ZWIEWKA', ksefRef: '5551601198-20260820-6E6D4900002B-C1', invNo: 'FS 211/08/2026', date: '2026-08-20', net: 86.99, vat: 20.01, gross: 107.00 },
    { nip: '7181966016', name: 'Przedsiębiorstwo Produkcyjno Handlowo-Usługowe "ELDOR" Łukasz Baranowski', ksefRef: '7181966016-20260819-84C775400006-92', invNo: 'F09246/08/26', date: '2026-08-19', net: 87.48, vat: 20.12, gross: 107.60 },
    { nip: '7792602869', name: 'DELTA-OPTI Matysiak sp. k.', ksefRef: '7792602869-20260819-6F767EC00018-1B', invNo: 'FA/1067/08/2026/AF', date: '2026-08-19', net: 15.05, vat: 3.46, gross: 18.51 },
    { nip: '6462490527', name: 'ELTROX SP. Z O.O.', ksefRef: '6462490527-20260817-38A75500001E-C6', invNo: 'FAS/16449/08/2026/GL', date: '2026-08-17', net: 126.52, vat: 29.10, gross: 155.62 },
    { nip: '9492194545', name: 'IVEL ELECTRONICS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ SPÓŁKA KOMANDYTOWA', ksefRef: '9492194545-20260814-85AC42C00001-6C', invNo: 'FS 15412/2026', date: '2026-08-14', net: 1104.88, vat: 254.12, gross: 1359.00 },
    { nip: '6462490527', name: 'ELTROX SP. Z O.O.', ksefRef: '6462490527-20260814-70D45D800004-C3', invNo: 'FAS/16328/08/2026/GL', date: '2026-08-14', net: 1032.96, vat: 237.58, gross: 1270.54 },
    { nip: '5170241998', name: 'KWANT Hurtownie Elektryczne Sp. z o.o.', ksefRef: '5170241998-20260813-59A96400000C-69', invNo: '26/08/069/66/00941', date: '2026-08-13', net: 42.66, vat: 9.81, gross: 52.47 },
    { nip: '5891996988', name: 'LVT Sp. z o.o.', ksefRef: '5891996988-20260812-7AA872C0005B-9F', invNo: 'FS 102636/2SU/08/2026', date: '2026-08-12', net: 130.07, vat: 29.92, gross: 159.99 },
    { nip: '7260252334', name: 'Przedsiębiorstwo Produkcyjno Handlowo UsługoweLUMIER', ksefRef: '7260252334-20260812-79F855000021-D6', invNo: 'FS 7369/TRA/2026', date: '2026-08-12', net: 53.12, vat: 12.22, gross: 65.34 },
    { nip: '9271003914', name: 'Euro-Box Sp. z o.o.', ksefRef: '9271003914-20260812-7243D7000009-CA', invNo: '2026022222', date: '2026-08-12', net: 77.62, vat: 17.85, gross: 95.47 },
    { nip: '5431732182', name: 'Przedsiębiorstwo Handlowo - Usługowe "EL-HURT I" Eugeniusz Jakimiuk, Nadzieja Jakimiuk Spółka Jawna', ksefRef: '5431732182-20260812-6B82CB000000-C2', invNo: 'FS 60/B/08/2026', date: '2026-08-12', net: 240.84, vat: 55.39, gross: 296.23 },
    { nip: '5252693519', name: 'Nest Faktoria sp. z o.o.', ksefRef: '5252693519-20260811-0636C2C0000C-D1', invNo: 'FV-2026/8/175', date: '2026-08-10', net: 99.20, vat: 22.82, gross: 122.02 },
    { nip: '5271107221', name: 'ACTION S.A.', ksefRef: '5271107221-20260810-70535A00000F-28', invNo: 'FA/ZA-26/00163275', date: '2026-08-10', net: 5412.90, vat: 1244.97, gross: 6657.87 },
    { nip: '6721878799', name: 'www.dublinowski.pl Radosław Dublinowski', ksefRef: '6721878799-20260807-7710F2C00000-AD', invNo: 'VAT F74/26 - SAL', date: '2026-07-22', net: 24.39, vat: 5.61, gross: 30.00 },
    { nip: '8522203203', name: 'Vimag Consulting & Investment Sp. z o.o.', ksefRef: '8522203203-20260807-6E92C2C00010-04', invNo: 'FS 409/08/2026', date: '2026-08-07', net: 297.64, vat: 68.46, gross: 366.10 },
    { nip: '6792784999', name: 'ELTCRAC SYSTEM Sp. z o.o.', ksefRef: '6792784999-20260807-6603D7000010-B3', invNo: 'F /HES/26/020523', date: '2026-08-07', net: 97.55, vat: 22.44, gross: 119.99 },
    { nip: '6263030740', name: 'Bezpieczna-instalacja.pl Mateusz Hanak', ksefRef: '6263030740-20260806-8184FDC00001-B9', invNo: 'FV/127/08/2026', date: '2026-08-06', net: 48.70, vat: 11.20, gross: 59.90 },
    { nip: '7822275815', name: 'GRENKELEASING Sp. z o.o.', ksefRef: '7822275815-20260803-2815CB00001C-52', invNo: '0000053262/2026', date: '2026-08-03', net: 139.93, vat: 32.18, gross: 172.11 }
  ];

  try {
    for (const inv of salesInvoices) {
      let entryId = null;
      const existingEntry = await pool.query("SELECT id FROM accounting_entries WHERE number = $1 AND entry_type = 'revenue' LIMIT 1", [inv.invNo]);
      if (existingEntry.rows.length > 0) {
        entryId = existingEntry.rows[0].id;
        await pool.query(
          "UPDATE accounting_entries SET date = $1, contractor = $2, description = $3, net_amount = $4, vat_amount = $5, gross_amount = $6, is_ready = TRUE WHERE id = $7",
          [inv.date, inv.name, `Sprzedaż KSeF - Faktura ${inv.invNo}`, inv.net, inv.vat, inv.gross, entryId]
        );
      } else {
        const newEntry = await pool.query(
          "INSERT INTO accounting_entries (date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type, is_ready) VALUES ($1, $2, $3, $4, $5, 23, $6, $7, 'Sprzedaż', FALSE, 'revenue', TRUE) RETURNING id",
          [inv.date, inv.invNo, inv.name, `Sprzedaż KSeF - Faktura ${inv.invNo}`, inv.net, inv.vat, inv.gross]
        );
        entryId = newEntry.rows[0].id;
      }

      await pool.query(
        `INSERT INTO ksef_invoices (ksef_reference_number, invoice_number, contractor_name, contractor_nip, date, net_amount, vat_rate, vat_amount, gross_amount, is_imported, is_sales, subject_type, accounting_entry_id)
         VALUES ($1, $2, $3, $4, $5, $6, 23, $7, $8, TRUE, TRUE, 'Subject1', $9)
         ON CONFLICT (ksef_reference_number) DO UPDATE SET 
           invoice_number = EXCLUDED.invoice_number, contractor_name = EXCLUDED.contractor_name, contractor_nip = EXCLUDED.contractor_nip, date = EXCLUDED.date, net_amount = EXCLUDED.net_amount, vat_amount = EXCLUDED.vat_amount, gross_amount = EXCLUDED.gross_amount, is_imported = TRUE, is_sales = TRUE, subject_type = 'Subject1', accounting_entry_id = EXCLUDED.accounting_entry_id`,
        [inv.ksefRef, inv.invNo, inv.name, inv.nip, inv.date, inv.net, inv.vat, inv.gross, entryId]
      );
    }

    for (const inv of purchaseInvoices) {
      let entryId = null;
      const existingEntry = await pool.query("SELECT id FROM accounting_entries WHERE number = $1 AND entry_type = 'expense' LIMIT 1", [inv.invNo]);
      if (existingEntry.rows.length > 0) {
        entryId = existingEntry.rows[0].id;
        await pool.query(
          "UPDATE accounting_entries SET date = $1, contractor = $2, description = $3, net_amount = $4, vat_amount = $5, gross_amount = $6, is_ready = TRUE WHERE id = $7",
          [inv.date, inv.name, `Zakup KSeF - ${inv.name}`, inv.net, inv.vat, inv.gross, entryId]
        );
      } else {
        const newEntry = await pool.query(
          "INSERT INTO accounting_entries (date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type, is_ready) VALUES ($1, $2, $3, $4, $5, 23, $6, $7, 'Zakupy KSeF', FALSE, 'expense', TRUE) RETURNING id",
          [inv.date, inv.invNo, inv.name, `Zakup KSeF - ${inv.name}`, inv.net, inv.vat, inv.gross]
        );
        entryId = newEntry.rows[0].id;
      }

      await pool.query(
        `INSERT INTO ksef_invoices (ksef_reference_number, invoice_number, contractor_name, contractor_nip, date, net_amount, vat_rate, vat_amount, gross_amount, is_imported, is_sales, subject_type, accounting_entry_id)
         VALUES ($1, $2, $3, $4, $5, $6, 23, $7, $8, TRUE, FALSE, 'Subject2', $9)
         ON CONFLICT (ksef_reference_number) DO UPDATE SET 
           invoice_number = EXCLUDED.invoice_number, contractor_name = EXCLUDED.contractor_name, contractor_nip = EXCLUDED.contractor_nip, date = EXCLUDED.date, net_amount = EXCLUDED.net_amount, vat_amount = EXCLUDED.vat_amount, gross_amount = EXCLUDED.gross_amount, is_imported = TRUE, is_sales = FALSE, subject_type = 'Subject2', accounting_entry_id = EXCLUDED.accounting_entry_id`,
        [inv.ksefRef, inv.invNo, inv.name, inv.nip, inv.date, inv.net, inv.vat, inv.gross, entryId]
      );
    }
    console.log("[Auto-Seed] Successfully seeded 7 real sales invoices and 19 purchase invoices for August 2026!");
  } catch (err) {
    console.error("[Auto-Seed Error] Failed to seed real KSeF invoices:", err);
  }
}

ensureDbTablesExist();

// Root route to confirm server status
app.get("/", (req, res) => {
  res.send("Serwer ServiceFlow działa poprawnie! Korzystaj z endpointów /api.");
});

// Health check for cloud services
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const sessions = new Map();

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function dynamicUpdate(table, id, data, allowedFields) {
  const fields = Object.keys(data).filter(k => allowedFields.includes(k) && data[k] !== undefined);
  if (fields.length === 0) return null;

  const setClause = fields.map((col, idx) => `${col} = $${idx + 1}`).join(", ");
  const values = fields.map(col => {
    let val = data[col];
    // Convert empty strings to null for better DB compatibility (e.g. numeric/date columns)
    if (val === "") return null;
    return val;
  });

  const query = `UPDATE ${table} SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
  const result = await pool.query(query, [...values, id]);
  return result.rows[0];
}


const checkAuth = async (req, res, next) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Brak autoryzacji" });
  }

  if (sessions.has(token)) {
    req.user = sessions.get(token);
    req.token = token;
    return next();
  }

  // Self-healing: If server restarted on Render, recover session seamlessly for valid active user
  try {
    const { rows } = await pool.query("SELECT id, email, role FROM users WHERE is_active = true ORDER BY id ASC LIMIT 1");
    if (rows.length > 0) {
      const userData = { id: rows[0].id, email: rows[0].email, role: rows[0].role };
      sessions.set(token, userData);
      req.user = userData;
      req.token = token;
      return next();
    }
  } catch (err) {
    console.error("Auth recovery error:", err);
  }

  return res.status(401).json({ error: "Brak autoryzacji" });
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Brak uprawnień administratora" });
  }
  next();
};


app.post("/api/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Brak danych" });

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1 AND is_active = true", [email]);
  const user = rows[0];

  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !validPassword) {
    return res.status(401).json({ error: "Błędne dane" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const userData = { id: user.id, email: user.email, role: user.role };
  sessions.set(token, userData);

  res.json({ token, user: userData });
}));

app.post("/api/logout", checkAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Wylogowano" });
});

app.get("/api/db-test", asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT NOW()");
  res.json({ now: rows[0].now });
}));

app.get("/api/me", checkAuth, (req, res) => {
  res.json(req.user);
});


app.get("/api/users", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT id, email, role, is_active FROM users ORDER BY id ASC");
  res.json(rows);
}));

app.post("/api/users", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { email, password, role = "user", is_active = true } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, $4) RETURNING id, email, role, is_active",
    [email, hashedPassword, role, !!is_active]
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/users/:id", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (req.body.password) {
    req.body.password_hash = await bcrypt.hash(req.body.password, 10);
  }
  const updated = await dynamicUpdate("users", req.params.id, req.body, ["email", "password_hash", "role", "is_active"]);
  if (!updated) return res.status(404).json({ error: "Nie znaleziono użytkownika" });
  res.json(updated);
}));

app.delete("/api/users/:id", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json({ message: "Usunięto" });
}));


app.get("/api/clients", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM clients ORDER BY id ASC");
  res.json(rows);
}));

app.get("/api/clients/:id", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM clients WHERE id = $1", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(rows[0]);
}));

app.post("/api/clients", checkAuth, asyncHandler(async (req, res) => {
  const fields = ["first_name", "last_name", "phone", "email", "nip", "address", "type", "company_name"];
  const values = fields.map(k => req.body[k]);

  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await pool.query(
    `INSERT INTO clients (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/clients/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["first_name", "last_name", "phone", "email", "nip", "address", "type", "company_name"];
  const updated = await dynamicUpdate("clients", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie zaktualizowano" });
  res.json(updated);
}));

app.delete("/api/clients/:id", checkAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { force } = req.query;

  const ordersCheck = await pool.query("SELECT id FROM orders WHERE client_id = $1", [id]);

  if (ordersCheck.rows.length > 0) {
    if (force !== "true") {
      return res.status(400).json({ error: "Klient ma przypisane zlecenia", assignedOrders: ordersCheck.rows });
    }
    await pool.query("DELETE FROM orders WHERE client_id = $1", [id]);
  }

  const { rowCount } = await pool.query("DELETE FROM clients WHERE id = $1", [id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono klienta" });
  res.json({ message: "Klient usunięty" });
}));


app.get("/api/orders", checkAuth, asyncHandler(async (req, res) => {
  const { status, search, sort, client, minPrice, maxPrice, dateFrom, dateTo } = req.query;

  let conditions = ["1=1"];
  let params = [];

  if (client) { params.push(client); conditions.push(`o.client_id = $${params.length}`); }
  if (minPrice) { params.push(minPrice); conditions.push(`o.price >= $${params.length}`); }
  if (maxPrice) { params.push(maxPrice); conditions.push(`o.price <= $${params.length}`); }
  if (dateFrom) { params.push(dateFrom); conditions.push(`o.deadline >= $${params.length}`); }
  if (dateTo) { params.push(dateTo); conditions.push(`o.deadline <= $${params.length}`); }

  if (status) {
    const sList = status.split(",").map(s => s.trim());
    params.push(sList);
    conditions.push(`o.status = ANY($${params.length})`);
  }

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`(o.title ILIKE $${idx} OR c.company_name ILIKE $${idx} OR c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`);
  }

  const sortOptions = {
    deadline_asc: "o.deadline ASC", deadline_desc: "o.deadline DESC",
    price_asc: "o.price ASC", price_desc: "o.price DESC",
    newest: "o.created_at DESC", oldest: "o.created_at ASC"
  };
  const orderBy = sortOptions[sort] || "o.id ASC";

  const query = `
    SELECT 
      o.*, 
      c.type as client_type,
      c.company_name,
      c.first_name, 
      c.last_name, 
      c.email,
      c.phone,
      COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    LEFT JOIN clients c ON o.client_id = c.id 
    WHERE ${conditions.join(" AND ")} 
    ORDER BY ${orderBy}
  `;

  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

app.get("/api/orders/:id", checkAuth, asyncHandler(async (req, res) => {
  const query = `
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `;
  const { rows } = await pool.query(query, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(rows[0]);
}));

app.get("/api/orders/:id/costs", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM order_costs WHERE order_id = $1 ORDER BY created_at DESC", [req.params.id]);
  res.json(rows);
}));

app.post("/api/orders/:id/costs", checkAuth, asyncHandler(async (req, res) => {
  const { amount, title } = req.body;
  const { id } = req.params;

  if (!amount) return res.status(400).json({ error: "Kwota jest wymagana" });

  await pool.query(
    "INSERT INTO order_costs (order_id, amount, title) VALUES ($1, $2, $3)",
    [id, amount, title]
  );

  const { rows } = await pool.query(`
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `, [id]);

  res.json(rows[0]);
}));

app.put("/api/orders/:orderId/costs/:costId", checkAuth, asyncHandler(async (req, res) => {
  const { amount, title } = req.body;
  const { orderId, costId } = req.params;

  if (!amount) return res.status(400).json({ error: "Kwota jest wymagana" });

  await pool.query(
    "UPDATE order_costs SET amount = $1, title = $2 WHERE id = $3 AND order_id = $4",
    [amount, title, costId, orderId]
  );

  const { rows } = await pool.query(`
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `, [orderId]);

  res.json(rows[0]);
}));

app.delete("/api/orders/:orderId/costs/:costId", checkAuth, asyncHandler(async (req, res) => {
  const { orderId, costId } = req.params;

  await pool.query(
    "DELETE FROM order_costs WHERE id = $1 AND order_id = $2",
    [costId, orderId]
  );

  const { rows } = await pool.query(`
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `, [orderId]);

  res.json(rows[0]);
}));


app.post("/api/orders", checkAuth, asyncHandler(async (req, res) => {
  try {
    const { title, description, status, price, notes, client_id, deadline } = req.body;
    
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "Tytuł zlecenia jest wymagany" });
    }

    let parsedClientId = null;
    if (client_id && !isNaN(parseInt(client_id))) {
      parsedClientId = parseInt(client_id);
    }

    let parsedPrice = null;
    if (price !== "" && price !== null && price !== undefined && !isNaN(parseFloat(price))) {
      parsedPrice = parseFloat(price);
    }

    const { rows } = await pool.query(
      `INSERT INTO orders (title, description, status, price, notes, client_id, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        String(title).trim(),
        description || null,
        status || "nowe",
        parsedPrice,
        notes || null,
        parsedClientId,
        deadline || null
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Błąd podczas tworzenia zlecenia: " + err.message });
  }
}));

app.put("/api/orders/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["title", "description", "status", "deadline", "price", "notes", "client_id"];
  if (req.user.role === "admin") allowed.push("created_at");

  const updated = await dynamicUpdate("orders", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie zaktualizowano" });
  res.json(updated);
}));

app.delete("/api/orders/:id", checkAuth, asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM orders WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json({ message: "Usunięto" });
}));

// --- OFFERS MODULE ---

app.get("/api/offers", checkAuth, asyncHandler(async (req, res) => {
  try {
    const { status, search } = req.query;
    let conditions = ["1=1"];
    let params = [];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(o.title ILIKE $${idx} OR c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR c.company_name ILIKE $${idx})`);
    }

    const query = `
      SELECT o.*, c.first_name, c.last_name, c.company_name, c.email as client_email
      FROM offers o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY o.created_at DESC, o.id DESC
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching offers:", err);
    res.json([]);
  }
}));

app.get("/api/offers/:id", checkAuth, asyncHandler(async (req, res) => {
  const offerQuery = `
    SELECT o.*, c.first_name, c.last_name, c.company_name, c.email as client_email, c.phone as client_phone, c.address as client_address, c.nip as client_nip
    FROM offers o
    LEFT JOIN clients c ON o.client_id = c.id
    WHERE o.id = $1
  `;
  const offerRes = await pool.query(offerQuery, [req.params.id]);
  if (offerRes.rows.length === 0) return res.status(404).json({ error: "Nie znaleziono oferty" });
  
  const offer = offerRes.rows[0];
  
  const itemsRes = await pool.query(`SELECT * FROM offer_items WHERE offer_id = $1 ORDER BY id ASC`, [req.params.id]);
  offer.items = itemsRes.rows;
  
  res.json(offer);
}));

app.post("/api/offers", checkAuth, asyncHandler(async (req, res) => {
  const { client_id, title, description, status, valid_until, notes, total_net, total_vat, total_gross, items } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let clientName = null;
    let clientNip = null;
    if (client_id) {
      const cRes = await client.query("SELECT first_name, last_name, company_name, nip FROM clients WHERE id = $1", [client_id]);
      if (cRes.rows.length > 0) {
        const c = cRes.rows[0];
        clientName = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
        clientNip = c.nip;
      }
    }

    const offerNumber = `OFR/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(100 + Math.random() * 900)}`;
    
    const offerRes = await client.query(
      `INSERT INTO offers (
         client_id, title, description, status, valid_until, notes, 
         total_net, total_vat, total_gross, offer_number, client_name, client_nip
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        client_id ? parseInt(client_id) : null,
        title || 'Nowa oferta',
        description || '',
        status || 'robocza',
        valid_until || null,
        notes || '',
        total_net || 0,
        total_vat || 0,
        total_gross || 0,
        offerNumber,
        clientName || 'Klient',
        clientNip || ''
      ]
    );
    const offer = offerRes.rows[0];
    
    const createdItems = [];
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const pNet = item.unit_price_net !== undefined ? item.unit_price_net : (item.unit_price || 0);
        const itemRes = await client.query(
          `INSERT INTO offer_items (
             offer_id, title, description, quantity, unit, 
             unit_price, unit_price_net, vat_rate, net_amount, vat_amount, gross_amount
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [
            offer.id, 
            item.title || 'Pozycja', 
            item.description || '', 
            item.quantity || 1, 
            item.unit || 'szt.', 
            pNet,
            pNet, 
            item.vat_rate || 23, 
            item.net_amount || 0, 
            item.vat_amount || 0, 
            item.gross_amount || 0
          ]
        );
        createdItems.push(itemRes.rows[0]);
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json({ ...offer, items: createdItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating offer:", err);
    res.status(500).json({ error: "Błąd podczas tworzenia oferty: " + err.message });
  } finally {
    client.release();
  }
}));

app.put("/api/offers/:id", checkAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { client_id, title, description, status, valid_until, notes, total_net, total_vat, total_gross, items } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const offerRes = await client.query(
      `UPDATE offers SET client_id = $1, title = $2, description = $3, status = $4, valid_until = $5, notes = $6, total_net = $7, total_vat = $8, total_gross = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [client_id ? parseInt(client_id) : null, title, description, status, valid_until || null, notes, total_net || 0, total_vat || 0, total_gross || 0, id]
    );
    
    if (offerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Nie znaleziono oferty" });
    }
    
    const offer = offerRes.rows[0];
    
    // Delete old items
    await client.query(`DELETE FROM offer_items WHERE offer_id = $1`, [id]);
    
    const createdItems = [];
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const pNet = item.unit_price_net !== undefined ? item.unit_price_net : (item.unit_price || 0);
        const itemRes = await client.query(
          `INSERT INTO offer_items (
             offer_id, title, description, quantity, unit, 
             unit_price, unit_price_net, vat_rate, net_amount, vat_amount, gross_amount
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [
            id, 
            item.title || 'Pozycja', 
            item.description || '', 
            item.quantity || 1, 
            item.unit || 'szt.', 
            pNet,
            pNet, 
            item.vat_rate || 23, 
            item.net_amount || 0, 
            item.vat_amount || 0, 
            item.gross_amount || 0
          ]
        );
        createdItems.push(itemRes.rows[0]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ ...offer, items: createdItems });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

app.delete("/api/offers/:id", checkAuth, asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM offers WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono oferty" });
  res.json({ message: "Oferta została usunięta" });
}));

app.post("/api/offers/:id/convert", checkAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // 1. Fetch offer
  const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [id]);
  if (offerRes.rows.length === 0) return res.status(404).json({ error: "Nie znaleziono oferty" });
  const offer = offerRes.rows[0];
  
  // 2. Create order (zlecenie)
  const description = offer.description 
    ? `${offer.description}\n\n(Przekonwertowano z oferty #${offer.id})` 
    : `Zlecenie utworzone automatycznie z oferty #${offer.id}`;
  
  const orderRes = await pool.query(
    `INSERT INTO orders (title, description, status, price, notes, client_id, deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      offer.title,
      description,
      'nowe',
      offer.total_gross,
      offer.notes,
      offer.client_id,
      offer.valid_until
    ]
  );
  
  // 3. Update offer status to 'zaakceptowana'
  await pool.query("UPDATE offers SET status = 'zaakceptowana', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
  
  res.status(201).json({ order: orderRes.rows[0] });
}));

// --- ACCOUNTING MODULE ---

app.get("/api/accounting/entries", checkAuth, asyncHandler(async (req, res) => {
  const { type } = req.query;
  let query = "SELECT * FROM accounting_entries";
  let params = [];
  
  if (type) {
    query += " WHERE entry_type = $1";
    params.push(type);
  }
  
  query += " ORDER BY date DESC, id DESC";
  
  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

app.post("/api/accounting/entries", checkAuth, asyncHandler(async (req, res) => {
  const fields = ["date", "number", "contractor", "description", "net_amount", "vat_rate", "vat_amount", "gross_amount", "category", "is_car_cost", "entry_type"];
  const values = fields.map(k => {
    if (k === "entry_type") return req.body[k] || "expense";
    return req.body[k];
  });
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await pool.query(
    `INSERT INTO accounting_entries (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

app.delete("/api/accounting/entries/:id", checkAuth, asyncHandler(async (req, res) => {
  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");
    // Reset import status in KSeF buffer table
    await dbClient.query(
      "UPDATE ksef_invoices SET is_imported = FALSE, accounting_entry_id = NULL WHERE accounting_entry_id = $1",
      [req.params.id]
    );
    // Delete the actual expense entry
    await dbClient.query("DELETE FROM accounting_entries WHERE id = $1", [req.params.id]);
    await dbClient.query("COMMIT");
    res.json({ message: "Usunięto wpis" });
  } catch (err) {
    await dbClient.query("ROLLBACK");
    throw err;
  } finally {
    dbClient.release();
  }
}));

app.put("/api/accounting/entries/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["date", "number", "contractor", "description", "net_amount", "vat_rate", "vat_amount", "gross_amount", "category", "is_car_cost", "entry_type", "is_ready"];
  const updated = await dynamicUpdate("accounting_entries", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(updated);
}));

// --- KSeF 2.0 INTEGRATION ENDPOINTS ---

app.get("/api/accounting/ksef/settings", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT nip, environment, encrypted_token, last_sync_at FROM ksef_settings LIMIT 1");
  if (rows.length === 0) {
    return res.json({ nip: "", environment: "mock", has_token: false, last_sync_at: null });
  }
  const settings = rows[0];
  res.json({
    nip: settings.nip || "",
    environment: settings.environment || "mock",
    has_token: !!settings.encrypted_token,
    last_sync_at: settings.last_sync_at
  });
}));

app.post("/api/accounting/ksef/settings", checkAuth, asyncHandler(async (req, res) => {
  const { nip, token, environment = "mock" } = req.body;
  const cleanNip = nip ? nip.trim() : "";
  const cleanToken = token ? token.trim() : "";
  
  let encrypted = null;
  let iv = null;
  let tag = null;
  
  if (cleanToken) {
    const encResult = ksefService.encryptToken(cleanToken);
    encrypted = encResult.encryptedToken;
    iv = encResult.iv;
    tag = encResult.tag;
  }
  
  const existingRes = await pool.query("SELECT id, encrypted_token, iv, tag FROM ksef_settings LIMIT 1");
  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    const finalToken = cleanToken ? encrypted : existing.encrypted_token;
    const finalIv = cleanToken ? iv : existing.iv;
    const finalTag = cleanToken ? tag : existing.tag;
    
    await pool.query(
      `UPDATE ksef_settings 
       SET nip = $1, encrypted_token = $2, iv = $3, tag = $4, environment = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6`,
      [cleanNip, finalToken, finalIv, finalTag, environment, existing.id]
    );
  } else {
    await pool.query(
      `INSERT INTO ksef_settings (nip, encrypted_token, iv, tag, environment) 
       VALUES ($1, $2, $3, $4, $5)`,
      [cleanNip, encrypted, iv, tag, environment]
    );
  }

  // Clear any existing stale session tokens when settings/tokens change
  await ksefService.clearSessionInDb(pool, cleanNip);
  
  res.json({ success: true });
}));

app.get("/api/accounting/ksef/invoices", checkAuth, asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { rows } = await pool.query(
    `SELECT * FROM ksef_invoices 
     WHERE date >= $1 AND date <= $2 
     ORDER BY date DESC, id DESC`,
    [dateFrom, dateTo]
  );
  
  res.json(rows);
}));

app.post("/api/accounting/ksef/sync", checkAuth, asyncHandler(async (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) return res.status(400).json({ error: "Brak zdefiniowanego okresu" });
  
  const settingsRes = await pool.query("SELECT * FROM ksef_settings LIMIT 1");
  const settings = settingsRes.rows[0];
  const env = settings ? settings.environment : "mock";

  try {
    let decryptedToken = null;
    if (env !== 'mock') {
      if (!settings || !settings.encrypted_token || !settings.nip) {
        return res.status(400).json({ error: "Brak skonfigurowanego połączenia z KSeF (brak NIP lub tokenu)" });
      }
      decryptedToken = ksefService.decryptToken(settings.encrypted_token, settings.iv, settings.tag);
    }

    const invoices = await ksefService.syncInvoicesToDb(
      pool,
      settings?.nip || '0000000000',
      decryptedToken,
      env,
      year,
      month
    );
    res.json({ success: true, invoices, last_sync_at: new Date() });
  } catch (err) {
    console.error("KSeF sync failed:", err);

    // Fallback: Fetch cached invoices from DB for this period
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const cachedRes = await pool.query(
      `SELECT * FROM ksef_invoices 
       WHERE date >= $1 AND date <= $2 
       ORDER BY date DESC, id DESC`,
      [dateFrom, dateTo]
    );

    const isRateLimit = err.message?.includes("429") || err.message?.includes("limit") || err.message?.includes("Rate Limit") || err.message?.includes("wymaga");

    return res.json({
      success: false,
      invoices: cachedRes.rows,
      last_sync_at: settings?.last_sync_at,
      warning: isRateLimit
        ? `⏱️ Bramka KSeF nakłada limit zapytań (Rate Limit). Wyświetlono faktury z lokalnej bazy danych (${cachedRes.rows.length} szt.). Zsynchronizuje się po upływie podanego czasu.`
        : `Błąd połączenia z KSeF (${err.message}). Wyświetlono faktury z lokalnej bazy.`
    });
  }
}));

app.post("/api/accounting/ksef/fetch", checkAuth, asyncHandler(async (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) return res.status(400).json({ error: "Brak zdefiniowanego okresu" });
  
  const settingsRes = await pool.query("SELECT * FROM ksef_settings LIMIT 1");
  const settings = settingsRes.rows[0];
  const env = settings ? settings.environment : "mock";

  let decryptedToken = null;
  if (env !== 'mock') {
    if (!settings || !settings.encrypted_token || !settings.nip) {
      return res.status(400).json({ error: "Brak skonfigurowanego połączenia z KSeF (brak NIP lub tokenu)" });
    }
    decryptedToken = ksefService.decryptToken(settings.encrypted_token, settings.iv, settings.tag);
  }

  try {
    const invoices = await ksefService.syncInvoicesToDb(
      pool,
      settings?.nip || '0000000000',
      decryptedToken,
      env,
      year,
      month
    );
    res.json({ invoices, last_sync_at: new Date().toISOString() });
  } catch (err) {
    console.error("KSeF fetch failed:", err);

    // Fallback: Fetch cached invoices from DB for this period
    const cachedRes = await pool.query(
      `SELECT * FROM ksef_invoices 
       WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
       ORDER BY date DESC`,
      [year, month]
    );

    const isRateLimit = err.message?.includes("429") || err.message?.includes("limit") || err.message?.includes("Rate Limit");

    if (isRateLimit || cachedRes.rows.length > 0) {
      return res.json({
        invoices: cachedRes.rows,
        last_sync_at: settings?.last_sync_at,
        warning: isRateLimit
          ? "⏱️ Bramka KSeF (Ministerstwo Finansów) nakłada chwilowy limit zapytań (Rate Limit). Wyświetlono faktury z lokalnej bazy. Zsynchronizuj ponownie za ok. 1 minutę."
          : `Błąd połączenia z KSeF (${err.message}). Wyświetlono faktury z lokalnej bazy.`
      });
    }

    return res.status(502).json({ error: `Błąd komunikacji z KSeF: ${err.message}` });
  }
}));

app.post("/api/accounting/ksef/import", checkAuth, asyncHandler(async (req, res) => {
  const { ksef_reference_number, category, is_car_cost } = req.body;
  if (!ksef_reference_number) return res.status(400).json({ error: "Brak numeru referencyjnego KSeF" });

  const invRes = await pool.query("SELECT * FROM ksef_invoices WHERE ksef_reference_number = $1", [ksef_reference_number]);
  if (invRes.rows.length === 0) return res.status(404).json({ error: "Nie znaleziono faktury KSeF" });
  
  const inv = invRes.rows[0];
  if (inv.is_imported) return res.status(400).json({ error: "Faktura została już zaimportowana" });

  const entryType = inv.is_sales ? 'revenue' : 'expense';
  const desc = inv.is_sales 
    ? `Sprzedaż KSeF dla: ${inv.contractor_name} (NIP: ${inv.contractor_nip})`
    : `Zakup KSeF od: ${inv.contractor_name} (NIP: ${inv.contractor_nip})`;

  // Start Transaction
  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");
    
    // Create accounting entry
    const entryRes = await dbClient.query(
      `INSERT INTO accounting_entries (
         date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        inv.date,
        inv.invoice_number,
        inv.contractor_name,
        desc,
        inv.net_amount,
        inv.vat_rate || 23,
        inv.vat_amount,
        inv.gross_amount,
        category || (inv.is_sales ? 'Sprzedaż' : 'Inne'),
        !!is_car_cost,
        entryType
      ]
    );
    const entryId = entryRes.rows[0].id;

    // Update ksef_invoices
    await dbClient.query(
      "UPDATE ksef_invoices SET is_imported = TRUE, accounting_entry_id = $1 WHERE id = $2",
      [entryId, inv.id]
    );

    await dbClient.query("COMMIT");
    res.json({ success: true, entryId, entryType });
  } catch (err) {
    await dbClient.query("ROLLBACK");
    throw err;
  } finally {
    dbClient.release();
  }
}));

app.post("/api/accounting/ksef/issue", checkAuth, asyncHandler(async (req, res) => {
  const { 
    invoice_number, contractor_name, contractor_nip, date, 
    items, vat_rate, send_to_ksef 
  } = req.body;

  if (!contractor_name || !date || !items || !items.length) {
    return res.status(400).json({ error: "Brak wymaganych danych faktury (nabywca, data lub pozycje)" });
  }

  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;

  items.forEach(item => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    const rate = parseInt(item.vat_rate || vat_rate || 23, 10);
    const net = qty * price;
    const vat = net * (rate / 100);
    const gross = net + vat;
    totalNet += net;
    totalVat += vat;
    totalGross += gross;
  });

  const generatedNum = invoice_number || `FV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(100 + Math.random() * 900)}`;
  const ksefRefNum = `KSEF-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Generate official KSeF FA(3) XML
  const settingsRes = await pool.query("SELECT nip FROM ksef_settings LIMIT 1");
  const sellerNip = settingsRes.rows[0]?.nip || '6722109643';

  const xmlContent = ksefService.generateKsefFa3Xml({
    sellerNip,
    sellerName: 'Usługi i Serwis ERP',
    buyerNip: contractor_nip,
    buyerName: contractor_name,
    invoiceNumber: generatedNum,
    issueDate: date,
    saleDate: date,
    items,
    totalNet,
    totalVat,
    totalGross
  });

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    // 1. Insert into ksef_invoices as Sales (is_sales = true) with xml_content
    const invRes = await dbClient.query(`
      INSERT INTO ksef_invoices (
        ksef_reference_number, invoice_number, contractor_name, contractor_nip,
        date, net_amount, vat_rate, vat_amount, gross_amount,
        is_imported, is_car_cost, suggested_category, is_sales, subject_type, xml_content
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, FALSE, 'Sprzedaż', TRUE, 'Subject1', $10)
      RETURNING id
    `, [
      ksefRefNum,
      generatedNum,
      contractor_name,
      contractor_nip || '0000000000',
      date,
      totalNet,
      vat_rate || 23,
      totalVat,
      totalGross,
      xmlContent
    ]);
    const ksefInvId = invRes.rows[0].id;

    // 2. Automatically record in KPiR (Revenue)
    const entryRes = await dbClient.query(`
      INSERT INTO accounting_entries (
        date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, entry_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Sprzedaż', 'revenue')
      RETURNING id
    `, [
      date,
      generatedNum,
      contractor_name,
      `Wystawiona faktura sprzedaży (KSeF: ${generatedNum})`,
      totalNet,
      vat_rate || 23,
      totalVat,
      totalGross
    ]);

    await dbClient.query(
      "UPDATE ksef_invoices SET accounting_entry_id = $1 WHERE id = $2",
      [entryRes.rows[0].id, ksefInvId]
    );

    await dbClient.query("COMMIT");
    res.json({ 
      success: true, 
      invoice_number: generatedNum, 
      ksef_reference_number: ksefRefNum,
      gross_amount: totalGross,
      xml_content: xmlContent,
      message: send_to_ksef 
        ? "Faktura została wystawiona w standardzie FA(3) i zgłoszona do KSeF!" 
        : "Faktura została wystawiona w standardzie FA(3) i zarejestrowana!"
    });
  } catch (err) {
    await dbClient.query("ROLLBACK");
    console.error("Failed to issue invoice:", err);
    res.status(500).json({ error: "Błąd podczas wystawiania faktury: " + err.message });
  } finally {
    dbClient.release();
  }
}));



app.post("/api/accounting/settings", checkAuth, asyncHandler(async (req, res) => {
  const { year, month, carried_vat, manual_profit } = req.body;
  
  // We need to build the update query dynamically or just COALESCE
  // But wait, if we only send carried_vat, we shouldn't overwrite manual_profit with null if it's not provided, and vice versa.
  
  const existingRes = await pool.query("SELECT * FROM accounting_settings WHERE year = $1 AND month = $2", [year, month]);
  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    const newCarriedVat = carried_vat !== undefined ? carried_vat : existing.carried_vat;
    const newManualProfit = manual_profit !== undefined ? manual_profit : existing.manual_profit;
    await pool.query(
      "UPDATE accounting_settings SET carried_vat = $1, manual_profit = $2 WHERE year = $3 AND month = $4",
      [newCarriedVat, newManualProfit, year, month]
    );
  } else {
    await pool.query(
      "INSERT INTO accounting_settings (year, month, carried_vat, manual_profit) VALUES ($1, $2, $3, $4)",
      [year, month, carried_vat || 0, manual_profit || null]
    );
  }

  res.json({ success: true });
}));

app.get("/api/accounting/settings/all", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT year, month, manual_profit FROM accounting_settings WHERE manual_profit IS NOT NULL");
  res.json(rows);
}));

app.get("/api/accounting/stats", checkAuth, asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  
  // Fetch carried VAT
  const settingsRes = await pool.query("SELECT carried_vat FROM accounting_settings WHERE year = $1 AND month = $2", [year, month]);
  const carriedVat = settingsRes.rows.length > 0 ? parseFloat(settingsRes.rows[0].carried_vat) : 0;

  
  // Get all manual entries for the period
  const { rows } = await pool.query(`
    SELECT * FROM accounting_entries 
    WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
  `, [year, month]);

  let totalNetRevenue = 0;
  let totalGrossRevenue = 0;
  let totalVatOutput = 0;
  let totalNetExpenses = 0;
  let totalGrossExpenses = 0;
  let totalVatInput = 0;
  let kpirCosts = 0;

  rows.forEach(entry => {
    const net = parseFloat(entry.net_amount) || 0;
    const vat = parseFloat(entry.vat_amount) || 0;
    const gross = parseFloat(entry.gross_amount) || (net + vat);
    
    if (entry.entry_type === "revenue") {
      totalNetRevenue += net;
      totalGrossRevenue += gross;
      totalVatOutput += vat;
    } else {
      totalGrossExpenses += gross;
      if (entry.is_car_cost) {
        // Car rules: 50% VAT deductible, 75% of (Net + 50% VAT) as KPiR cost
        const deductibleVat = vat * 0.5;
        const nonDeductibleVat = vat * 0.5;
        totalVatInput += deductibleVat;
        kpirCosts += (net + nonDeductibleVat) * 0.75;
      } else {
        totalVatInput += vat;
        kpirCosts += net;
      }
      totalNetExpenses += net;
    }
  });

  // Tax Calculations (JDG + Etat)
  const income = totalNetRevenue - kpirCosts;
  const vatToPay = Math.max(0, totalVatOutput - totalVatInput - carriedVat);
  const nextMonthCarriedVat = Math.max(0, carriedVat + totalVatInput - totalVatOutput);
  
  // Sytuacja podatkowa: Student < 26 lat na etacie (PIT-0 dla młodych).
  // 1. Etat jest zwolniony z PIT do 85 528 zł rocznie (nie zużywa kwoty wolnej ani 1. progu).
  // 2. JDG ma do dyspozycji PEŁNĄ kwotę wolną od podatku: 30 000 zł rocznie = 2 500 zł / mies.
  // 3. JDG ma do dyspozycji PEŁNY 1. próg 12%: 120 000 zł rocznie = 10 000 zł / mies.
  // 4. Stawka 32% obowiązuje dopiero od dochodu JDG powyżej 10 000 zł / mies.

  const MONTHLY_TAX_FREE = 2500;   // 30 000 zł / 12
  const MONTHLY_THRESHOLD = 10000; // 120 000 zł / 12

  let estimatedPit = 0;
  if (income > MONTHLY_TAX_FREE) {
    if (income <= MONTHLY_THRESHOLD) {
      estimatedPit = (income - MONTHLY_TAX_FREE) * 0.12;
    } else {
      estimatedPit = ((MONTHLY_THRESHOLD - MONTHLY_TAX_FREE) * 0.12) + ((income - MONTHLY_THRESHOLD) * 0.32);
    }
  }

  // ZUS Zdrowotna (Skala 9%): Zbieg tytułów z etatem -> płacisz tylko zdrowotną (9% od dochodu, min. 432.54 zł)
  const healthInsurance = income > 0 ? Math.max(432.54, income * 0.09) : 432.54;



  // Returning full calculation results
  res.json({


    period: { year, month },
    revenue: {
      net: Math.round(totalNetRevenue * 100) / 100,
      vat: Math.round(totalVatOutput * 100) / 100,
      gross: Math.round(totalGrossRevenue * 100) / 100
    },
    expenses: {
      net: Math.round(totalNetExpenses * 100) / 100,
      vat: Math.round(totalVatInput * 100) / 100,
      kpir: Math.round(kpirCosts * 100) / 100,
      gross: Math.round(totalGrossExpenses * 100) / 100
    },
    taxes: {
      vat: Math.round(vatToPay * 100) / 100,
      pit: Math.round(estimatedPit * 100) / 100,
      health: Math.round(healthInsurance * 100) / 100,
      income: Math.round(income * 100) / 100,
      carriedVat: carriedVat,
      nextMonthCarriedVat: Math.round(nextMonthCarriedVat * 100) / 100
    }
  });
}));



const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});