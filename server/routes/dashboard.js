// Resumen de la página de inicio.
// Administración ve todo el negocio y una tarjeta por empleado.
// Un empleado ve solo su tarjeta, sus turnos de hoy y los cumpleaños.
import { Router } from 'express';
import { query } from '../db/pool.js';
import { isAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    // El navegador manda su fecha local (?today=AAAA-MM-DD) para que "hoy" sea el día
    // del salón y no el del servidor (que suele estar en hora UTC).
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today || '')) ? req.query.today : null;
    const admin = isAdmin(req);
    // Para un empleado, todas las consultas se limitan a él mismo
    const onlyStaff = admin ? null : req.user.id;

    const [staff, todayAppts, birthdays] = await Promise.all([
      // Una fila por empleado activo: turnos de hoy, facturado y comisión del mes
      query(
        `SELECT u.id, u.name, u.color, u.role, u.commission_pct,
                COALESCE(t.total, 0)::int AS today_total,
                COALESCE(t.done, 0)::int AS today_done,
                t.next_time,
                COALESCE(m.billed, 0)::numeric AS month_billed,
                COALESCE(m.commission, 0)::numeric AS month_commission,
                COALESCE(m.sales, 0)::int AS month_sales,
                COALESCE(d.billed, 0)::numeric AS today_billed
         FROM users u
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE a.status = 'done') AS done,
                  to_char(MIN(a.start_time) FILTER (WHERE a.status = 'scheduled'), 'HH24:MI') AS next_time
           FROM appointments a
           WHERE a.staff_id = u.id AND a.day = COALESCE($1::date, CURRENT_DATE) AND a.status <> 'cancelled'
         ) t ON true
         LEFT JOIN LATERAL (
           SELECT SUM(s.subtotal) AS billed,
                  SUM(s.subtotal * s.commission_pct / 100) AS commission,
                  COUNT(*) AS sales
           FROM sales s
           WHERE s.staff_id = u.id AND s.status = 'confirmed'
             AND s.issued_at >= date_trunc('month', COALESCE($1::date, CURRENT_DATE))
             AND s.issued_at <= COALESCE($1::date, CURRENT_DATE)
         ) m ON true
         LEFT JOIN LATERAL (
           SELECT SUM(s.subtotal) AS billed FROM sales s
           WHERE s.staff_id = u.id AND s.status = 'confirmed' AND s.issued_at = COALESCE($1::date, CURRENT_DATE)
         ) d ON true
         WHERE u.active = true AND ($2::int IS NULL OR u.id = $2)
         ORDER BY u.name`,
        [today, onlyStaff]
      ),
      // Turnos de hoy (sin los cancelados)
      query(
        `SELECT a.id, to_char(a.start_time, 'HH24:MI') AS start_hhmm, a.status, a.customer_id,
                COALESCE(c.name, a.customer_name) AS customer, COALESCE(p.name, a.service_name) AS service,
                COALESCE(u.name, a.staff_name) AS staff_name, u.color AS staff_color
         FROM appointments a
         LEFT JOIN customers c ON c.id = a.customer_id
         LEFT JOIN products p ON p.id = a.service_id
         LEFT JOIN users u ON u.id = a.staff_id
         WHERE a.day = COALESCE($1::date, CURRENT_DATE) AND a.status <> 'cancelled'
           AND ($2::int IS NULL OR a.staff_id = $2)
         ORDER BY a.start_time`,
        [today, onlyStaff]
      ),
      // Clientes que cumplen años este mes
      query(
        `SELECT id, name, phone, birthday
         FROM customers
         WHERE birthday IS NOT NULL AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM COALESCE($1::date, CURRENT_DATE))
         ORDER BY EXTRACT(DAY FROM birthday)`,
        [today]
      ),
    ]);

    const data = {
      isAdmin: admin,
      staff: staff.rows,
      todayAppointments: todayAppts.rows,
      birthdays: birthdays.rows,
    };

    if (admin) {
      const [cash, month, lowStock] = await Promise.all([
        // Caja del día: lo cobrado hoy por medio de pago
        query(
          `SELECT method, SUM(amount)::numeric AS total
           FROM payments
           WHERE kind = 'in' AND paid_at = COALESCE($1::date, CURRENT_DATE)
           GROUP BY method ORDER BY total DESC`,
          [today]
        ),
        // Totales del mes del negocio
        query(
          `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count,
                  COALESCE(SUM(subtotal * commission_pct / 100), 0)::numeric AS commissions
           FROM sales
           WHERE status = 'confirmed'
             AND issued_at >= date_trunc('month', COALESCE($1::date, CURRENT_DATE))
             AND issued_at <= COALESCE($1::date, CURRENT_DATE)`,
          [today]
        ),
        // Productos de reventa con stock en o por debajo del mínimo
        query(
          `SELECT id, name, stock_qty, min_stock, unit
           FROM products
           WHERE active = true AND is_service = false AND min_stock > 0 AND stock_qty <= min_stock
           ORDER BY name LIMIT 10`
        ),
      ]);
      data.cashToday = cash.rows;
      data.month = month.rows[0];
      data.lowStock = lowStock.rows;
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
