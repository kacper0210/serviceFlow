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

      CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        creditor VARCHAR(255) NOT NULL,
        total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        monthly_installment NUMERIC(12, 2) DEFAULT 0.00,
        capital_installment NUMERIC(12, 2) DEFAULT 0.00,
        interest_installment NUMERIC(12, 2) DEFAULT 0.00,
        due_day INTEGER DEFAULT 10,
        is_paid_this_month BOOLEAN DEFAULT FALSE,
        last_paid_date DATE,
        interest_notes TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE debts ADD COLUMN IF NOT EXISTS capital_installment NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS interest_installment NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS is_paid_this_month BOOLEAN DEFAULT FALSE;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS last_paid_date DATE;

      CREATE TABLE IF NOT EXISTS debt_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL UNIQUE,
        total_debt NUMERIC(12, 2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS debt_payments (
        id SERIAL PRIMARY KEY,
        debt_id INT REFERENCES debts(id) ON DELETE CASCADE,
        creditor VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        capital_amount NUMERIC(12, 2) DEFAULT 0.00,
        interest_amount NUMERIC(12, 2) DEFAULT 0.00,
        due_date DATE NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS fixed_expenses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        due_day INTEGER DEFAULT 10,
        category VARCHAR(100) DEFAULT 'Stałe',
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS is_paid_this_month BOOLEAN DEFAULT FALSE;
      ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS last_paid_date DATE;

      CREATE TABLE IF NOT EXISTS pending_bills (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        due_date DATE NOT NULL,
        invoice_number VARCHAR(100),
        is_paid BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMP,
        category VARCHAR(100) DEFAULT 'Inne',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS debt_schedules (
        id SERIAL PRIMARY KEY,
        debt_id INT REFERENCES debts(id) ON DELETE CASCADE,
        installment_number INT NOT NULL,
        due_date DATE NOT NULL,
        total_installment NUMERIC(12, 2) NOT NULL,
        capital_part NUMERIC(12, 2) NOT NULL,
        interest_part NUMERIC(12, 2) NOT NULL,
        remaining_balance NUMERIC(12, 2) NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Performance Optimization: B-Tree Indexes
      CREATE INDEX IF NOT EXISTS idx_ksef_invoices_date ON ksef_invoices(date DESC);
      CREATE INDEX IF NOT EXISTS idx_accounting_entries_date_type ON accounting_entries(date DESC, entry_type);
      CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_offers_client_id ON offers(client_id);
      CREATE INDEX IF NOT EXISTS idx_issues_status_created ON issues(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_debts_creditor ON debts(creditor);
      CREATE INDEX IF NOT EXISTS idx_debt_snapshots_date ON debt_snapshots(snapshot_date DESC);
      CREATE INDEX IF NOT EXISTS idx_debt_payments_due ON debt_payments(due_date DESC, is_paid);
      CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON fixed_expenses(is_active);
      CREATE INDEX IF NOT EXISTS idx_pending_bills_due ON pending_bills(due_date DESC, is_paid);
      CREATE INDEX IF NOT EXISTS idx_debt_schedules_debt ON debt_schedules(debt_id, installment_number);
    `);

    console.log("[DB Migration] All required DB tables and B-Tree indexes verified successfully!");

    // Seed debts data matching Excel sheet if debts table is empty
    await seedInitialDebts();

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

async function seedInitialDebts() {
  try {
    const existingDebts = await pool.query("SELECT COUNT(*) FROM debts");
    if (parseInt(existingDebts.rows[0].count, 10) === 0) {
      console.log("[Auto-Seed] Seeding initial debts matching Excel spreadsheet...");
      
      const initialDebts = [
        { creditor: "TATA", total: 400.00, installment: 0.00, capital: 0.00, interest: 0.00, dueDay: null },
        { creditor: "WONGA", total: 1657.00, installment: 75.18, capital: 0.00, interest: 0.00, dueDay: 21 },
        { creditor: "PKO BP limit", total: 3500.00, installment: 0.00, capital: 0.00, interest: 0.00, dueDay: 10 },
        { creditor: "MAMA KREDYT", total: 6402.91, installment: 397.98, capital: 319.77, interest: 78.21, dueDay: 2 },
        { creditor: "MARCELA KREDYT", total: 8289.00, installment: 415.39, capital: 315.23, interest: 100.16, dueDay: 10 },
        { creditor: "Smartney", total: 15000.00, installment: 615.56, capital: 401.04, interest: 214.52, dueDay: 28 },
        { creditor: "PKO BP kredyt", total: 31642.61, installment: 691.52, capital: 302.27, interest: 389.25, dueDay: 15 },
        { creditor: "Mama", total: 1200.00, installment: 0.00, capital: 0.00, interest: 0.00, dueDay: null }
      ];

      for (const d of initialDebts) {
        await pool.query(
          "INSERT INTO debts (creditor, total_amount, monthly_installment, capital_installment, interest_installment, due_day) VALUES ($1, $2, $3, $4, $5, $6)",
          [d.creditor, d.total, d.installment, d.capital, d.interest, d.dueDay]
        );
      }
    }

    const existingSnapshots = await pool.query("SELECT COUNT(*) FROM debt_snapshots");
    if (parseInt(existingSnapshots.rows[0].count, 10) === 0) {
      const historicalSnapshots = [
        { date: '2025-11-01', total: 82000.00 },
        { date: '2025-12-01', total: 75160.00 },
        { date: '2026-01-01', total: 75325.00 },
        { date: '2026-02-01', total: 75652.00 },
        { date: '2026-02-10', total: 74700.00 },
        { date: '2026-03-10', total: 70500.00 },
        { date: '2026-04-10', total: 72349.00 },
        { date: '2026-05-10', total: 73540.00 },
        { date: '2026-06-10', total: 73091.00 },
        { date: '2026-06-15', total: 66298.00 },
        { date: '2026-07-15', total: 69287.34 }
      ];

      for (const s of historicalSnapshots) {
        await pool.query(
          "INSERT INTO debt_snapshots (snapshot_date, total_debt) VALUES ($1, $2) ON CONFLICT (snapshot_date) DO NOTHING",
          [s.date, s.total]
        );
      }
    }

    const existingPayments = await pool.query("SELECT COUNT(*) FROM debt_payments");
    if (parseInt(existingPayments.rows[0].count, 10) === 0) {
      const initialPayments = [
        { creditor: "MAMA", amount: 200.00, capital: 200.00, interest: 0.00, dueDate: "2026-06-12", isPaid: true },
        { creditor: "Smartney", amount: 615.56, capital: 401.04, interest: 214.52, dueDate: "2026-08-28", isPaid: false },
        { creditor: "PKO BP kredyt", amount: 691.52, capital: 302.27, interest: 389.25, dueDate: "2026-08-15", isPaid: true },
        { creditor: "MARCELA KREDYT", amount: 415.39, capital: 315.23, interest: 100.16, dueDate: "2026-08-10", isPaid: true },
        { creditor: "MAMA KREDYT", amount: 397.98, capital: 319.77, interest: 78.21, dueDate: "2026-08-02", isPaid: false },
        { creditor: "WONGA", amount: 75.18, capital: 75.18, interest: 0.00, dueDate: "2026-08-21", isPaid: true }
      ];

      for (const p of initialPayments) {
        await pool.query(
          "INSERT INTO debt_payments (creditor, amount, capital_amount, interest_amount, due_date, is_paid) VALUES ($1, $2, $3, $4, $5, $6)",
          [p.creditor, p.amount, p.capital, p.interest, p.dueDate, p.isPaid]
        );
      }
    }

    const existingFixed = await pool.query("SELECT COUNT(*) FROM fixed_expenses");
    if (parseInt(existingFixed.rows[0].count, 10) === 0) {
      const initialFixed = [
        { name: "T-Mobile", amount: 306.00, dueDay: 23, category: "Telefony" },
        { name: "Księgowość (Usługi księgowej)", amount: 366.00, dueDay: 14, category: "Księgowość" },
        { name: "Garaż wynajem", amount: 300.00, dueDay: 10, category: "Stałe" },
        { name: "ZUS", amount: 423.00, dueDay: 20, category: "Stałe" },
        { name: "Leasing laptopa", amount: 172.00, dueDay: 10, category: "Stałe" }
      ];

      for (const f of initialFixed) {
        await pool.query(
          "INSERT INTO fixed_expenses (name, amount, due_day, category) VALUES ($1, $2, $3, $4)",
          [f.name, f.amount, f.dueDay, f.category]
        );
      }
    }

    const existingIncomes = await pool.query("SELECT COUNT(*) FROM fixed_incomes");
    if (parseInt(existingIncomes.rows[0].count, 10) === 0) {
      const initialIncomes = [
        { name: "Wypłata ze Szpitala", amount: 5497.00, dueDay: 10, category: "Stały przychód" },
        { name: "Obsługa TSPack", amount: 600.00, dueDay: 10, category: "Stały przychód" },
        { name: "Obsługa monitoringu na Dworcowej", amount: 162.00, dueDay: 10, category: "Stały przychód" }
      ];

      for (const inc of initialIncomes) {
        await pool.query(
          "INSERT INTO fixed_incomes (name, amount, due_day, category) VALUES ($1, $2, $3, $4)",
          [inc.name, inc.amount, inc.dueDay, inc.category]
        );
      }
    }

    const existingPending = await pool.query("SELECT COUNT(*) FROM pending_bills");
    if (parseInt(existingPending.rows[0].count, 10) === 0) {
      const initialPending = [
        { title: "Faktura T-Mobile za sierpień", amount: 120.00, dueDate: "2026-09-15", invNo: "FV/TM/2026/08", category: "Telefony", isPaid: false },
        { title: "Rozliczenie Księgowej za lipiec", amount: 350.00, dueDate: "2026-09-20", invNo: "FV/KS/07/2026", category: "Księgowość", isPaid: false },
        { title: "Faktura za materiały (Hurtownia)", amount: 480.50, dueDate: "2026-09-05", invNo: "FA/1092/2026", category: "Materiały", isPaid: true }
      ];

      for (const pb of initialPending) {
        await pool.query(
          "INSERT INTO pending_bills (title, amount, due_date, invoice_number, category, is_paid) VALUES ($1, $2, $3, $4, $5, $6)",
          [pb.title, pb.amount, pb.dueDate, pb.invNo, pb.category, pb.isPaid]
        );
      }
    }

    // Seed 42 Smartney schedule installments
    await seedSmartneySchedule(pool);
  } catch (err) {
    console.error("[Auto-Seed Error] Failed to seed initial debts:", err);
  }
}

async function seedSmartneySchedule(pool) {
  try {
    const smartneyRes = await pool.query("SELECT id FROM debts WHERE UPPER(creditor) LIKE '%SMARTNEY%' LIMIT 1");
    let debtId;
    if (smartneyRes.rows.length === 0) {
      const insRes = await pool.query(
        "INSERT INTO debts (creditor, total_amount, monthly_installment, capital_installment, interest_installment, due_day) VALUES ('Smartney', 15000.00, 615.56, 401.04, 214.52, 28) RETURNING id"
      );
      debtId = insRes.rows[0].id;
    } else {
      debtId = smartneyRes.rows[0].id;
      await pool.query(
        "UPDATE debts SET monthly_installment = 615.56, capital_installment = 401.04, interest_installment = 214.52, due_day = 28 WHERE id = $1",
        [debtId]
      );
    }

    const existingSched = await pool.query("SELECT COUNT(*) FROM debt_schedules WHERE debt_id = $1", [debtId]);
    if (parseInt(existingSched.rows[0].count, 10) === 0) {
      console.log(`[Auto-Seed] Seeding 42 schedule installments for Smartney (Debt ID: ${debtId})...`);
      const smartneyScheduleData = [
        { num: 1, date: "2026-08-28", total: 615.56, cap: 401.04, int: 214.52, rem: 25249.43 },
        { num: 2, date: "2026-09-28", total: 615.56, cap: 433.84, int: 181.72, rem: 24633.87 },
        { num: 3, date: "2026-10-28", total: 615.56, cap: 443.00, int: 172.56, rem: 24018.31 },
        { num: 4, date: "2026-11-28", total: 615.56, cap: 440.77, int: 174.79, rem: 23402.75 },
        { num: 5, date: "2026-12-28", total: 615.56, cap: 449.78, int: 165.78, rem: 22787.19 },
        { num: 6, date: "2027-01-28", total: 615.56, cap: 447.86, int: 167.70, rem: 22171.63 },
        { num: 7, date: "2027-02-28", total: 615.56, cap: 451.44, int: 164.12, rem: 21556.07 },
        { num: 8, date: "2027-03-28", total: 615.56, cap: 470.60, int: 144.96, rem: 20940.51 },
        { num: 9, date: "2027-04-28", total: 615.56, cap: 458.93, int: 156.63, rem: 20324.95 },
        { num: 10, date: "2027-05-28", total: 615.56, cap: 467.58, int: 147.98, rem: 19709.39 },
        { num: 11, date: "2027-06-28", total: 615.56, cap: 466.47, int: 149.09, rem: 19093.83 },
        { num: 12, date: "2027-07-28", total: 615.56, cap: 474.96, int: 140.60, rem: 18478.27 },
        { num: 13, date: "2027-08-28", total: 615.56, cap: 474.19, int: 141.37, rem: 17862.71 },
        { num: 14, date: "2027-09-28", total: 615.56, cap: 478.09, int: 137.47, rem: 17247.15 },
        { num: 15, date: "2027-10-28", total: 615.56, cap: 486.35, int: 129.21, rem: 16631.59 },
        { num: 16, date: "2027-11-28", total: 615.56, cap: 486.10, int: 129.46, rem: 16016.03 },
        { num: 17, date: "2027-12-28", total: 615.56, cap: 494.20, int: 121.36, rem: 15400.47 },
        { num: 18, date: "2028-01-28", total: 615.56, cap: 494.30, int: 121.26, rem: 14784.91 },
        { num: 19, date: "2028-02-28", total: 615.56, cap: 498.46, int: 117.10, rem: 14169.35 },
        { num: 20, date: "2028-03-28", total: 615.56, cap: 509.94, int: 105.62, rem: 13553.79 },
        { num: 21, date: "2028-04-28", total: 615.56, cap: 507.00, int: 108.56, rem: 12938.23 },
        { num: 22, date: "2028-05-28", total: 615.56, cap: 514.68, int: 100.88, rem: 12322.67 },
        { num: 23, date: "2028-06-28", total: 615.56, cap: 515.72, int: 99.84, rem: 11707.11 },
        { num: 24, date: "2028-07-28", total: 615.56, cap: 523.21, int: 92.35, rem: 11091.55 },
        { num: 25, date: "2028-08-28", total: 615.56, cap: 524.64, int: 90.92, rem: 10475.99 },
        { num: 26, date: "2028-09-28", total: 615.56, cap: 529.17, int: 86.39, rem: 9860.43 },
        { num: 27, date: "2028-10-28", total: 615.56, cap: 536.39, int: 79.17, rem: 9244.87 },
        { num: 28, date: "2028-11-28", total: 615.56, cap: 538.42, int: 77.14, rem: 8629.31 },
        { num: 29, date: "2028-12-28", total: 615.56, cap: 545.45, int: 70.11, rem: 8013.75 },
        { num: 30, date: "2029-01-28", total: 615.56, cap: 547.90, int: 67.66, rem: 7398.19 },
        { num: 31, date: "2029-02-28", total: 615.56, cap: 552.71, int: 62.85, rem: 6782.63 },
        { num: 32, date: "2029-03-28", total: 615.56, cap: 563.19, int: 52.37, rem: 6167.07 },
        { num: 33, date: "2029-04-28", total: 615.56, cap: 562.58, int: 52.98, rem: 5551.51 },
        { num: 34, date: "2029-05-28", total: 615.56, cap: 569.12, int: 46.44, rem: 4935.95 },
        { num: 35, date: "2029-06-28", total: 615.56, cap: 572.65, int: 42.91, rem: 4320.39 },
        { num: 36, date: "2029-07-28", total: 615.56, cap: 578.98, int: 36.58, rem: 3704.83 },
        { num: 37, date: "2029-08-28", total: 615.56, cap: 582.96, int: 32.60, rem: 3089.27 },
        { num: 38, date: "2029-09-28", total: 615.56, cap: 588.20, int: 27.36, rem: 2473.71 },
        { num: 39, date: "2029-10-28", total: 615.56, cap: 594.22, int: 21.34, rem: 1858.15 },
        { num: 40, date: "2029-11-28", total: 615.56, cap: 598.89, int: 16.67, rem: 1242.59 },
        { num: 41, date: "2029-12-28", total: 615.56, cap: 604.70, int: 10.86, rem: 627.03 },
        { num: 42, date: "2030-01-28", total: 627.03, cap: 621.32, int: 5.71, rem: 0.00 }
      ];

      for (const row of smartneyScheduleData) {
        await pool.query(
          `INSERT INTO debt_schedules (debt_id, installment_number, due_date, total_installment, capital_part, interest_part, remaining_balance)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [debtId, row.num, row.date, row.total, row.cap, row.int, row.rem]
        );
      }
      console.log(`[Auto-Seed] Successfully inserted 42 Smartney schedule installments!`);
    }
  } catch (err) {
    console.error("[Auto-Seed Schedule Error]", err);
  }
}

module.exports = { ensureDbTablesExist };
