const pool = require("../db");

async function ensureDbTablesExist() {
  try {
    console.log("[DB Migration] Verifying KSeF, Offers, Accounting, and Issues tables in PostgreSQL database...");
    
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

      CREATE TABLE IF NOT EXISTS issues (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Performance Optimization: B-Tree Indexes
      CREATE INDEX IF NOT EXISTS idx_ksef_invoices_date ON ksef_invoices(date DESC);
      CREATE INDEX IF NOT EXISTS idx_accounting_entries_date_type ON accounting_entries(date DESC, entry_type);
      CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_offers_client_id ON offers(client_id);
      CREATE INDEX IF NOT EXISTS idx_issues_status_created ON issues(status, created_at DESC);
    `);

    console.log("[DB Migration] All required DB tables and B-Tree indexes verified successfully!");

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

module.exports = { ensureDbTablesExist };
