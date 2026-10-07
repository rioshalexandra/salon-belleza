// Agenda de turnos del salón.
// Cada turno tiene día, hora, servicio, profesional y cliente.
// Desde un turno se puede "cobrar": se crea una venta en borrador con el servicio
// y el turno queda marcado como realizado.
import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { computeDocTotals, emptyToNull, httpError, money, nextNumber } from '../lib/helpers.js';

const router = Router();

const STATUSES = ['scheduled', 'done', 'cancelled', 'no_show'];

// Consulta base: trae también el nombre actual del cliente y del servicio
const APPOINTMENT_SELECT = `
  SELECT a.*,
         to_char(a.start_time, 'HH24:MI') AS start_hhmm,
         to_char(a.start_time + make_interval(mins => a.duration_min), 'HH24:MI') AS end_hhmm,
         COALESCE(c.name, a.customer_name) AS display_customer,
         c.phone AS customer_phone,
         COALESCE(p.name, a.service_name) AS display_service,
         s.number AS sale_number
  FROM appointments a
  LEFT JOIN customers c ON c.id = a.customer_id
  LEFT JOIN products p ON p.id = a.service_id
  LEFT JOIN sales s ON s.id = a.sale_id
`;

// Lista de turnos entre dos fechas (?from=AAAA-MM-DD&to=AAAA-MM-DD). Por defecto, hoy.
router.get('/', async (req, res, next) => {
  try {
    const from = req.query.from || null;
    const to = req.query.to || req.query.from || null;
    const result = await query(
      `${APPOINTMENT_SELECT}
       WHERE a.day BETWEEN COALESCE($1::date, CURRENT_DATE) AND COALESCE($2::date, CURRENT_DATE)
       ORDER BY a.day, a.start_time, a.id`,
      [from, to]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// Nombres de profesionales ya usados, para sugerirlos al cargar un turno
router.get('/staff', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT DISTINCT staff_name AS name FROM appointments WHERE staff_name IS NOT NULL
       UNION
       SELECT DISTINCT staff_name FROM customer_visits WHERE staff_name IS NOT NULL
       ORDER BY 1`
    );
    res.json({ data: result.rows.map((row) => row.name) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Turno no encontrado' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const id = await saveAppointment(null, req.body, req.user?.id);
    res.status(201).json({ data: await loadAppointment(id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await saveAppointment(req.params.id, req.body, req.user?.id);
    res.json({ data: await loadAppointment(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Cambiar solo el estado (realizado, cancelado, no vino, pendiente)
router.post('/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body?.status || '');
    if (!STATUSES.includes(status)) throw httpError(400, 'Estado inválido');
    const result = await query(
      `UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
      [status, req.params.id]
    );
    if (!result.rowCount) throw httpError(404, 'Turno no encontrado');
    res.json({ data: await loadAppointment(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Cobrar un turno: crea una venta en borrador con el servicio, marca el turno como
// realizado y anota la visita en la ficha del cliente. Devuelve el id de la venta.
router.post('/:id/checkout', async (req, res, next) => {
  try {
    const saleId = await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Turno no encontrado');
      const appt = current.rows[0];
      if (appt.sale_id) return appt.sale_id; // ya tenía venta: la reutilizamos
      if (!appt.service_id) throw httpError(400, 'Elegí un servicio de la lista para poder cobrar el turno');

      const service = await client.query('SELECT * FROM products WHERE id = $1', [appt.service_id]);
      if (!service.rowCount) throw httpError(400, 'El servicio ya no existe');
      const svc = service.rows[0];
      const unitPrice = appt.price != null ? money(appt.price) : money(svc.sale_price);
      const item = {
        product_id: svc.id,
        description: svc.name,
        qty: 1,
        unit_price: unitPrice,
        cost_price: money(svc.cost_price),
        line_total: unitPrice,
      };
      const settings = await client.query('SELECT tax_rate FROM store_settings WHERE id = 1');
      const totals = computeDocTotals([item], settings.rows[0]?.tax_rate);
      const number = await nextNumber(client, 'sales', 'V');
      const sale = await client.query(
        `INSERT INTO sales (number, customer_id, issued_at, notes, subtotal, tax, total, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          number,
          appt.customer_id,
          appt.day,
          `Turno ${String(appt.start_time).slice(0, 5)}${appt.staff_name ? ` con ${appt.staff_name}` : ''}`,
          totals.subtotal,
          totals.tax,
          totals.total,
          req.user?.id || null,
        ]
      );
      const newSaleId = sale.rows[0].id;
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, description, qty, unit_price, cost_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newSaleId, item.product_id, item.description, item.qty, item.unit_price, item.cost_price, item.line_total]
      );
      await client.query(
        `UPDATE appointments SET sale_id = $1, status = 'done', updated_at = now() WHERE id = $2`,
        [newSaleId, appt.id]
      );
      // Queda registrado en el historial de visitas del cliente
      if (appt.customer_id) {
        await client.query(
          `INSERT INTO customer_visits (customer_id, visited_at, service, staff_name, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [appt.customer_id, appt.day, svc.name, appt.staff_name, appt.notes, req.user?.id || null]
        );
      }
      return newSaleId;
    });
    res.json({ data: { saleId } });
  } catch (err) {
    next(err);
  }
});

// Crea o actualiza un turno validando los datos del formulario
async function saveAppointment(id, body = {}, userId) {
  const day = String(body.day || '').trim();
  const startTime = String(body.startTime || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw httpError(400, 'Elegí el día del turno');
  if (!/^\d{2}:\d{2}$/.test(startTime)) throw httpError(400, 'Elegí la hora del turno');

  const customerId = body.customerId ? Number(body.customerId) : null;
  const customerName = emptyToNull(body.customerName);
  if (!customerId && !customerName) throw httpError(400, 'Indicá el cliente');

  const serviceId = body.serviceId ? Number(body.serviceId) : null;
  let serviceName = emptyToNull(body.serviceName);
  let duration = Number(body.durationMin) > 0 ? Math.round(Number(body.durationMin)) : null;
  if (serviceId) {
    const svc = await query('SELECT name, duration_min FROM products WHERE id = $1', [serviceId]);
    if (!svc.rowCount) throw httpError(400, 'Servicio inválido');
    serviceName = serviceName || svc.rows[0].name;
    duration = duration || svc.rows[0].duration_min;
  }
  duration = duration || 60;

  const status = STATUSES.includes(body.status) ? body.status : 'scheduled';
  const price = body.price === '' || body.price == null ? null : money(body.price);
  const values = [
    customerId,
    customerName,
    serviceId,
    serviceName,
    emptyToNull(body.staffName),
    day,
    startTime,
    duration,
    status,
    price,
    emptyToNull(body.notes),
  ];

  if (id) {
    const result = await query(
      `UPDATE appointments
       SET customer_id = $1, customer_name = $2, service_id = $3, service_name = $4, staff_name = $5,
           day = $6, start_time = $7, duration_min = $8, status = $9, price = $10, notes = $11,
           updated_at = now()
       WHERE id = $12
       RETURNING id`,
      [...values, id]
    );
    if (!result.rowCount) throw httpError(404, 'Turno no encontrado');
    return result.rows[0].id;
  }
  const result = await query(
    `INSERT INTO appointments
       (customer_id, customer_name, service_id, service_name, staff_name, day, start_time, duration_min,
        status, price, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [...values, userId || null]
  );
  return result.rows[0].id;
}

async function loadAppointment(id) {
  const result = await query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [id]);
  return result.rows[0] || null;
}

export default router;
