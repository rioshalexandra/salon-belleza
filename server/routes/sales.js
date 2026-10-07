import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { computeDocTotals, emptyToNull, httpError, money, nextNumber, qty } from '../lib/helpers.js';
import { confirmSaleStock, deleteSaleRecord, refreshSalePaid, reverseSaleStock } from '../lib/stock.js';
import { isAdmin, requireAdmin } from '../middleware/auth.js';

const METHODS = ['cash', 'transfer', 'card', 'check', 'other'];

const router = Router();

const SALE_SELECT = `
  SELECT s.*, c.name AS customer_name, u.name AS staff_name,
         (s.total - s.paid) AS balance
  FROM sales s
  LEFT JOIN customers c ON c.id = s.customer_id
  LEFT JOIN users u ON u.id = s.staff_id
`;

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`(s.number ILIKE $${params.length} OR COALESCE(c.name, '') ILIKE $${params.length})`);
    }
    // Un empleado solo ve sus propias ventas
    if (!isAdmin(req)) {
      params.push(req.user.id);
      where.push(`s.staff_id = $${params.length}`);
    } else if (req.query.staffId) {
      params.push(Number(req.query.staffId));
      where.push(`s.staff_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`s.status = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`s.issued_at >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`s.issued_at <= $${params.length}`);
    }
    const sql = `${SALE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.issued_at DESC, s.id DESC LIMIT 200`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// Cobro en un solo paso: arma la venta, la confirma (descuenta stock de productos),
// registra el pago completo y, si viene de un turno, lo marca como realizado.
// body: { customerId, staffId, items:[{productId, qty, unitPrice}], method, appointmentId, notes, issuedAt }
router.post('/quick', async (req, res, next) => {
  try {
    const body = req.body || {};
    const method = METHODS.includes(body.method) ? body.method : 'cash';
    const saleId = await withTransaction(async (client) => {
      let appt = null;
      if (body.appointmentId) {
        const found = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [body.appointmentId]);
        if (!found.rowCount) throw httpError(404, 'Turno no encontrado');
        appt = found.rows[0];
        if (appt.sale_id) throw httpError(400, 'Este turno ya está cobrado');
      }
      const sale = await saveSale(
        client,
        null,
        {
          customerId: body.customerId || appt?.customer_id || null,
          staffId: body.staffId || appt?.staff_id || null,
          issuedAt: body.issuedAt || (appt ? String(appt.day).slice(0, 10) : null),
          notes: body.notes || (appt ? `Turno ${String(appt.start_time).slice(0, 5)}` : null),
          items: body.items,
        },
        req.user
      );
      await confirmSaleStock(client, sale.id);
      const current = await client.query(
        `UPDATE sales SET status = 'confirmed', updated_at = now() WHERE id = $1 RETURNING *`,
        [sale.id]
      );
      const total = money(current.rows[0].total);
      if (total > 0) {
        await client.query(
          `INSERT INTO payments (kind, customer_id, sale_id, amount, method, paid_at, created_by)
           VALUES ('in', $1, $2, $3, $4, $5, $6)`,
          [current.rows[0].customer_id, sale.id, total, method, current.rows[0].issued_at, req.user?.id || null]
        );
        await refreshSalePaid(client, sale.id);
      }
      // Turno cobrado: queda realizado y vinculado a la venta
      if (appt) {
        await client.query(
          `UPDATE appointments SET sale_id = $1, status = 'done', staff_id = COALESCE($3, staff_id), updated_at = now()
           WHERE id = $2`,
          [sale.id, appt.id, current.rows[0].staff_id]
        );
      }
      // Los servicios cobrados quedan en el historial de visitas del cliente
      const customerId = current.rows[0].customer_id;
      if (customerId) {
        const services = await client.query(
          `SELECT i.description FROM sale_items i JOIN products p ON p.id = i.product_id
           WHERE i.sale_id = $1 AND p.is_service = true ORDER BY i.id`,
          [sale.id]
        );
        if (services.rowCount) {
          const staffName = current.rows[0].staff_id
            ? (await client.query('SELECT name FROM users WHERE id = $1', [current.rows[0].staff_id])).rows[0]?.name
            : null;
          await client.query(
            `INSERT INTO customer_visits (customer_id, visited_at, service, staff_id, staff_name, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              customerId,
              current.rows[0].issued_at,
              services.rows.map((row) => row.description).join(' + '),
              current.rows[0].staff_id,
              staffName,
              appt?.notes || null,
              req.user?.id || null,
            ]
          );
        }
      }
      return sale.id;
    });
    res.status(201).json({ data: await loadSale(saleId) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sale = await loadSale(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json({ data: sale });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const sale = await withTransaction((client) => saveSale(client, null, req.body, req.user));
    res.status(201).json({ data: await loadSale(sale.id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await withTransaction((client) => saveSale(client, req.params.id, req.body, req.user));
    res.json({ data: await loadSale(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/confirm', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
      if (current.rows[0].status !== 'draft') throw httpError(400, 'Solo se confirman borradores');
      await confirmSaleStock(client, current.rows[0].id);
      await client.query(`UPDATE sales SET status = 'confirmed', updated_at = now() WHERE id = $1`, [
        current.rows[0].id,
      ]);
    });
    res.json({ data: await loadSale(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
      const sale = current.rows[0];
      if (sale.status === 'cancelled') throw httpError(400, 'La venta ya está cancelada');
      if (sale.status === 'confirmed') await reverseSaleStock(client, sale.id);
      await client.query(`UPDATE sales SET status = 'cancelled', updated_at = now() WHERE id = $1`, [sale.id]);
    });
    res.json({ data: await loadSale(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await withTransaction((client) => deleteSaleRecord(client, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/payments', async (req, res, next) => {
  try {
    const payment = await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
      const sale = current.rows[0];
      if (sale.status !== 'confirmed') throw httpError(400, 'Solo se cobran ventas confirmadas');
      const amount = money(req.body?.amount);
      if (amount <= 0) throw httpError(400, 'El importe debe ser mayor a cero');
      const inserted = await client.query(
        `INSERT INTO payments (kind, customer_id, sale_id, amount, method, paid_at, notes, created_by)
         VALUES ('in', $1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          sale.customer_id,
          sale.id,
          amount,
          req.body?.method || 'cash',
          req.body?.paidAt || new Date().toISOString().slice(0, 10),
          emptyToNull(req.body?.notes),
          req.user?.id || null,
        ]
      );
      await refreshSalePaid(client, sale.id);
      return inserted.rows[0];
    });
    res.status(201).json({ data: { payment, sale: await loadSale(req.params.id) } });
  } catch (err) {
    next(err);
  }
});

async function saveSale(client, id, body, user) {
  const userId = user?.id;
  const items = await mapSaleItems(client, body.items || []);
  const staff = await resolveStaff(client, body.staffId, user);
  if (!items.length) throw httpError(400, 'Agregá al menos un producto');
  const settings = await client.query('SELECT tax_rate FROM store_settings WHERE id = 1');
  const totals = computeDocTotals(items, body.taxRate ?? settings.rows[0]?.tax_rate);
  if (id) {
    const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
    if (current.rows[0].status !== 'draft') throw httpError(400, 'Solo se editan borradores');
    await client.query(
      `UPDATE sales
       SET customer_id = $1, issued_at = $2, notes = $3, subtotal = $4, tax = $5, total = $6,
           staff_id = $8, commission_pct = $9, updated_at = now()
       WHERE id = $7`,
      [
        body.customerId || null,
        body.issuedAt || current.rows[0].issued_at,
        emptyToNull(body.notes),
        totals.subtotal,
        totals.tax,
        totals.total,
        id,
        staff.id,
        staff.pct,
      ]
    );
    await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
    await insertSaleItems(client, id, items);
    return current.rows[0];
  }
  const number = await nextNumber(client, 'sales', 'V');
  const inserted = await client.query(
    `INSERT INTO sales (number, customer_id, issued_at, notes, subtotal, tax, total, created_by, staff_id, commission_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      number,
      body.customerId || null,
      body.issuedAt || new Date().toISOString().slice(0, 10),
      emptyToNull(body.notes),
      totals.subtotal,
      totals.tax,
      totals.total,
      userId || null,
      staff.id,
      staff.pct,
    ]
  );
  await insertSaleItems(client, inserted.rows[0].id, items);
  return inserted.rows[0];
}

async function mapSaleItems(client, items) {
  const mapped = [];
  for (const item of items) {
    const product = await client.query('SELECT * FROM products WHERE id = $1', [item.productId]);
    if (!product.rowCount) throw httpError(400, 'Producto inválido');
    const quantity = qty(item.qty);
    const unitPrice = money(item.unitPrice ?? product.rows[0].sale_price);
    if (quantity <= 0) throw httpError(400, 'La cantidad debe ser mayor a cero');
    mapped.push({
      product_id: product.rows[0].id,
      description: product.rows[0].name,
      qty: quantity,
      unit_price: unitPrice,
      cost_price: money(product.rows[0].cost_price),
      line_total: money(quantity * unitPrice),
    });
  }
  return mapped;
}

async function insertSaleItems(client, saleId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO sale_items (sale_id, product_id, description, qty, unit_price, cost_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [saleId, item.product_id, item.description, item.qty, item.unit_price, item.cost_price, item.line_total]
    );
  }
}

async function loadSale(id) {
  const result = await query(`${SALE_SELECT} WHERE s.id = $1`, [id]);
  if (!result.rowCount) return null;
  const items = await query(
    `SELECT i.*, p.sku, p.unit, p.stock_qty
     FROM sale_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.sale_id = $1
     ORDER BY i.id`,
    [id]
  );
  const payments = await query('SELECT * FROM payments WHERE sale_id = $1 ORDER BY paid_at, id', [id]);
  return { ...result.rows[0], items: items.rows, payments: payments.rows };
}

export default router;

// Empleado de la venta y su % de comisión en ese momento.
// Si no se indica, la venta queda a nombre de quien la carga.
async function resolveStaff(client, staffId, user) {
  const id = staffId ? Number(staffId) : user?.id || null;
  if (!id) return { id: null, pct: 0 };
  const result = await client.query('SELECT id, commission_pct FROM users WHERE id = $1', [id]);
  if (!result.rowCount) throw httpError(400, 'Empleado inválido');
  return { id: result.rows[0].id, pct: money(result.rows[0].commission_pct) };
}
