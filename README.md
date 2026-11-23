# Item & Purchase Management System

A project based on the supplied assignment. Technology: Node.js, Express.js, MySQL, HTML, CSS and browser JavaScript.

## 1. Requirements
- Node.js and npm
- MySQL Server
- A browser

## 2. Project setup
1. Extract the project folder.
2. Open a terminal in the project folder.
3. Install dependencies:

```bash
npm install
```

4. Create the database and tables. Run `database/schema.sql` in MySQL Workbench or the MySQL command line:

```bash
mysql -u root -p < database/schema.sql
```

5. Copy `.env.example` to `.env` and enter your own MySQL username and password:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=item_purchase_db
DB_PORT=3306
PORT=3000
```

6. Start the application:

```bash
npm start
```

7. Open `http://localhost:3000`.

## 3. Project structure

- `server.js` — creates the Express server, serves the frontend and mounts API routes.
- `config/db.js` — creates the MySQL connection pool.
- `routes/itemTypes.js` — item type APIs.
- `routes/items.js` — item CRUD, status and stock availability.
- `routes/purchases.js` — purchase create, list, details and update with stock adjustment.
- `middleware/errorHandler.js` — consistent safe error responses.
- `utils/errors.js` — helper for HTTP errors.
- `database/schema.sql` — required four-table MySQL schema.
- `public/index.html` — frontend screens.
- `public/styles.css` — basic responsive styling.
- `public/app.js` — frontend interactions and API calls.

## 4. Why each technology/file is used

- **Node.js:** runs JavaScript on the server.
- **Express.js:** defines REST endpoints and handles HTTP requests.
- **MySQL:** permanently stores item types, items, purchase headers and purchase lines.
- **mysql2:** connects Node.js to MySQL and supports promise-based queries and transactions.
- **HTML:** defines the forms, navigation, tables and purchase screens.
- **CSS:** makes the forms and tables readable and responsive.
- **Frontend JavaScript:** calls the backend APIs, updates the page and manages unsubmitted purchase lines.
- **dotenv:** reads database configuration from `.env` instead of hardcoding credentials.

## 5. Main API endpoints

### Item Types
- `GET /api/item-types`
- `POST /api/item-types` — body: `{ "type_name": "Electronics" }`
- `PUT /api/item-types/:id` — body: `{ "type_name": "Office Supplies" }`
- `DELETE /api/item-types/:id`

### Items
- `GET /api/items`
- `GET /api/items/:id`
- `POST /api/items` — body: `{ "name":"Laptop", "item_type_id":1, "purchase_date":"2026-08-25", "stock_available":10, "active":1 }`
- `PUT /api/items/:id` — same body as create
- `PATCH /api/items/:id/status` — body: `{ "active":0 }`
- `DELETE /api/items/:id`

### Purchases
- `GET /api/purchases`
- `GET /api/purchases/:id`
- `POST /api/purchases` — example body:

```json
{
  "purchase_date": "2026-08-25",
  "items": [
    { "item_id": 1, "quantity": 2 },
    { "item_id": 2, "quantity": 5 }
  ]
}
```

- `PUT /api/purchases/:id` — same body structure as create, with the complete revised item list.
- There is deliberately **no DELETE purchase endpoint**.

## 6. Important implementation details

### SQL JOIN
The item list joins `items` with `item_types` so the UI can display the type name. Purchase details join `purchases`, `purchase_items`, `items` and `item_types` to show each purchased item and its type.

### Stock and transactions
Purchase creation starts a transaction, locks selected item rows, validates that items exist, are active and have enough stock, inserts the purchase and its lines, deducts stock, then commits. If any operation fails, it rolls back. This prevents a partial purchase and prevents concurrent requests from overselling locked item stock.

### Purchase update
The update compares each item's old quantity with its new quantity:
`delta = new quantity - old quantity`.
A positive delta deducts additional stock. A negative delta returns stock. The whole update is in a transaction.

### History protection
A purchase cannot be deleted. An item that appears in purchase history cannot be physically deleted; the API returns a conflict and recommends marking it inactive. Item types used by existing items cannot be deleted.

### Backend validation and errors
Validation is performed in the API as well as in the browser. Common responses use 400 for invalid input, 404 for missing records, 409 for business conflicts and 500 for unexpected errors. Database error details are not returned to the browser.

## 7. End-to-end test
1. Add an item type, for example Electronics.
2. Add Laptop with stock 10 and Active status.
3. Create a purchase with Laptop quantity 2.
4. Verify the stock is now 8.
5. Try to purchase quantity 10. The backend should reject it and stock should remain 8.
6. Update the first purchase quantity from 2 to 4. Stock should become 6.
7. Update it from 4 to 1. Stock should become 9.
8. Try deleting the purchase: no delete action or API exists.
9. Try deleting an item used in purchase history: the API should reject it.

## 8. Notes
- The assignment does not specify a frontend framework, so the frontend uses plain HTML, CSS and JavaScript.
- The assignment requires the four listed tables. The schema uses those four tables and their stated relationships.
- The generated order ID uses a timestamp-based value with a unique database constraint.
