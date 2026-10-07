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
  if (['Mi comercio', 'Mi salón'].includes(current.rows[0]?.name) && config.storeName) {
    await query('UPDATE store_settings SET name = $1 WHERE id = 1', [config.storeName]);
  }
}

// SKUs de los datos de ejemplo del template original (almacén)
const OLD_DEMO_SKUS = [
  'COCA-1500', 'AGUA-500', 'ARROZ-1KG', 'ACEITE-900', 'FIDEOS-500', 'LAVAND-1L', 'DET-750', 'PAPEL-30',
];

// Reemplazo único de los datos de almacén por los del salón.
// Se activa con la variable RESET_DEMO_DATA=true y SOLO borra si todos los productos
// cargados son los de ejemplo del almacén (así nunca toca datos reales del salón).
async function replaceOldDemo() {
  if (process.env.RESET_DEMO_DATA !== 'true') return false;
  const products = await query('SELECT sku FROM products');
  const onlyOldDemo =
    products.rowCount > 0 && products.rows.every((row) => OLD_DEMO_SKUS.includes(row.sku));
  if (!onlyOldDemo) {
    console.log('OK: RESET_DEMO_DATA ignorado (hay datos que no son de ejemplo)');
    return false;
  }
  // Se borran solo datos de negocio; usuarios y configuración quedan intactos
  await query(`TRUNCATE payments, sale_items, sales, purchase_items, purchases, stock_movements,
    price_adjustment_items, price_adjustments, attachments, appointments, customer_visits,
    products, categories, customers, suppliers RESTART IDENTITY CASCADE`);
  console.log('OK: datos de ejemplo del almacén borrados');
  return true;
}

// Carga datos de ejemplo de un salón de belleza si la base está vacía (SEED_DEMO=true)
async function seedDemo(force = false) {
  if (!config.seedDemo && !force) return;
  const count = await query('SELECT COUNT(*)::int AS n FROM products');
  if (count.rows[0].n > 0) {
    console.log('OK: datos demo ya existen');
    return;
  }

  // Categorías: las de servicios y las de productos de reventa
  const categories = ['Cabello', 'Color', 'Manos y pies', 'Estética', 'Reventa capilar', 'Reventa skincare'];
  const categoryIds = {};
  for (const name of categories) {
    const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
    categoryIds[name] = result.rows[0].id;
  }

  // Servicios: [código, nombre, categoría, costo, precio, duración en minutos]
  const services = [
    ['SRV-CORTE', 'Corte y peinado', 'Cabello', 0, 14000, 45],
    ['SRV-BRUSHING', 'Brushing', 'Cabello', 0, 9000, 30],
    ['SRV-COLOR', 'Color raíz', 'Color', 6000, 28000, 90],
    ['SRV-MECHAS', 'Mechas / balayage', 'Color', 12000, 55000, 150],
    ['SRV-MANI', 'Manicura semipermanente', 'Manos y pies', 2500, 15000, 60],
    ['SRV-PEDI', 'Pedicura', 'Manos y pies', 2000, 16000, 60],
    ['SRV-LIMPIEZA', 'Limpieza facial', 'Estética', 3000, 22000, 60],
  ];
  const serviceIds = {};
  for (const [sku, name, category, cost, price, duration] of services) {
    const result = await query(
      `INSERT INTO products (sku, name, category_id, unit, cost_price, sale_price, is_service, duration_min)
       VALUES ($1, $2, $3, 'servicio', $4, $5, true, $6)
       RETURNING id`,
      [sku, name, categoryIds[category], cost, price, duration]
    );
    serviceIds[sku] = result.rows[0].id;
  }

  // Productos de reventa: [código, nombre, categoría, unidad, costo, precio, stock, mínimo]
  const products = [
    ['SHAMPOO-300', 'Shampoo reparador 300ml', 'Reventa capilar', 'un', 7500, 13500, 12, 4],
    ['ACOND-300', 'Acondicionador reparador 300ml', 'Reventa capilar', 'un', 7800, 14000, 10, 4],
    ['MASC-250', 'Máscara de hidratación 250g', 'Reventa capilar', 'un', 9500, 17000, 6, 3],
    ['SERUM-50', 'Sérum de puntas 50ml', 'Reventa capilar', 'un', 6000, 11500, 3, 4],
    ['CREMA-FAC', 'Crema facial hidratante 50ml', 'Reventa skincare', 'un', 11000, 19500, 8, 3],
    ['ESMALTE', 'Esmalte semipermanente', 'Reventa skincare', 'un', 3500, 7000, 20, 6],
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

  // Clientes de ejemplo con su ficha
  const customers = [
    ['Lucía Fernández', '1123456701', '@lu.fernandez', 'Rizado, poroso', 'Mixta', '7.1 + oxidante 20 vol', 'Prefiere turnos a la mañana'],
    ['Carolina Gómez', '1123456702', null, 'Lacio, fino', 'Seca', null, 'Le gusta el brushing con ondas'],
    ['Valentina Ruiz', '1123456703', '@valeruiz', 'Ondulado', 'Grasa', 'Mechas 9.0 con decoloración suave', null],
  ];
  const customerIds = [];
  for (const [name, phone, instagram, hair, skin, formula, prefs] of customers) {
    const result = await query(
      `INSERT INTO customers (name, phone, instagram, hair_type, skin_type, color_formula, preferences, birthday)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE - (INTERVAL '30 years') + (INTERVAL '5 days' * $8::int))
       RETURNING id`,
      [name, phone, instagram, hair, skin, formula, prefs, customerIds.length]
    );
    customerIds.push(result.rows[0].id);
  }

  await query(
    `INSERT INTO suppliers (name, phone, email) VALUES ('Distribuidora Belleza Total', '1140002000', 'ventas@bellezatotal.test')
     RETURNING id`
  );

  // Turnos de hoy y mañana para ver la agenda funcionando
  const appointments = [
    [customerIds[0], 'SRV-COLOR', 'Romina', 0, '10:00', 90],
    [customerIds[1], 'SRV-BRUSHING', 'Romina', 0, '12:00', 30],
    [customerIds[2], 'SRV-MANI', 'Sofía', 0, '15:30', 60],
    [customerIds[1], 'SRV-CORTE', 'Romina', 1, '11:00', 45],
  ];
  for (const [customerId, sku, staff, offset, time, duration] of appointments) {
    await query(
      `INSERT INTO appointments (customer_id, service_id, staff_name, day, start_time, duration_min)
       VALUES ($1, $2, $3, CURRENT_DATE + $4::int, $5, $6)`,
      [customerId, serviceIds[sku], staff, offset, time, duration]
    );
  }

  // Una venta de ejemplo: servicio + producto
  const sale = await query(
    `INSERT INTO sales (number, customer_id, issued_at, status, subtotal, tax, total, paid, notes)
     VALUES ('V-00001', $1, CURRENT_DATE, 'confirmed', 27500, 0, 27500, 27500, 'Venta de demostración')
     RETURNING id`,
    [customerIds[0]]
  );
  const saleId = sale.rows[0].id;
  await query(
    `INSERT INTO sale_items (sale_id, product_id, description, qty, unit_price, cost_price, line_total)
     VALUES
       ($1, $2, 'Corte y peinado', 1, 14000, 0, 14000),
       ($1, $3, 'Shampoo reparador 300ml', 1, 13500, 7500, 13500)`,
    [saleId, serviceIds['SRV-CORTE'], productIds['SHAMPOO-300']]
  );
  await query(
    `INSERT INTO payments (kind, customer_id, sale_id, amount, method, notes)
     VALUES ('in', $1, $2, 27500, 'transfer', 'Pago total')`,
    [customerIds[0], saleId]
  );
  await query(
    `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, ref_type, ref_id)
     VALUES ($1, 'sale', -1, 7500, 'sale', $2)`,
    [productIds['SHAMPOO-300'], saleId]
  );
  await query('UPDATE products SET stock_qty = stock_qty - 1 WHERE id = $1', [productIds['SHAMPOO-300']]);
  await query(
    `INSERT INTO customer_visits (customer_id, service, staff_name, notes)
     VALUES ($1, 'Corte y peinado', 'Romina', 'Despuntado y capas largas')`,
    [customerIds[0]]
  );

  console.log('OK: datos demo del salón cargados');
}

async function migrate() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  await runSchema();
  console.log('OK: schema aplicado');
  await ensureSettings();
  await ensureAdmin();
  const replaced = await replaceOldDemo();
  await seedDemo(replaced);
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
