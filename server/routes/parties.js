import { Router } from 'express';
import { query } from '../db/pool.js';
import { emptyToNull, httpError } from '../lib/helpers.js';

// Campos extra de la ficha de cliente del salón (solo aplican a la tabla customers).
// clave del body (camelCase) -> columna de la base
const CUSTOMER_EXTRA = {
  birthday: 'birthday',
  instagram: 'instagram',
  hairType: 'hair_type',
  skinType: 'skin_type',
  colorFormula: 'color_formula',
  sensitivities: 'sensitivities',
  preferences: 'preferences',
  nailNotes: 'nail_notes', // uñas
  waxingNotes: 'waxing_notes', // depilación
  beardNotes: 'beard_notes', // barbería
  massageNotes: 'massage_notes', // masajes (preferencias, no datos de salud)
};

export function partyRouter(table) {
  const router = Router();
  const label = table === 'customers' ? 'Cliente' : 'Proveedor';
  const fk = table === 'customers' ? 'customer_id' : 'supplier_id';
  const docs = table === 'customers' ? 'sales' : 'purchases';
  const balanceSql =
    table === 'customers'
      ? `COALESCE((SELECT SUM(s.total - s.paid) FROM sales s WHERE s.customer_id = p.id AND s.status = 'confirmed'), 0)`
      : `COALESCE((SELECT SUM(s.total - s.paid) FROM purchases s WHERE s.supplier_id = p.id AND s.status = 'confirmed'), 0)`;

  router.get('/', async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const params = [];
      // Para clientes sumamos la última visita y el próximo turno, útiles en el listado.
      const extraSql =
        table === 'customers'
          ? `,
             (SELECT MAX(v.visited_at) FROM customer_visits v WHERE v.customer_id = p.id) AS last_visit,
             (SELECT MIN(a.day) FROM appointments a
              WHERE a.customer_id = p.id AND a.status = 'scheduled' AND a.day >= CURRENT_DATE) AS next_appointment`
          : '';
      let sql = `SELECT p.*, ${balanceSql} AS balance${extraSql} FROM ${table} p`;
      if (q) {
        params.push(`%${q}%`);
        sql += ` WHERE p.name ILIKE $1 OR COALESCE(p.tax_id, '') ILIKE $1 OR COALESCE(p.phone, '') ILIKE $1`;
      }
      sql += ' ORDER BY p.name';
      const result = await query(sql, params);
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT p.*, ${balanceSql} AS balance FROM ${table} p WHERE p.id = $1`,
        [req.params.id]
      );
      if (!result.rowCount) return res.status(404).json({ error: `${label} no encontrado` });
      const documents = await query(
        `SELECT id, number, issued_at, status, total, paid
         FROM ${docs}
         WHERE ${fk} = $1
         ORDER BY issued_at DESC, id DESC
         LIMIT 80`,
        [req.params.id]
      );
      const payments = await query(
        `SELECT * FROM payments WHERE ${fk} = $1 ORDER BY paid_at DESC, id DESC LIMIT 80`,
        [req.params.id]
      );
      const data = { ...result.rows[0], documents: documents.rows, payments: payments.rows };
      if (table === 'customers') {
        // Historial de visitas y turnos del cliente
        const visits = await query(
          `SELECT * FROM customer_visits WHERE customer_id = $1 ORDER BY visited_at DESC, id DESC LIMIT 100`,
          [req.params.id]
        );
        const appointments = await query(
          `SELECT * FROM appointments WHERE customer_id = $1 ORDER BY day DESC, start_time DESC LIMIT 50`,
          [req.params.id]
        );
        data.visits = visits.rows;
        data.appointments = appointments.rows;
      }
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const row = await saveParty(table, label, null, req.body);
      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const row = await saveParty(table, label, req.params.id, req.body);
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  if (table === 'customers') {
    // Registrar una visita en el historial del cliente
    router.post('/:id/visits', async (req, res, next) => {
      try {
        const service = String(req.body?.service || '').trim();
        if (!service) throw httpError(400, 'Indicá qué servicio se hizo');
        const result = await query(
          `INSERT INTO customer_visits (customer_id, visited_at, service, staff_name, formula, notes, created_by)
           VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            req.params.id,
            emptyToNull(req.body?.visitedAt),
            service,
            emptyToNull(req.body?.staffName),
            emptyToNull(req.body?.formula),
            emptyToNull(req.body?.notes),
            req.user?.id || null,
          ]
        );
        res.status(201).json({ data: result.rows[0] });
      } catch (err) {
        next(err);
      }
    });

    // Borrar una visita del historial
    router.delete('/:id/visits/:visitId', async (req, res, next) => {
      try {
        await query('DELETE FROM customer_visits WHERE id = $1 AND customer_id = $2', [
          req.params.visitId,
          req.params.id,
        ]);
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    });
  }

  return router;
}

async function saveParty(table, label, id, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('El nombre es obligatorio');
    err.status = 400;
    throw err;
  }
  const values = [
    name,
    emptyToNull(body.taxId),
    emptyToNull(body.phone),
    emptyToNull(body.email),
    emptyToNull(body.address),
    emptyToNull(body.notes),
  ];
  if (table === 'customers') return saveCustomer(id, values, body);
  if (id) {
    const result = await query(
      `UPDATE ${table}
       SET name = $1, tax_id = $2, phone = $3, email = $4, address = $5, notes = $6
       WHERE id = $7
       RETURNING *`,
      [...values, id]
    );
    if (!result.rowCount) {
      const err = new Error(`${label} no encontrado`);
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  const result = await query(
    `INSERT INTO ${table} (name, tax_id, phone, email, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    values
  );
  return result.rows[0];
}

// Guarda un cliente con los datos básicos + la ficha del salón.
async function saveCustomer(id, baseValues, body) {
  const extraCols = Object.values(CUSTOMER_EXTRA);
  const extraValues = Object.keys(CUSTOMER_EXTRA).map((key) => emptyToNull(body[key]));
  const cols = ['name', 'tax_id', 'phone', 'email', 'address', 'notes', ...extraCols];
  const values = [...baseValues, ...extraValues];
  if (id) {
    const sets = cols.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const result = await query(
      `UPDATE customers SET ${sets} WHERE id = $${cols.length + 1} RETURNING *`,
      [...values, id]
    );
    if (!result.rowCount) throw httpError(404, 'Cliente no encontrado');
    return result.rows[0];
  }
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(
    `INSERT INTO customers (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return result.rows[0];
}
