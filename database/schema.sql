CREATE DATABASE IF NOT EXISTS item_purchase_db;
USE item_purchase_db;

CREATE TABLE IF NOT EXISTS item_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  purchase_date DATE NOT NULL,
  stock_available INT NOT NULL DEFAULT 0,
  item_type_id INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_item_type
    FOREIGN KEY (item_type_id) REFERENCES item_types(id),
  CONSTRAINT chk_items_stock CHECK (stock_available >= 0)
);

CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(30) NOT NULL UNIQUE,
  purchase_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_items_purchase
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  CONSTRAINT fk_purchase_items_item
    FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT chk_purchase_quantity CHECK (quantity > 0),
  CONSTRAINT uq_purchase_item UNIQUE (purchase_id, item_id)
);

INSERT IGNORE INTO item_types (type_name)
VALUES ('Electronics'), ('Furniture'), ('Clothing'), ('Grocery'), ('Stationery');
