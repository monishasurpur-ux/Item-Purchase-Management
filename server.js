require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./config/db");
const itemTypeRoutes = require("./routes/itemTypes");
const itemRoutes = require("./routes/items");
const purchaseRoutes = require("./routes/purchases");
const errorHandler = require("./middleware/errorHandler");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (req, res, next) => {
  try {
    await db.query("SELECT 1");
    res.json({ message: "Item & Purchase Management System is running" });
  } catch (e) { next(e); }
});

app.use("/api/item-types", itemTypeRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/purchases", purchaseRoutes);

app.use("/api", (req, res) => res.status(404).json({ message: "API endpoint not found" }));
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
