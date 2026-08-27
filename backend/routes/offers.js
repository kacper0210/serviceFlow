const express = require("express");
const pool = require("../db");
const { asyncHandler, checkAuth, parseAmount } = require("../middleware/auth");

const router = express.Router();

// GET /api/offers
router.get("/", checkAuth, asyncHandler(async (req, res) => {
  try {
    // Auto-expire offers whose validity date has passed
    await pool.query(`
      UPDATE offers 
      SET status = 'expired' 
      WHERE valid_until IS NOT NULL AND valid_until < CURRENT_DATE AND status IN ('sent', 'draft', 'pending')
    `);

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

// GET /api/offers/:id
router.get("/:id", checkAuth, asyncHandler(async (req, res) => {
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

// POST /api/offers
router.post("/", checkAuth, asyncHandler(async (req, res) => {
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

// PUT /api/offers/:id
router.put("/:id", checkAuth, asyncHandler(async (req, res) => {
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

// DELETE /api/offers/:id
router.delete("/:id", checkAuth, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM offer_items WHERE offer_id = $1", [req.params.id]);
    const { rowCount } = await client.query("DELETE FROM offers WHERE id = $1", [req.params.id]);
    
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nie znaleziono oferty" });
    }
    
    await client.query("COMMIT");
    res.json({ message: "Oferta została usunięta" });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/offers/:id/convert
router.post("/:id/convert", checkAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const offerRes = await client.query("SELECT * FROM offers WHERE id = $1", [id]);
    if (offerRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nie znaleziono oferty" });
    }
    const offer = offerRes.rows[0];
    
    const description = offer.description 
      ? `${offer.description}\n\n(Przekonwertowano z oferty #${offer.id})` 
      : `Zlecenie utworzone automatycznie z oferty #${offer.id}`;
    
    const orderRes = await client.query(
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
    
    await client.query("UPDATE offers SET status = 'zaakceptowana', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    
    await client.query("COMMIT");
    res.status(201).json({ order: orderRes.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
