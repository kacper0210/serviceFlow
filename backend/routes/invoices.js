const express = require('express');
const router = express.Router();
const pool = require('../db');
const kwotaSlownie = require('../utils/kwotaSlownie');
const { checkAuth } = require('../middleware/auth');

// Helper to calculate VAT breakdown & totals
function calculateTotalsAndBreakdown(items) {
  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;

  const vatMap = new Map();

  const processedItems = items.map((item, index) => {
    const qty = parseFloat(item.quantity) || 1;
    const unitPriceNet = parseFloat(item.unit_price_net) || 0;
    const vatRate = parseInt(item.vat_rate, 10) || 23;

    const net = Math.round(qty * unitPriceNet * 100) / 100;
    const vat = Math.round(net * (vatRate / 100) * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;

    totalNet += net;
    totalVat += vat;
    totalGross += gross;

    // Group by VAT rate
    const currentRate = vatMap.get(vatRate) || { vatRate, net: 0, vat: 0, gross: 0 };
    currentRate.net += net;
    currentRate.vat += vat;
    currentRate.gross += gross;
    vatMap.set(vatRate, currentRate);

    return {
      lp: index + 1,
      name: item.name || 'Usługa/Towar',
      quantity: qty,
      unit: item.unit || 'szt.',
      unit_price_net: unitPriceNet,
      vat_rate: vatRate,
      net_amount: net,
      vat_amount: vat,
      gross_amount: gross
    };
  });

  // Convert map to array sorted by VAT rate desc
  const vatBreakdown = Array.from(vatMap.values()).sort((a, b) => b.vatRate - a.vatRate);

  return {
    items: processedItems,
    vatBreakdown,
    totalNet: Math.round(totalNet * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100
  };
}

// -------------------------------------------------------------
// GET /api/invoices/seller-settings
// -------------------------------------------------------------
router.get('/seller-settings', checkAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM seller_settings ORDER BY id ASC LIMIT 1');
    if (result.rows.length === 0) {
      const defaultSeller = await pool.query(`
        INSERT INTO seller_settings (company_name, address_line1, address_line2, nip, bank_account)
        VALUES ('KMTechFix Kacper Wójcik', 'ul. Koszalińska 12 / 1', '78-230 Karlino', '6722109643', '83 1140 2004 0000 3302 8526 9999')
        RETURNING *
      `);
      return res.json(defaultSeller.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// PUT /api/invoices/seller-settings
// -------------------------------------------------------------
router.put('/seller-settings', checkAuth, async (req, res, next) => {
  try {
    const { company_name, address_line1, address_line2, nip, bank_account, logo_url } = req.body;
    
    const existing = await pool.query('SELECT id FROM seller_settings LIMIT 1');
    let result;
    if (existing.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO seller_settings (company_name, address_line1, address_line2, nip, bank_account, logo_url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [company_name, address_line1, address_line2, nip, bank_account, logo_url]
      );
    } else {
      result = await pool.query(
        `UPDATE seller_settings SET
           company_name = $1, address_line1 = $2, address_line2 = $3,
           nip = $4, bank_account = $5, logo_url = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [company_name, address_line1, address_line2, nip, bank_account, logo_url, existing.rows[0].id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/invoices/next-number
// -------------------------------------------------------------
router.get('/next-number', checkAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM invoices 
       WHERE EXTRACT(MONTH FROM issue_date) = $1 AND EXTRACT(YEAR FROM issue_date) = $2`,
      [month, year]
    );

    let nextCount = parseInt(countResult.rows[0].count, 10) + 1;
    let suggestedNumber = `A${nextCount}/${month}/${year}`;

    // Ensure suggested number is unique
    while (true) {
      const check = await pool.query('SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1', [suggestedNumber]);
      if (check.rows.length === 0) {
        break;
      }
      nextCount++;
      suggestedNumber = `A${nextCount}/${month}/${year}`;
    }

    res.json({ suggestedNumber, month, year, count: nextCount });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/invoices - List invoices
// -------------------------------------------------------------
router.get('/', checkAuth, async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT i.*, 
             (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) as items_count
      FROM invoices i
    `;
    const params = [];

    if (search) {
      query += ` WHERE i.invoice_number ILIKE $1 OR i.buyer_name ILIKE $1 OR i.buyer_nip ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY i.issue_date DESC, i.id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/invoices/:id - Invoice details
// -------------------------------------------------------------
router.get('/:id', checkAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const invRes = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono faktury' });
    }

    const invoice = invRes.rows[0];
    const itemsRes = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY lp ASC', [id]);
    
    const items = itemsRes.rows;
    const { vatBreakdown } = calculateTotalsAndBreakdown(items);

    res.json({
      ...invoice,
      kwota_slownie: kwotaSlownie(invoice.total_gross),
      items,
      vatBreakdown
    });
  } catch (err) {
    next(err);
  }
});

// Helper to upsert client into shared clients table
async function upsertClient(dbClient, data) {
  const { buyer_id, buyer_name, buyer_nip, finalBuyerAddress, buyer_street, buyer_house_no, buyer_apt_no, buyer_postal_code, buyer_city } = data;
  if (!buyer_name) return null;

  let clientId = buyer_id ? parseInt(buyer_id, 10) : null;

  if (clientId) {
    await dbClient.query(`
      UPDATE clients SET
        company_name = COALESCE(NULLIF($1, ''), company_name),
        nip = COALESCE(NULLIF($2, ''), nip),
        address = COALESCE(NULLIF($3, ''), address),
        street = COALESCE(NULLIF($4, ''), street),
        house_no = COALESCE(NULLIF($5, ''), house_no),
        apt_no = COALESCE(NULLIF($6, ''), apt_no),
        postal_code = COALESCE(NULLIF($7, ''), postal_code),
        city = COALESCE(NULLIF($8, ''), city)
      WHERE id = $9
    `, [buyer_name, buyer_nip, finalBuyerAddress, buyer_street, buyer_house_no, buyer_apt_no, buyer_postal_code, buyer_city, clientId]);
    return clientId;
  }

  if (buyer_nip) {
    const checkNip = await dbClient.query('SELECT id FROM clients WHERE nip = $1 LIMIT 1', [buyer_nip]);
    if (checkNip.rows.length > 0) {
      clientId = checkNip.rows[0].id;
      await dbClient.query(`
        UPDATE clients SET
          company_name = COALESCE(NULLIF($1, ''), company_name),
          address = COALESCE(NULLIF($2, ''), address),
          street = COALESCE(NULLIF($3, ''), street),
          house_no = COALESCE(NULLIF($4, ''), house_no),
          apt_no = COALESCE(NULLIF($5, ''), apt_no),
          postal_code = COALESCE(NULLIF($6, ''), postal_code),
          city = COALESCE(NULLIF($7, ''), city)
        WHERE id = $8
      `, [buyer_name, finalBuyerAddress, buyer_street, buyer_house_no, buyer_apt_no, buyer_postal_code, buyer_city, clientId]);
      return clientId;
    }
  }

  const checkName = await dbClient.query('SELECT id FROM clients WHERE company_name ILIKE $1 OR CONCAT(first_name, \' \', last_name) ILIKE $1 LIMIT 1', [buyer_name]);
  if (checkName.rows.length > 0) {
    return checkName.rows[0].id;
  }

  const isCompany = !!buyer_nip || buyer_name.toLowerCase().includes('sp.') || buyer_name.toLowerCase().includes('spółka') || buyer_name.toLowerCase().includes('wspólnota') || buyer_name.toLowerCase().includes('z o.o.');
  const insertRes = await dbClient.query(`
    INSERT INTO clients (type, company_name, first_name, last_name, nip, address, street, house_no, apt_no, postal_code, city)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [
    isCompany ? 'company' : 'person',
    isCompany ? buyer_name : null,
    !isCompany ? buyer_name.split(' ')[0] : null,
    !isCompany ? buyer_name.split(' ').slice(1).join(' ') : null,
    buyer_nip || null,
    finalBuyerAddress || null,
    buyer_street || null,
    buyer_house_no || null,
    buyer_apt_no || null,
    buyer_postal_code || null,
    buyer_city || null
  ]);

  return insertRes.rows[0].id;
}

// -------------------------------------------------------------
// POST /api/invoices - Create Invoice
// -------------------------------------------------------------
router.post('/', checkAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      invoice_number,
      issue_date,
      sale_date,
      payment_deadline,
      payment_method = 'przelew',
      bank_account,
      seller_name,
      seller_nip,
      seller_address,
      buyer_name,
      buyer_nip,
      buyer_address,
      buyer_street,
      buyer_house_no,
      buyer_apt_no,
      buyer_postal_code,
      buyer_city,
      buyer_id,
      order_id,
      offer_id,
      notes,
      transaction_description,
      split_payment = false,
      items = []
    } = req.body;

    if (!invoice_number || !buyer_name || !issue_date || !sale_date || !payment_deadline) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Brak wymaganych pól faktury (numer, data wystawienia, data sprzedaży, nabywca).' });
    }

    // Assemble formatted address if separate fields provided
    let finalBuyerAddress = buyer_address;
    if (buyer_street || buyer_city) {
      const streetPart = buyer_street ? `ul. ${buyer_street} ${buyer_house_no || ''}${buyer_apt_no ? '/' + buyer_apt_no : ''}`.trim() : '';
      const cityPart = `${buyer_postal_code || ''} ${buyer_city || ''}`.trim();
      finalBuyerAddress = [streetPart, cityPart].filter(Boolean).join('\n');
    }

    // Upsert client into shared clients database
    const finalBuyerId = await upsertClient(client, {
      buyer_id, buyer_name, buyer_nip, finalBuyerAddress, buyer_street, buyer_house_no, buyer_apt_no, buyer_postal_code, buyer_city
    });

    // Process items & calculate sums
    const { items: processedItems, totalNet, totalVat, totalGross } = calculateTotalsAndBreakdown(items);

    // Get default seller settings if not provided
    let finalSellerName = seller_name;
    let finalSellerNip = seller_nip;
    let finalSellerAddress = seller_address;
    let finalBankAccount = bank_account;

    if (!finalSellerName || !finalBankAccount) {
      const sellerRes = await client.query('SELECT * FROM seller_settings LIMIT 1');
      if (sellerRes.rows.length > 0) {
        const s = sellerRes.rows[0];
        finalSellerName = finalSellerName || s.company_name;
        finalSellerNip = finalSellerNip || s.nip;
        finalSellerAddress = finalSellerAddress || `${s.address_line1}, ${s.address_line2}`;
        finalBankAccount = finalBankAccount || s.bank_account;
      }
    }

    const insertInvSql = `
      INSERT INTO invoices (
        invoice_number, issue_date, sale_date, payment_deadline, payment_method,
        bank_account, seller_name, seller_nip, seller_address,
        buyer_name, buyer_nip, buyer_address, buyer_street, buyer_house_no, buyer_apt_no, buyer_postal_code, buyer_city,
        buyer_id, order_id, offer_id, notes, transaction_description, split_payment, total_net, total_vat, total_gross
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *
    `;

    const invValues = [
      invoice_number, issue_date, sale_date, payment_deadline, payment_method,
      finalBankAccount, finalSellerName, finalSellerNip, finalSellerAddress,
      buyer_name, buyer_nip || null, finalBuyerAddress || null,
      buyer_street || null, buyer_house_no || null, buyer_apt_no || null, buyer_postal_code || null, buyer_city || null,
      finalBuyerId || null, order_id || null, offer_id || null,
      notes || null, transaction_description || null, split_payment || false, totalNet, totalVat, totalGross
    ];

    const invResult = await client.query(insertInvSql, invValues);
    const newInvoice = invResult.rows[0];

    // Insert items
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, lp, name, quantity, unit, unit_price_net, vat_rate, net_amount, vat_amount, gross_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [newInvoice.id, item.lp, item.name, item.quantity, item.unit, item.unit_price_net, item.vat_rate, item.net_amount, item.vat_amount, item.gross_amount]
      );
    }

    // Auto-create accounting entry for revenue
    await client.query(
      `INSERT INTO accounting_entries (entry_type, date, number, contractor, net_amount, vat_rate, vat_amount, gross_amount, category, is_ready, description)
       VALUES ('revenue', $1, $2, $3, $4, 23, $5, $6, 'Sprzedaż', TRUE, $7)`,
      [issue_date, invoice_number, buyer_name, totalNet, totalVat, totalGross, transaction_description || `Faktura sprzedaży ${invoice_number}`]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ...newInvoice,
      items: processedItems,
      kwota_slownie: kwotaSlownie(totalGross)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ error: `Faktura o numerze "${req.body.invoice_number}" już istnieje. Proszę zmienić numer.` });
    }
    next(err);
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// PUT /api/invoices/:id - Edit Invoice
// -------------------------------------------------------------
router.put('/:id', checkAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const {
      invoice_number,
      issue_date,
      sale_date,
      payment_deadline,
      payment_method = 'przelew',
      bank_account,
      seller_name,
      seller_nip,
      seller_address,
      buyer_name,
      buyer_nip,
      buyer_address,
      buyer_street,
      buyer_house_no,
      buyer_apt_no,
      buyer_postal_code,
      buyer_city,
      buyer_id,
      notes,
      transaction_description,
      split_payment = false,
      items = []
    } = req.body;

    let finalBuyerAddress = buyer_address;
    if (buyer_street || buyer_city) {
      const streetPart = buyer_street ? `ul. ${buyer_street} ${buyer_house_no || ''}${buyer_apt_no ? '/' + buyer_apt_no : ''}`.trim() : '';
      const cityPart = `${buyer_postal_code || ''} ${buyer_city || ''}`.trim();
      finalBuyerAddress = [streetPart, cityPart].filter(Boolean).join('\n');
    }

    const finalBuyerId = await upsertClient(client, {
      buyer_id, buyer_name, buyer_nip, finalBuyerAddress, buyer_street, buyer_house_no, buyer_apt_no, buyer_postal_code, buyer_city
    });

    const { items: processedItems, totalNet, totalVat, totalGross } = calculateTotalsAndBreakdown(items);

    const updateSql = `
      UPDATE invoices SET
        invoice_number = $1, issue_date = $2, sale_date = $3, payment_deadline = $4,
        payment_method = $5, bank_account = $6, seller_name = $7, seller_nip = $8,
        seller_address = $9, buyer_name = $10, buyer_nip = $11, buyer_address = $12,
        buyer_street = $13, buyer_house_no = $14, buyer_apt_no = $15, buyer_postal_code = $16, buyer_city = $17,
        buyer_id = $18, notes = $19, transaction_description = $20, split_payment = $21,
        total_net = $22, total_vat = $23, total_gross = $24,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $25 RETURNING *
    `;

    const invResult = await client.query(updateSql, [
      invoice_number, issue_date, sale_date, payment_deadline, payment_method,
      bank_account, seller_name, seller_nip, seller_address, buyer_name,
      buyer_nip, finalBuyerAddress, buyer_street || null, buyer_house_no || null, buyer_apt_no || null, buyer_postal_code || null, buyer_city || null,
      finalBuyerId || null, notes || null, transaction_description || null, split_payment || false,
      totalNet, totalVat, totalGross, id
    ]);

    if (invResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nie znaleziono faktury' });
    }

    // Delete existing items and re-insert
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, lp, name, quantity, unit, unit_price_net, vat_rate, net_amount, vat_amount, gross_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, item.lp, item.name, item.quantity, item.unit, item.unit_price_net, item.vat_rate, item.net_amount, item.vat_amount, item.gross_amount]
      );
    }

    // Update corresponding accounting entry if exists
    await client.query(
      `UPDATE accounting_entries SET date = $1, contractor = $2, net_amount = $3, vat_amount = $4, gross_amount = $5
       WHERE number = $6 AND entry_type = 'revenue'`,
      [issue_date, buyer_name, totalNet, totalVat, totalGross, invoice_number]
    );

    await client.query('COMMIT');
    res.json({
      ...invResult.rows[0],
      items: processedItems,
      kwota_slownie: kwotaSlownie(totalGross)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// DELETE /api/invoices/:id
// -------------------------------------------------------------
router.delete('/:id', checkAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const invRes = await pool.query('SELECT invoice_number FROM invoices WHERE id = $1', [id]);
    if (invRes.rows.length > 0) {
      const invNo = invRes.rows[0].invoice_number;
      await pool.query('DELETE FROM accounting_entries WHERE number = $1 AND entry_type = \'revenue\'', [invNo]);
    }
    await pool.query('DELETE FROM invoices WHERE id = $1', [id]);
    res.json({ success: true, message: 'Faktura została usunięta.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
