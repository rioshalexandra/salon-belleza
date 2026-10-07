import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, money, qty } from '../lib/helpers.js';
import { applyStock } from '../lib/stock.js';
import { listAttachments, pullAttachments } from '../lib/attachments.js';
import { removeStoredFile } from '../lib/storage.js';
import { SUGGESTED_SERVICES } from '../lib/rubros.js';

const router = Router();

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, sup.name AS supplier_name,
         (SELECT a.id FROM attachments a
          WHERE a.entity_type = 'product' AND a.entity_id = p.id AND a.kind = 'photo'
          ORDER BY a.id LIMIT 1) AS photo_id
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers sup ON sup.id = p.supplier_id
`;

router.get('/categories', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Carga los servicios sugeridos de los rubros elegidos en Configuración.
// No duplica: si un código ya existe, lo saltea.
router.post('/suggested', async (_req, res, next) => {
  try {
    const settings = await query('SELECT business_types FROM store_settings WHERE id = 1');
    const types = settings.rows[0]?.business_types || [];
    let added = 0;
    for (const type of types) {
      const rubro = SUGGESTED_SERVICES[type];
      if (!rubro) continue;
      const cat = await query(
        `INSERT INTO categories (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [rubro.category]
      );
      for (const [sku, name, price, duration] of rubro.services) {
        const result = await query(
          `INSERT INTO products (sku, name, category_id, unit, sale_price, is_service, duration_min)
           VALUES ($1, $2, $3, 'servicio', $4, true, $5)
           ON CONFLICT (sku) DO NOTHING
           RETURNING id`,
          [sku, name, cat.rows[0].id, price, duration]
        );
        added += result.rowCount;
      }
    }
    res.json({ data: { added } });
  } catch (err) {
    next(err);
  }
});

// Lista para el pedido: productos con stock en o por debajo de su stock crítico.
// Cantidad sugerida: la cargada en el producto, o lo necesario para llegar al doble del crítico.
router.get('/reorder', async (_req, res, next) => {
  try {
    const result = await query(
      `${PRODUCT_SELECT}
       WHERE p.active = true AND p.is_service = false AND p.min_stock > 0 AND p.stock_qty <= p.min_stock
       ORDER BY sup.name NULLS LAST, p.name`
    );
    const data = result.rows.map((row) => {
      const stock = Number(row.stock_qty);
      const critical = Number(row.min_stock);
      const suggested = Number(row.reorder_qty) > 0 ? Number(row.reorder_qty) : Math.max(Math.ceil(critical * 2 - stock), 1);
      return { ...row, suggested_qty: suggested };
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const categoryId = req.query.categoryId;
    const params = [];
    const where = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR COALESCE(p.barcode, '') ILIKE $${params.length})`
      );
    }
    if (categoryId) {
      params.push(Number(categoryId));
      where.push(`p.category_id = $${params.length}`);
    }
    if (req.query.active !== 'all') {
      where.push('p.active = true');
    }
    // Filtro por tipo: ?type=service (servicios del salón) o ?type=product (productos con stock)
    if (req.query.type === 'service') where.push('p.is_service = true');
    if (req.query.type === 'product') where.push('p.is_service = false');
    const sql = `${PRODUCT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.name`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    const movements = await query(
      `SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT 80`,
      [req.params.id]
    );
    const attachments = await listAttachments('product', req.params.id);
    res.json({ data: { ...result.rows[0], movements: movements.rows, attachments } });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const product = await createOrUpdateProduct(null, req.body);
    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const product = await createOrUpdateProduct(req.params.id, req.body);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const keys = await withTransaction(async (client) => {
      const product = await client.query('SELECT id, name FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!product.rowCount) throw httpError(404, 'Producto no encontrado');
      const used = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM sale_items WHERE product_id = $1) +
           (SELECT COUNT(*) FROM purchase_items WHERE product_id = $1) AS n`,
        [req.params.id]
      );
      if (Number(used.rows[0].n) > 0) {
        throw httpError(409, 'Este producto está en ventas o compras. Borrá esos comprobantes primero.');
      }
      const files = await pullAttachments(client, 'product', req.params.id);
      await client.query('DELETE FROM stock_movements WHERE product_id = $1', [req.params.id]);
      await client.query('DELETE FROM price_adjustment_items WHERE product_id = $1', [req.params.id]);
      await client.query('DELETE FROM products WHERE id = $1', [req.params.id]);
      return files;
    });
    await Promise.all(keys.map((key) => removeStoredFile(key)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/adjust-stock', async (req, res, next) => {
  try {
    const amount = Math.abs(qty(req.body?.qty ?? req.body?.delta));
    if (!amount) return res.status(400).json({ error: 'Indicá una cantidad distinta de cero' });
    const down =
      req.body?.direction === 'down' ||
      req.body?.direction === 'bajar' ||
      Number(req.body?.delta) < 0;
    const delta = down ? -amount : amount;
    const product = await withTransaction(async (client) => {
      await applyStock(client, {
        productId: Number(req.params.id),
        kind: 'manual',
        delta,
        notes: emptyToNull(req.body?.notes),
      });
      const result = await client.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
      return result.rows[0];
    });
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

async function createOrUpdateProduct(id, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw httpError(400, 'El nombre es obligatorio');
  // Si no se carga un código, se genera uno automático a partir del nombre
  const sku = String(body.sku || '').trim() || (await autoSku(name, body.isService));
  // Un servicio (corte, color, manicura…) no maneja stock ni stock mínimo.
  const isService = body.isService === true || body.isService === 'true';
  const durationMin = isService && Number(body.durationMin) > 0 ? Math.round(Number(body.durationMin)) : null;
  const values = [
    sku,
    name,
    emptyToNull(body.description),
    body.categoryId || null,
    String(body.unit || 'un').trim() || 'un',
    emptyToNull(body.barcode),
    money(body.costPrice),
    money(body.salePrice),
    isService ? 0 : qty(body.minStock),
    body.active !== false,
    isService,
    durationMin,
    // Pedido: cantidad sugerida a pedir y proveedor habitual (solo productos)
    isService || !(Number(body.reorderQty) > 0) ? null : qty(body.reorderQty),
    isService ? null : body.supplierId ? Number(body.supplierId) : null,
  ];
  if (id) {
    const result = await query(
      `UPDATE products
       SET sku = $1, name = $2, description = $3, category_id = $4, unit = $5, barcode = $6,
           cost_price = $7, sale_price = $8, min_stock = $9, active = $10,
           is_service = $11, duration_min = $12, reorder_qty = $13, supplier_id = $14, updated_at = now()
       WHERE id = $15
       RETURNING *`,
      [...values, id]
    );
    if (!result.rowCount) throw httpError(404, 'Producto no encontrado');
    return result.rows[0];
  }
  const stockQty = isService ? 0 : qty(body.stockQty);
  const result = await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO products
         (sku, name, description, category_id, unit, barcode, cost_price, sale_price, stock_qty, min_stock, active,
          is_service, duration_min, reorder_qty, supplier_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      values
    );
    const product = inserted.rows[0];
    if (stockQty) {
      await applyStock(client, {
        productId: product.id,
        kind: 'import',
        delta: stockQty,
        unitCost: money(body.costPrice),
        notes: 'Stock inicial',
      });
      product.stock_qty = stockQty;
    }
    return product;
  });
  return result;
}

export default router;

// Genera un código único tipo "SRV-CORTE-Y-PEINADO" o "PRD-SHAMPOO"
async function autoSku(name, isService) {
  const base =
    (isService ? 'SRV-' : 'PRD-') +
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24);
  let sku = base;
  for (let i = 2; ; i += 1) {
    const exists = await query('SELECT 1 FROM products WHERE sku = $1', [sku]);
    if (!exists.rowCount) return sku;
    sku = `${base}-${i}`;
  }
}
