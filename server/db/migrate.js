import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getPool, query } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = getPool();
  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function ensureAdmin() {
  const existing = await query('SELECT id FROM users WHERE username = $1', [config.defaultAdminUser]);
  if (existing.rowCount) {
    console.log(`OK: admin listo (${config.defaultAdminUser})`);
    return;
  }
  const hash = await bcrypt.hash(config.defaultAdminPassword, 10);
  await query('INSERT INTO users (username, password_hash, name) VALUES ($1, $2, $3)', [
    config.defaultAdminUser,
    hash,
    'Administrador',
  ]);
  console.log(`OK: admin creado (${config.defaultAdminUser})`);
}

async function ensureSettings() {
  await query('UPDATE store_settings SET timezone = $1 WHERE id = 1', [config.storeTimezone]);
  const current = await query('SELECT name FROM store_settings WHERE id = 1');
  if (current.rows[0]?.name === 'Mi comercio' && config.storeName) {
    await query('UPDATE store_settings SET name = $1 WHERE id = 1', [config.storeName]);
  }
}

async function seedDemo() {
  if (!config.seedDemo) return;
  const count = await query('SELECT COUNT(*)::int AS n FROM products');
  if (count.rows[0].n > 0) {
    console.log('OK: datos demo ya existen');
    return;
  }

  const categories = ['Bebidas', 'Alimentos', 'Limpieza'];
  const categoryIds = {};
  for (const name of categories) {
    const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
    categoryIds[name] = result.rows[0].id;
  }

  const products = [
    ['COCA-1500', 'Coca Cola 1.5L', 'Bebidas', 'un', 1800, 2500, 40, 12],
    ['AGUA-500', 'Agua mineral 500ml', 'Bebidas', 'un', 400, 700, 62, 24],
    ['ARROZ-1KG', 'Arroz largo fino 1kg', 'Alimentos', 'un', 900, 1400, 30, 10],
    ['ACEITE-900', 'Aceite girasol 900ml', 'Alimentos', 'un', 2200, 3200, 18, 8],
    ['FIDEOS-500', 'Fideos spaghetti 500g', 'Alimentos', 'un', 700, 1100, 41, 15],
    ['LAVAND-1L', 'Lavandina 1L', 'Limpieza', 'un', 650, 1100, 20, 8],
    ['DET-750', 'Detergente 750ml', 'Limpieza', 'un', 890, 1490, 16, 6],
    ['PAPEL-30', 'Papel higiénico x4', 'Limpieza', 'un', 1800, 2600, 22, 10],
  ];
  const productIds = {};
  for (const [sku, name, category, unit, cost, price, stock, min] of products) {
    const result = await query(
      `INSERT INTO products (sku, name, category_id, unit, cost_price, sale_price, stock_qty, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [sku, name, categoryIds[category], unit, cost, price, stock, min]
    );
    productIds[sku] = result.rows[0].id;
    await query(
      `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, notes)
       VALUES ($1, 'import', $2, $3, 'Stock inicial demo')`,
      [result.rows[0].id, stock, cost]
    );
  }

  const customers = [
    ['Almacén Don Pedro', '20-20333444-5', '2664123001', 'pedro@almacen.test'],
    ['María López', '27-27444555-6', '2664123002', 'maria@test.com'],
    ['Club Sportivo', '30-70888999-1', '2664123003', 'club@sportivo.test'],
  ];
  const customerIds = [];
  for (const [name, taxId, phone, email] of customers) {
    const result = await query(
      'INSERT INTO customers (name, tax_id, phone, email) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, taxId, phone, email]
    );
    customerIds.push(result.rows[0].id);
  }

  const suppliers = [
    ['Distribuidora Andina', '30-71222333-9', '2664002001', 'ventas@andina.test'],
    ['Mayorista San Luis', '30-71444555-2', '2664002002', 'pedidos@mayorista.test'],
  ];
  const supplierIds = [];
  for (const [name, taxId, phone, email] of suppliers) {
    const result = await query(
      'INSERT INTO suppliers (name, tax_id, phone, email) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, taxId, phone, email]
    );
    supplierIds.push(result.rows[0].id);
  }

  const sale = await query(
    `INSERT INTO sales (number, customer_id, issued_at, status, subtotal, tax, total, paid, notes)
     VALUES ('V-00001', $1, CURRENT_DATE, 'confirmed', 12200, 0, 12200, 10000, 'Venta de demostración')
     RETURNING id`,
    [customerIds[0]]
  );
  const saleId = sale.rows[0].id;
  await query(
    `INSERT INTO sale_items (sale_id, product_id, description, qty, unit_price, cost_price, line_total)
     VALUES
       ($1, $2, 'Coca Cola 1.5L', 4, 2500, 1800, 10000),
       ($1, $3, 'Agua mineral 500ml', 2, 700, 400, 1400),
       ($1, $4, 'Fideos spaghetti 500g', 1, 1100, 700, 1100)`,
    [saleId, productIds['COCA-1500'], productIds['AGUA-500'], productIds['FIDEOS-500']]
  );
  await query(
    `INSERT INTO payments (kind, customer_id, sale_id, amount, method, notes)
     VALUES ('in', $1, $2, 10000, 'transfer', 'Seña / pago parcial')`,
    [customerIds[0], saleId]
  );
  await query(
    `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, ref_type, ref_id)
     VALUES
       ($1, 'sale', -4, 1800, 'sale', $4),
       ($2, 'sale', -2, 400, 'sale', $4),
       ($3, 'sale', -1, 700, 'sale', $4)`,
    [productIds['COCA-1500'], productIds['AGUA-500'], productIds['FIDEOS-500'], saleId]
  );
  await query('UPDATE products SET stock_qty = stock_qty - 4 WHERE id = $1', [productIds['COCA-1500']]);
  await query('UPDATE products SET stock_qty = stock_qty - 2 WHERE id = $1', [productIds['AGUA-500']]);
  await query('UPDATE products SET stock_qty = stock_qty - 1 WHERE id = $1', [productIds['FIDEOS-500']]);

  const purchase = await query(
    `INSERT INTO purchases (number, supplier_id, issued_at, status, subtotal, tax, total, paid, notes)
     VALUES ('C-00001', $1, CURRENT_DATE, 'confirmed', 21600, 0, 21600, 21600, 'Compra de demostración')
     RETURNING id`,
    [supplierIds[0]]
  );
  const purchaseId = purchase.rows[0].id;
  await query(
    `INSERT INTO purchase_items (purchase_id, product_id, description, qty, unit_cost, line_total)
     VALUES
       ($1, $2, 'Coca Cola 1.5L', 12, 1800, 21600)`,
    [purchaseId, productIds['COCA-1500']]
  );
  await query(
    `INSERT INTO payments (kind, supplier_id, purchase_id, amount, method, notes)
     VALUES ('out', $1, $2, 21600, 'transfer', 'Pago al proveedor')`,
    [supplierIds[0], purchaseId]
  );
  await query(
    `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, ref_type, ref_id)
     VALUES ($1, 'purchase', 12, 1800, 'purchase', $2)`,
    [productIds['COCA-1500'], purchaseId]
  );
  await query('UPDATE products SET stock_qty = stock_qty + 12 WHERE id = $1', [productIds['COCA-1500']]);

  console.log('OK: datos demo cargados');
}

async function migrate() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  await runSchema();
  console.log('OK: schema aplicado');
  await ensureSettings();
  await ensureAdmin();
  await seedDemo();
  console.log('Migrations completed successfully.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  migrate()
    .then(async () => {
      await getPool().end();
    })
    .catch(async (err) => {
      console.error('Migration failed:', err.message);
      try {
        await getPool().end();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}

export { migrate };
