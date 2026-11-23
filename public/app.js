const API = "/api";
let itemCache = [];
let typeCache = [];
let cart = [];

const $ = id => document.getElementById(id);
const today = new Date().toISOString().slice(0, 10);
$("itemDate").value = today;
$("purchaseDate").value = today;

function notify(message, type = "success") {
  const box = $("message");
  box.textContent = message;
  box.className = `show ${type}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => box.className = "", 4500);
}
async function request(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("hidden", v.id !== id));
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === id));
  if (id === "itemsView") loadItems();
  if (id === "typesView") loadTypes();
  if (id === "purchaseView") loadPurchaseOptions();
  if (id === "purchasesView") loadPurchases();
  if (id === "stockView") loadStock();
}
document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", function () {
    showView(this.dataset.view);
  });
});

async function loadTypes() {
  typeCache = await request("/item-types");
  $("itemType").innerHTML = '<option value="">Select item type</option>' +
    typeCache.map(t => `<option value="${t.id}">${escapeHtml(t.type_name)}</option>`).join("");
  $("typesTable").innerHTML = typeCache.map(t => `<tr><td>${t.id}</td><td>${escapeHtml(t.type_name)}</td>
    <td><button class="small secondary" onclick="editType(${t.id})">Edit</button>
    <button class="small danger" onclick="deleteType(${t.id})">Delete</button></td></tr>`).join("");
}
async function loadItems() {
  await loadTypes();
  itemCache = await request("/items");
  $("itemsTable").innerHTML = itemCache.map(i => `<tr>
    <td>${i.id}</td><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.type_name)}</td>
    <td>${String(i.purchase_date).slice(0,10)}</td><td>${i.stock_available}</td>
    <td>${escapeHtml(i.availability)}</td><td>${i.active ? "Active" : "Inactive"}</td>
    <td><button class="small secondary" onclick="editItem(${i.id})">Edit</button>
    <button class="small secondary" onclick="toggleItem(${i.id},${i.active ? 0 : 1})">${i.active ? "Deactivate" : "Activate"}</button>
    <button class="small danger" onclick="deleteItem(${i.id})">Delete</button></td></tr>`).join("");
}
$("typeForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await request("/item-types", { method: "POST", body: JSON.stringify({ type_name: $("typeName").value }) });
    $("typeName").value = ""; await loadTypes(); notify("Item type created");
  } catch (err) { notify(err.message, "error"); }
});
async function editType(id) {
  const type = typeCache.find(t => t.id === id);
  const name = prompt("Update item type name:", type.type_name);
  if (name === null) return;
  try { await request(`/item-types/${id}`, { method: "PUT", body: JSON.stringify({ type_name: name }) }); await loadTypes(); notify("Item type updated"); }
  catch (err) { notify(err.message, "error"); }
}
async function deleteType(id) {
  if (!confirm("Delete this item type?")) return;
  try { await request(`/item-types/${id}`, { method: "DELETE" }); await loadTypes(); notify("Item type deleted"); }
  catch (err) { notify(err.message, "error"); }
}
$("itemForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("itemId").value;
  const body = {
    name: $("itemName").value, item_type_id: Number($("itemType").value),
    purchase_date: $("itemDate").value, stock_available: Number($("itemStock").value),
    active: Number($("itemActive").value)
  };
  try {
    await request(id ? `/items/${id}` : "/items", { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
    clearItemForm(); await loadItems(); notify(id ? "Item updated" : "Item created");
  } catch (err) { notify(err.message, "error"); }
});
function clearItemForm() {
  $("itemForm").reset(); $("itemId").value = ""; $("itemDate").value = today; $("itemActive").value = "1";
}
$("clearItem").addEventListener("click", clearItemForm);
function editItem(id) {
  const item = itemCache.find(i => i.id === id);
  $("itemId").value = item.id; $("itemName").value = item.name;
  $("itemType").value = item.item_type_id; $("itemDate").value = String(item.purchase_date).slice(0,10);
  $("itemStock").value = item.stock_available; $("itemActive").value = item.active ? "1" : "0";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function toggleItem(id, active) {
  try { await request(`/items/${id}/status`, { method: "PATCH", body: JSON.stringify({ active }) }); await loadItems(); notify("Item status updated"); }
  catch (err) { notify(err.message, "error"); }
}
async function deleteItem(id) {
  if (!confirm("Delete this item? Items with purchase history cannot be deleted.")) return;
  try { await request(`/items/${id}`, { method: "DELETE" }); await loadItems(); notify("Item deleted"); }
  catch (err) { notify(err.message, "error"); }
}

async function loadPurchaseOptions() {
  itemCache = await request("/items");
  const active = itemCache.filter(i => i.active);
  $("purchaseItem").innerHTML = active.map(i => `<option value="${i.id}">${escapeHtml(i.name)} (stock: ${i.stock_available})</option>`).join("");
  if (!active.length) $("purchaseItem").innerHTML = '<option value="">No active items available</option>';
  renderCart();
}
$("addLine").addEventListener("click", () => {
  const itemId = Number($("purchaseItem").value);
  const quantity = Number($("purchaseQuantity").value);
  const item = itemCache.find(i => i.id === itemId);
  if (!item) return notify("Select an active item", "error");
  if (!Number.isInteger(quantity) || quantity <= 0) return notify("Quantity must be greater than zero", "error");
  if (cart.some(x => x.item_id === itemId)) return notify("This item is already in the order", "error");
  if (quantity > item.stock_available) return notify(`Insufficient stock. Available: ${item.stock_available}`, "error");
  cart.push({ item_id: itemId, quantity });
  renderCart();
});
function renderCart() {
  $("cartTable").innerHTML = cart.map((line, index) => {
    const item = itemCache.find(i => i.id === line.item_id);
    return `<tr><td>${escapeHtml(item?.name || "Item")}</td><td>${line.quantity}</td>
      <td>${item?.stock_available ?? "-"}</td><td><button type="button" class="small danger" onclick="removeLine(${index})">Remove</button></td></tr>`;
  }).join("");
}
function removeLine(index) { cart.splice(index, 1); renderCart(); }
$("purchaseForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!cart.length) return notify("Add at least one item to the purchase", "error");
  try {
    const result = await request("/purchases", { method: "POST", body: JSON.stringify({ purchase_date: $("purchaseDate").value, items: cart }) });
    cart = []; renderCart(); await loadPurchaseOptions();
    notify(`Purchase created successfully. Order ID: ${result.order_id}`);
  } catch (err) { notify(err.message, "error"); }
});

async function loadPurchases() {
  const purchases = await request("/purchases");
  $("purchasesTable").innerHTML = purchases.map(p => `<tr><td>${escapeHtml(p.order_id)}</td>
    <td>${String(p.purchase_date).slice(0,10)}</td><td>${p.total_lines}</td><td>${p.total_quantity}</td>
    <td><button class="small secondary" onclick="viewPurchase(${p.id})">View Details</button>
    <button class="small secondary" onclick="updatePurchase(${p.id})">Update</button></td></tr>`).join("");
}
async function viewPurchase(id) {
  try {
    const p = await request(`/purchases/${id}`);
    $("purchaseDetails").innerHTML = `<div class="panel"><h3>${escapeHtml(p.order_id)} — Purchase Details</h3>
      <p>Purchase Date: ${String(p.purchase_date).slice(0,10)}</p>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th>Item Type</th><th>Quantity</th><th>Current Stock</th><th>Status</th></tr></thead>
      <tbody>${p.items.map(i => `<tr><td>${escapeHtml(i.item_name)}</td><td>${escapeHtml(i.type_name)}</td>
      <td>${i.quantity}</td><td>${i.stock_available}</td><td>${i.active ? "Active" : "Inactive"}</td></tr>`).join("")}</tbody></table></div></div>`;
  } catch (err) { notify(err.message, "error"); }
}
async function updatePurchase(id) {
  try {
    const p = await request(`/purchases/${id}`);
    const date = prompt("Purchase date (YYYY-MM-DD):", String(p.purchase_date).slice(0,10));
    if (date === null) return;
    const current = p.items.map(i => `${i.item_id}:${i.quantity}`).join(",");
    const value = prompt("Enter updated item quantities as itemID:quantity separated by commas. Example: 1:2,2:5", current);
    if (value === null) return;
    const items = value.split(",").filter(Boolean).map(part => {
      const [item_id, quantity] = part.trim().split(":").map(Number);
      return { item_id, quantity };
    });
    await request(`/purchases/${id}`, { method: "PUT", body: JSON.stringify({ purchase_date: date, items }) });
    await loadPurchases(); await loadStock(); notify("Purchase updated and stock adjusted");
  } catch (err) { notify(err.message, "error"); }
}
async function loadStock() {
  itemCache = await request("/items");
  $("stockTable").innerHTML = itemCache.map(i => `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.type_name)}</td>
    <td>${i.stock_available}</td><td>${escapeHtml(i.availability)}</td><td>${i.active ? "Active" : "Inactive"}</td></tr>`).join("");
}
loadItems().catch(err => notify(err.message, "error"));