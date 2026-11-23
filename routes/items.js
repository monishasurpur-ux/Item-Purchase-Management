const express = require("express");
const db = require("../config/db");
const { AppError } = require("../utils/errors");
const router = express.Router();

const validDate = value => value && !Number.isNaN(Date.parse(value));

router.get("/", async (req, res, next) => {
  try {
    // JOIN supplies the readable item type instead of only its foreign-key ID.
    const [rows] = await db.query(`
      SELECT i.id, i.name, it.type_name, i.item_type_id, i.purchase_date,
             i.stock_available, i.active,
             CASE WHEN i.stock_available = 0 THEN 'Out of Stock'
                  WHEN i.stock_available <= 5 THEN 'Low Stock'
                  ELSE 'In Stock' END AS availability
      FROM items i
      JOIN item_types it ON i.item_type_id = it.id
      ORDER BY i.id DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError("Invalid item ID");
    const [rows] = await db.execute(`
      SELECT i.id, i.name, it.type_name, i.item_type_id, i.purchase_date,
             i.stock_available, i.active
      FROM items i JOIN item_types it ON i.item_type_id = it.id
      WHERE i.id = ?
    `, [id]);
    if (!rows.length) throw AppError("Item not found", 404);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, item_type_id, purchase_date, stock_available, active } = req.body;
    const stock = Number(stock_available);
    const typeId = Number(item_type_id);
    if (!String(name || "").trim()) throw AppError("Item name is required");
    if (!Number.isInteger(typeId) || typeId <= 0) throw AppError("Item type is required");
    if (!validDate(purchase_date)) throw AppError("A valid purchase date is required");
    if (!Number.isInteger(stock) || stock < 0) throw AppError("Stock cannot be negative and must be a whole number");
    if (![0, 1, true, false].includes(active)) throw AppError("Active/Inactive status is required");
    const [types] = await db.execute("SELECT id FROM item_types WHERE id = ?", [typeId]);
    if (!types.length) throw AppError("Invalid item type", 400);
    const [result] = await db.execute(
      "INSERT INTO items (name, item_type_id, purchase_date, stock_available, active) VALUES (?, ?, ?, ?, ?)",
      [String(name).trim(), typeId, purchase_date, stock, active ? 1 : 0]
    );
    res.status(201).json({ message: "Item created", id: result.insertId });
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, item_type_id, purchase_date, stock_available, active } = req.body;
    const stock = Number(stock_available);
    const typeId = Number(item_type_id);
    if (!Number.isInteger(id) || id <= 0) throw AppError("Invalid item ID");
    if (!String(name || "").trim()) throw AppError("Item name is required");
    if (!Number.isInteger(typeId) || typeId <= 0) throw AppError("Item type is required");
    if (!validDate(purchase_date)) throw AppError("A valid purchase date is required");
    if (!Number.isInteger(stock) || stock < 0) throw AppError("Stock cannot be negative and must be a whole number");
    if (![0, 1, true, false].includes(active)) throw AppError("Active/Inactive status is required");
    const [types] = await db.execute("SELECT id FROM item_types WHERE id = ?", [typeId]);
    if (!types.length) throw AppError("Invalid item type", 400);
    const [result] = await db.execute(
      `UPDATE items SET name=?, item_type_id=?, purchase_date=?, stock_available=?, active=? WHERE id=?`,
      [String(name).trim(), typeId, purchase_date, stock, active ? 1 : 0, id]
    );
    if (!result.affectedRows) throw AppError("Item not found", 404);
    res.json({ message: "Item updated" });
  } catch (e) { next(e); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { active } = req.body;
    if (!Number.isInteger(id) || id <= 0) throw AppError("Invalid item ID");
    if (![0, 1, true, false].includes(active)) throw AppError("Status must be Active or Inactive");
    const [result] = await db.execute("UPDATE items SET active=? WHERE id=?", [active ? 1 : 0, id]);
    if (!result.affectedRows) throw AppError("Item not found", 404);
    res.json({ message: "Item status updated" });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError("Invalid item ID");
    const [history] = await db.execute("SELECT id FROM purchase_items WHERE item_id=? LIMIT 1", [id]);
    if (history.length) throw AppError("Item has purchase history. Mark it Inactive instead of deleting it.", 409);
    const [result] = await db.execute("DELETE FROM items WHERE id=?", [id]);
    if (!result.affectedRows) throw AppError("Item not found", 404);
    res.json({ message: "Item deleted" });
  } catch (e) { next(e); }
});

module.exports = router;
