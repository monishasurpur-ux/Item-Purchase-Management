const express = require("express");
const db = require("../config/db");
const { AppError } = require("../utils/errors");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT id, type_name FROM item_types ORDER BY id DESC");
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body.type_name || "").trim();
    if (!name) throw AppError("Item type name is required");
    const [result] = await db.execute("INSERT INTO item_types (type_name) VALUES (?)", [name]);
    res.status(201).json({ message: "Item type created", id: result.insertId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") e = AppError("This item type already exists", 409);
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.type_name || "").trim();
    if (!Number.isInteger(id) || id <= 0) throw AppError("Invalid item type ID");
    if (!name) throw AppError("Item type name is required");
    const [result] = await db.execute("UPDATE item_types SET type_name = ? WHERE id = ?", [name, id]);
    if (!result.affectedRows) throw AppError("Item type not found", 404);
    res.json({ message: "Item type updated" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") e = AppError("This item type already exists", 409);
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError("Invalid item type ID");
    const [used] = await db.execute("SELECT id FROM items WHERE item_type_id = ? LIMIT 1", [id]);
    if (used.length) throw AppError("This item type is used by an item and cannot be deleted", 409);
    const [result] = await db.execute("DELETE FROM item_types WHERE id = ?", [id]);
    if (!result.affectedRows) throw AppError("Item type not found", 404);
    res.json({ message: "Item type deleted" });
  } catch (e) { next(e); }
});

module.exports = router;
