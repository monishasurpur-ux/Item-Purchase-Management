const express = require("express");
const db = require("../config/db");
const { AppError } = require("../utils/errors");
const router = express.Router();

function validateLines(items) {
  if (!Array.isArray(items) || items.length === 0) throw AppError("Purchase must contain at least one item");
  const seen = new Set();
  for (const line of items) {
    const itemId = Number(line.item_id);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(itemId) || itemId <= 0) throw AppError("Invalid item ID");
    if (!Number.isInteger(quantity) || quantity <= 0) throw AppError("Quantity must be greater than zero");
    if (seen.has(itemId)) throw AppError("Duplicate items in one order are not allowed");
    seen.add(itemId);
  }
}

function makeOrderId() {
  return `PO-${Date.now()}`;
}

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.order_id, p.purchase_date, COUNT(pi.id) AS total_lines,
             COALESCE(SUM(pi.quantity), 0) AS total_quantity
      FROM purchases p LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      GROUP BY p.id ORDER BY p.id DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError("Invalid purchase ID");
    const [headers] = await db.execute("SELECT id, order_id, purchase_date FROM purchases WHERE id=?", [id]);
    if (!headers.length) throw AppError("Purchase not found", 404);
    // Required multi-table JOIN: historical details include item type and current stock.
    const [lines] = await db.execute(`
      SELECT i.id AS item_id, i.name AS item_name, it.type_name,
             pi.quantity, i.stock_available, i.active
      FROM purchase_items pi
      JOIN items i ON pi.item_id = i.id
      JOIN item_types it ON i.item_type_id = it.id
      WHERE pi.purchase_id = ?
      ORDER BY pi.id
    `, [id]);
    res.json({ ...headers[0], items: lines });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { purchase_date, items } = req.body;
    if (!purchase_date || Number.isNaN(Date.parse(purchase_date))) throw AppError("A valid purchase date is required");
    validateLines(items);
    await connection.beginTransaction();

    // Lock item rows so concurrent purchases cannot oversell the same stock.
    for (const line of items) {
      const [rows] = await connection.execute(
        "SELECT id, name, stock_available, active FROM items WHERE id=? FOR UPDATE",
        [Number(line.item_id)]
      );
      if (!rows.length) throw AppError("Item not found", 404);
      if (!rows[0].active) throw AppError("Item is inactive and cannot be purchased", 409);
      if (Number(line.quantity) > rows[0].stock_available) {
        throw AppError(`Insufficient stock for ${rows[0].name}. Available quantity: ${rows[0].stock_available}`, 409);
      }
    }

    const orderId = makeOrderId();
    const [purchase] = await connection.execute(
      "INSERT INTO purchases (order_id, purchase_date) VALUES (?, ?)", [orderId, purchase_date]
    );
    for (const line of items) {
      await connection.execute(
        "INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)",
        [purchase.insertId, Number(line.item_id), Number(line.quantity)]
      );
      await connection.execute(
        "UPDATE items SET stock_available = stock_available - ? WHERE id = ?",
        [Number(line.quantity), Number(line.item_id)]
      );
    }
    await connection.commit();
    res.status(201).json({ message: "Purchase created", id: purchase.insertId, order_id: orderId });
  } catch (e) {
    await connection.rollback();
    next(e);
  } finally { connection.release(); }
});

router.put("/:id", async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const purchaseId = Number(req.params.id);
    const { purchase_date, items } = req.body;
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) throw AppError("Invalid purchase ID");
    if (!purchase_date || Number.isNaN(Date.parse(purchase_date))) throw AppError("A valid purchase date is required");
    validateLines(items);
    await connection.beginTransaction();

    const [purchaseRows] = await connection.execute("SELECT id FROM purchases WHERE id=? FOR UPDATE", [purchaseId]);
    if (!purchaseRows.length) throw AppError("Purchase not found", 404);

    const [oldLines] = await connection.execute(
      "SELECT item_id, quantity FROM purchase_items WHERE purchase_id=? FOR UPDATE", [purchaseId]
    );
    const oldMap = new Map(oldLines.map(x => [x.item_id, x.quantity]));
    const newMap = new Map(items.map(x => [Number(x.item_id), Number(x.quantity)]));
    const allIds = [...new Set([...oldMap.keys(), ...newMap.keys()])].sort((a,b) => a-b);
    const itemRows = new Map();

    for (const itemId of allIds) {
      const [rows] = await connection.execute(
        "SELECT id, name, stock_available, active FROM items WHERE id=? FOR UPDATE", [itemId]
      );
      if (!rows.length) throw AppError("Item not found", 404);
      itemRows.set(itemId, rows[0]);
    }

    // Delta = new purchased quantity - old purchased quantity.
    // Positive delta consumes more stock; negative delta returns stock.
    for (const itemId of allIds) {
      const oldQty = oldMap.get(itemId) || 0;
      const newQty = newMap.get(itemId) || 0;
      const delta = newQty - oldQty;
      const item = itemRows.get(itemId);
      if (newQty > 0 && !item.active) throw AppError("Item is inactive and cannot be purchased", 409);
      if (delta > item.stock_available) {
        throw AppError(`Insufficient stock for ${item.name}. Available quantity: ${item.stock_available}`, 409);
      }
    }

    await connection.execute("UPDATE purchases SET purchase_date=? WHERE id=?", [purchase_date, purchaseId]);
    await connection.execute("DELETE FROM purchase_items WHERE purchase_id=?", [purchaseId]);
    for (const itemId of allIds) {
      const oldQty = oldMap.get(itemId) || 0;
      const newQty = newMap.get(itemId) || 0;
      const delta = newQty - oldQty;
      if (delta !== 0) {
        await connection.execute(
          "UPDATE items SET stock_available = stock_available - ? WHERE id=?", [delta, itemId]
        );
      }
      if (newQty > 0) {
        await connection.execute(
          "INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)",
          [purchaseId, itemId, newQty]
        );
      }
    }
    await connection.commit();
    res.json({ message: "Purchase updated and stock adjusted" });
  } catch (e) {
    await connection.rollback();
    next(e);
  } finally { connection.release(); }
});

// Intentionally no DELETE /:id route: purchases are permanent history.
module.exports = router;
