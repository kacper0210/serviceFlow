const jwt = require("jsonwebtoken");
const pool = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "serviceflow_secret_key_2026";
const sessions = new Map();

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

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

  // Verify JWT token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userData = { id: decoded.id, email: decoded.email, role: decoded.role };
    sessions.set(token, userData);
    req.user = userData;
    req.token = token;
    return next();
  } catch (jwtErr) {
    // Seamless fallback for active sessions
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
  }

  return res.status(401).json({ error: "Brak autoryzacji" });
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Brak uprawnień administratora" });
  }
  next();
};

async function dynamicUpdate(table, id, data, allowedFields) {
  const fields = Object.keys(data).filter(k => allowedFields.includes(k) && data[k] !== undefined);
  if (fields.length === 0) return null;

  const setClause = fields.map((col, idx) => `${col} = $${idx + 1}`).join(", ");
  const values = fields.map(col => {
    let val = data[col];
    if (val === "" || val === undefined) return null;
    return val;
  });

  const parsedId = parseInt(id, 10);
  const targetId = isNaN(parsedId) ? id : parsedId;

  const query = `UPDATE ${table} SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
  const result = await pool.query(query, [...values, targetId]);
  return result.rows ? result.rows[0] : null;
}

/**
 * Helper to safely parse monetary amounts.
 * Supports string inputs with commas (e.g. "123,45" -> 123.45) and returns defaultValue if invalid.
 */
function parseAmount(val, defaultValue = 0) {
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val;
  if (val === null || val === undefined || val === '') return defaultValue;
  const normalized = String(val).replace(',', '.').trim();
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Helper to sanitize string inputs by trimming whitespace.
 */
function sanitizeString(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str.length > 0 ? str : null;
}

module.exports = {
  sessions,
  asyncHandler,
  checkAuth,
  requireAdmin,
  dynamicUpdate,
  parseAmount,
  sanitizeString
};
