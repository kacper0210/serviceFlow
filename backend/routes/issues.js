const express = require("express");
const pool = require("../db");
const { asyncHandler } = require("../middleware/auth");

const router = express.Router();

// GET /api/issues
router.get("/", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM issues ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, created_at DESC"
  );
  res.json(result.rows);
}));

// POST /api/issues
router.post("/", asyncHandler(async (req, res) => {
  const { type, description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: "Opis jest wymagany" });
  }
  const result = await pool.query(
    "INSERT INTO issues (type, description, status) VALUES ($1, $2, 'open') RETURNING *",
    [type || 'błąd', description.trim()]
  );
  res.status(201).json(result.rows[0]);
}));

// PATCH /api/issues/:id
router.patch("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const result = await pool.query(
    "UPDATE issues SET status = $1 WHERE id = $2 RETURNING *",
    [status || 'open', id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Zgłoszenie nie istnieje" });
  }
  res.json(result.rows[0]);
}));

// DELETE /api/issues/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await pool.query("DELETE FROM issues WHERE id = $1 RETURNING *", [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Zgłoszenie nie istnieje" });
  }
  res.json({ message: "Usunięto pomyślnie", deleted: result.rows[0] });
}));

module.exports = router;
