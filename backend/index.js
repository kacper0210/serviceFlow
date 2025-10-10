const pool = require("./db");
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/db-test', async (req, res) => {
  try{
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err){
    console.error(err);
    res.status(500).json({ error: "Błąd połączenia z bazą"});
  }
});

//Pobieranie wszystkich klientów

app.get("/api/clients", async (req, res) => {
  try {
    //zapytanie SQL - wszyscy klienci
    const result = await pool.query("SELECT * FROM clients ORDER BY id ASC");

    //wynik w formacie json wyslany do klienta
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Błąd pobierania danych klientów"});
  }
});

//dodanie klienta
app.post("/api/clients", async (req, res) => {
  try{
    const {first_name, last_name, phone, email, nip, address, type, company_name} = req.body;

    const result = await pool.query(
      `INSERT INTO clients 
      (first_name, last_name, phone, email, nip, address, type, company_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [first_name, last_name, phone, email, nip, address, type, company_name]
    );

    res.status(201).json(result.rows[0]);
  }catch (err){
    console.error(err);
    res.status(500).json({ error: "Błąd dodawnia klienta"});
  }
});

//GET zleceń

// 📦 Pobieranie zleceń z możliwością filtrowania, wyszukiwania i sortowania
app.get("/api/orders", async (req, res) => {
  try {
    const { status, search, sort } = req.query;

    let query = `
      SELECT 
        o.*,
        c.first_name,
        c.last_name,
        c.phone,
        c.email
      FROM orders o
      JOIN clients c ON o.client_id = c.id
    `;

    const conditions = [];
    const params = [];

    // 🔹 Filtrowanie po statusie
    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    // 🔍 Wyszukiwanie po tytule, opisie lub nazwisku klienta
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`
        (
          o.title ILIKE $${params.length} OR
          o.description ILIKE $${params.length} OR
          c.first_name ILIKE $${params.length} OR
          c.last_name ILIKE $${params.length}
        )
      `);
    }

    // Jeśli są warunki, dodaj WHERE
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // 🔁 Sortowanie
    switch (sort) {
      case "deadline_asc":
        query += " ORDER BY o.deadline ASC";
        break;
      case "deadline_desc":
        query += " ORDER BY o.deadline DESC";
        break;
      case "price_asc":
        query += " ORDER BY o.price ASC";
        break;
      case "price_desc":
        query += " ORDER BY o.price DESC";
        break;
      case "newest":
        query += " ORDER BY o.created_at DESC";
        break;
      case "oldest":
        query += " ORDER BY o.created_at ASC";
        break;
      default:
        query += " ORDER BY o.id ASC";
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd pobierania zleceń z filtrowaniem" });
  }
});



//POST zleceń
app.post("/api/orders", async (req, res) => {
  try {
    const { title, description, status, due_date, price, notes, client_id } = req.body;

    const result = await pool.query(
    `INSERT INTO orders
    (title, description, status, price, notes, client_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [title, description, status, price, notes, client_id]
);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd dodawania zlecenia" });
  }
});

// Pobieranie zleceń razem z klientem
app.get("/api/orders-with-client", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, c.first_name, c.last_name, c.email
       FROM orders o
       JOIN clients c ON o.client_id = c.id
       ORDER BY o.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd pobierania zleceń z klientem" });
  }
});

// 🔧 Edycja klienta (PUT)
app.put("/api/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, email, nip, address, type, company_name } = req.body;

    const result = await pool.query(
      `UPDATE clients
       SET first_name = $1,
           last_name = $2,
           phone = $3,
           email = $4,
           nip = $5,
           address = $6,
           type = $7,
           company_name = $8
       WHERE id = $9
       RETURNING *`,
      [first_name, last_name, phone, email, nip, address, type, company_name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Klient nie znaleziony" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd edycji klienta" });
  }
});

// 🗑️ Usuwanie klienta (z kontrolą przypisanych zleceń)
app.delete("/api/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Sprawdź, czy klient ma przypisane zlecenia
    const orders = await pool.query(
      "SELECT id, title FROM orders WHERE client_id = $1",
      [id]
    );

    if (orders.rows.length > 0) {
      return res.status(400).json({
        error: "Nie można usunąć klienta – ma przypisane zlecenia.",
        assignedOrders: orders.rows,
      });
    }

    // 2️⃣ Jeśli nie ma zleceń – usuń klienta
    const result = await pool.query(
      "DELETE FROM clients WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Klient nie znaleziony" });
    }

    res.json({ message: "Klient usunięty", deletedClient: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd usuwania klienta" });
  }
});

// ✏️ Edycja zlecenia
app.put("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, deadline, price, notes, client_id } = req.body;

    const result = await pool.query(
      `UPDATE orders
       SET title = $1,
           description = $2,
           status = $3,
           deadline = $4,
           price = $5,
           notes = $6,
           client_id = $7
       WHERE id = $8
       RETURNING *`,
      [title, description, status, deadline, price, notes, client_id, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Zlecenie nie znalezione" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd edycji zlecenia" });
  }
});

// 🗑️ Usuwanie zlecenia
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM orders WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Zlecenie nie znalezione" });

    res.json({ message: "Zlecenie usunięte", deletedOrder: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd usuwania zlecenia" });
  }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend działa na http://localhost:${PORT}`));
