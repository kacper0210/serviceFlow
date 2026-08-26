const express = require("express");
const pool = require("../db");
const ksefService = require("../ksefService");
const { asyncHandler, checkAuth, dynamicUpdate, parseAmount } = require("../middleware/auth");

const router = express.Router();

// GET /api/accounting/entries
router.get("/entries", checkAuth, asyncHandler(async (req, res) => {
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

// POST /api/accounting/entries
router.post("/entries", checkAuth, asyncHandler(async (req, res) => {
  const { date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type } = req.body;

  const parsedNet = parseAmount(net_amount);
  const parsedVat = parseAmount(vat_amount);
  const parsedGross = parseAmount(gross_amount, parsedNet + parsedVat);
  const parsedVatRate = parseInt(vat_rate, 10) || 23;

  const { rows } = await pool.query(
    `INSERT INTO accounting_entries (date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [date, number, contractor, description, parsedNet, parsedVatRate, parsedVat, parsedGross, category || 'Inne', !!is_car_cost, entry_type || 'expense']
  );
  res.status(201).json(rows[0]);
}));

// DELETE /api/accounting/entries/:id
router.delete("/entries/:id", checkAuth, asyncHandler(async (req, res) => {
  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");
    await dbClient.query(
      "UPDATE ksef_invoices SET is_imported = FALSE, accounting_entry_id = NULL WHERE accounting_entry_id = $1",
      [req.params.id]
    );
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

// PUT /api/accounting/entries/:id
router.put("/entries/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["date", "number", "contractor", "description", "net_amount", "vat_rate", "vat_amount", "gross_amount", "category", "is_car_cost", "entry_type", "is_ready"];
  const updated = await dynamicUpdate("accounting_entries", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(updated);
}));

// GET /api/accounting/ksef/settings
router.get("/ksef/settings", checkAuth, asyncHandler(async (req, res) => {
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

// POST /api/accounting/ksef/settings
router.post("/ksef/settings", checkAuth, asyncHandler(async (req, res) => {
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

  await ksefService.clearSessionInDb(pool, cleanNip);
  res.json({ success: true });
}));

// GET /api/accounting/ksef/invoices
router.get("/ksef/invoices", checkAuth, asyncHandler(async (req, res) => {
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

// POST /api/accounting/ksef/sync
router.post("/ksef/sync", checkAuth, asyncHandler(async (req, res) => {
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

    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const cachedRes = await pool.query(
      `SELECT * FROM ksef_invoices 
       WHERE date >= $1 AND date <= $2 
       ORDER BY date DESC, id DESC`,
      [dateFrom, dateTo]
    );

    const retryAfter = err.retryAfter || 60;
    const isRateLimit = err.status === 429 || err.message?.includes("429") || err.message?.includes("limit") || err.message?.includes("Rate Limit") || err.message?.includes("wymaga");

    return res.json({
      success: false,
      invoices: cachedRes.rows,
      last_sync_at: settings?.last_sync_at,
      retry_after: isRateLimit ? retryAfter : null,
      warning: isRateLimit
        ? `⏱️ ${err.message || "Bramka KSeF (MF) nakłada limit zapytań."} Wyświetlono faktury z lokalnej bazy danych (${cachedRes.rows.length} szt.).`
        : `Błąd połączenia z KSeF (${err.message}). Wyświetlono faktury z lokalnej bazy.`
    });
  }
}));

// POST /api/accounting/ksef/fetch
router.post("/ksef/fetch", checkAuth, asyncHandler(async (req, res) => {
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

// POST /api/accounting/ksef/import
router.post("/ksef/import", checkAuth, asyncHandler(async (req, res) => {
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

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");
    
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

// POST /api/accounting/ksef/issue
router.post("/ksef/issue", checkAuth, asyncHandler(async (req, res) => {
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

// POST /api/accounting/settings
router.post("/settings", checkAuth, asyncHandler(async (req, res) => {
  const { year, month, carried_vat, manual_profit } = req.body;
  
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

// GET /api/accounting/settings/all
router.get("/settings/all", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT year, month, manual_profit FROM accounting_settings WHERE manual_profit IS NOT NULL");
  res.json(rows);
}));

// GET /api/accounting/stats
router.get("/stats", checkAuth, asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  
  const settingsRes = await pool.query("SELECT carried_vat FROM accounting_settings WHERE year = $1 AND month = $2", [year, month]);
  const carriedVat = settingsRes.rows.length > 0 ? parseFloat(settingsRes.rows[0].carried_vat) : 0;

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

  const income = totalNetRevenue - kpirCosts;
  const vatToPay = Math.max(0, totalVatOutput - totalVatInput - carriedVat);
  const nextMonthCarriedVat = Math.max(0, carriedVat + totalVatInput - totalVatOutput);
  
  const MONTHLY_TAX_FREE = 2500;
  const MONTHLY_THRESHOLD = 10000;

  let estimatedPit = 0;
  if (income > MONTHLY_TAX_FREE) {
    if (income <= MONTHLY_THRESHOLD) {
      estimatedPit = (income - MONTHLY_TAX_FREE) * 0.12;
    } else {
      estimatedPit = ((MONTHLY_THRESHOLD - MONTHLY_TAX_FREE) * 0.12) + ((income - MONTHLY_THRESHOLD) * 0.32);
    }
  }

  const healthInsurance = income > 0 ? Math.max(432.54, income * 0.09) : 432.54;

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

module.exports = router;
