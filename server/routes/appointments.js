// Agenda de turnos del salón.
// Cada turno tiene día, hora, servicio, empleado que atiende y cliente.
// El cobro de un turno se hace desde /api/sales/quick (cobro en un solo paso).
import { Router } from 'express';
import { query } from '../db/pool.js';
import { emptyToNull, httpError, money } from '../lib/helpers.js';

const router = Router();

const STATUSES = ['scheduled', 'done', 'cancelled', 'no_show'];

// Consulta base: trae el nombre actual del cliente, del servicio y del empleado
const APPOINTMENT_SELECT = `
  SELECT a.*,
         to_char(a.start_time, 'HH24:MI') AS start_hhmm,
         to_char(a.start_time + make_interval(mins => a.duration_min), 'HH24:MI') AS end_hhmm,
         COALESCE(c.name, a.customer_name) AS display_customer,
         c.phone AS customer_phone,
         COALESCE(p.name, a.service_name) AS display_service,
         p.sale_price AS service_price,
         COALESCE(u.name, a.staff_name) AS display_staff,
         u.color AS staff_color,
         s.number AS sale_number
  FROM appointments a
  LEFT JOIN customers c ON c.id = a.customer_id
  LEFT JOIN products p ON p.id = a.service_id
  LEFT JOIN users u ON u.id = a.staff_id
  LEFT JOIN sales s ON s.id = a.sale_id
`;

// Lista de turnos entre dos fechas (?from=AAAA-MM-DD&to=AAAA-MM-DD). Por defecto, hoy.
// ?staffId=N filtra por empleado.
router.get('/', async (req, res, next) => {
  try {
    const params = [req.query.from || null, req.query.to || req.query.from || null];
    let where = 'a.day BETWEEN COALESCE($1::date, CURRENT_DATE) AND COALESCE($2::date, CURRENT_DATE)';
    if (req.query.staffId) {
      params.push(Number(req.query.staffId));
      where += ` AND a.staff_id = $${params.length}`;
    }
    const result = await query(`${APPOINTMENT_SELECT} WHERE ${where} ORDER BY a.day, a.start_time, a.id`, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const appt = await loadAppointment(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Turno no encontrado' });
    res.json({ data: appt });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const id = await saveAppointment(null, req.body, req.user);
    res.status(201).json({ data: await loadAppointment(id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await saveAppointment(req.params.id, req.body, req.user);
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
    const result = await query(`UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`, [
      status,
      req.params.id,
    ]);
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

// Crea o actualiza un turno validando los datos del formulario
async function saveAppointment(id, body = {}, user) {
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
    serviceName = svc.rows[0].name;
    duration = duration || svc.rows[0].duration_min;
  }
  duration = duration || 60;

  // Empleado que atiende: si no se indica, un empleado (no admin) queda asignado a sí mismo
  let staffId = body.staffId ? Number(body.staffId) : null;
  if (!staffId && user?.role === 'staff') staffId = user.id;
  let staffName = null;
  if (staffId) {
    const staff = await query('SELECT name FROM users WHERE id = $1', [staffId]);
    if (!staff.rowCount) throw httpError(400, 'Empleado inválido');
    staffName = staff.rows[0].name;
  }

  const status = STATUSES.includes(body.status) ? body.status : 'scheduled';

  // Aviso si el empleado ya tiene otro turno que se superpone (se puede forzar con allowOverlap)
  if (staffId && status === 'scheduled' && !body.allowOverlap) {
    const clash = await query(
      `SELECT to_char(start_time, 'HH24:MI') AS desde,
              to_char(start_time + make_interval(mins => duration_min), 'HH24:MI') AS hasta
       FROM appointments
       WHERE staff_id = $1 AND day = $2 AND status IN ('scheduled', 'done') AND id <> COALESCE($5::int, 0)
         AND start_time < ($3::time + make_interval(mins => $4::int))
         AND (start_time + make_interval(mins => duration_min)) > $3::time
       LIMIT 1`,
      [staffId, day, startTime, duration, id ? Number(id) : null]
    );
    if (clash.rowCount) {
      const err = httpError(409, `${staffName} ya tiene un turno de ${clash.rows[0].desde} a ${clash.rows[0].hasta}`);
      err.overlap = true;
      throw err;
    }
  }

  const price = body.price === '' || body.price == null ? null : money(body.price);
  const values = [
    customerId,
    customerName,
    serviceId,
    serviceName,
    staffId,
    staffName,
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
       SET customer_id = $1, customer_name = $2, service_id = $3, service_name = $4, staff_id = $5,
           staff_name = $6, day = $7, start_time = $8, duration_min = $9, status = $10, price = $11,
           notes = $12, updated_at = now()
       WHERE id = $13
       RETURNING id`,
      [...values, id]
    );
    if (!result.rowCount) throw httpError(404, 'Turno no encontrado');
    return result.rows[0].id;
  }
  const result = await query(
    `INSERT INTO appointments
       (customer_id, customer_name, service_id, service_name, staff_id, staff_name, day, start_time,
        duration_min, status, price, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [...values, user?.id || null]
  );
  return result.rows[0].id;
}

async function loadAppointment(id) {
  const result = await query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [id]);
  return result.rows[0] || null;
}

export default router;
