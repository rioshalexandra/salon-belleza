import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    // El navegador manda su fecha local (?today=AAAA-MM-DD) para que "hoy" sea el día
    // del salón y no el del servidor (que suele estar en hora UTC).
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today || '')) ? req.query.today : null;
    const [sales, purchases, stock, receivable, payable, recentSales, todayAppts, birthdays, lowStock] =
      await Promise.all([
      query(
        `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count
         FROM sales
         WHERE status = 'confirmed' AND issued_at >= date_trunc('month', CURRENT_DATE)`
      ),
      query(
        `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count
         FROM purchases
         WHERE status = 'confirmed' AND issued_at >= date_trunc('month', CURRENT_DATE)`
      ),
      query(
        `SELECT COALESCE(SUM(stock_qty * cost_price), 0)::numeric AS cost_value,
                COALESCE(SUM(stock_qty * sale_price), 0)::numeric AS sale_value
         FROM products WHERE active = true AND is_service = false`
      ),
      query(
        `SELECT COALESCE(SUM(total - paid), 0)::numeric AS total
         FROM sales WHERE status = 'confirmed' AND total > paid`
      ),
      query(
        `SELECT COALESCE(SUM(total - paid), 0)::numeric AS total
         FROM purchases WHERE status = 'confirmed' AND total > paid`
      ),
      query(
        `SELECT s.id, s.number, s.issued_at, s.total, s.paid, s.status, c.name AS customer_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         ORDER BY s.created_at DESC
         LIMIT 6`
      ),
      // Turnos de hoy (sin los cancelados)
      query(
        `SELECT a.id, to_char(a.start_time, 'HH24:MI') AS start_hhmm, a.status, a.staff_name,
                COALESCE(c.name, a.customer_name) AS customer, COALESCE(p.name, a.service_name) AS service
         FROM appointments a
         LEFT JOIN customers c ON c.id = a.customer_id
         LEFT JOIN products p ON p.id = a.service_id
         WHERE a.day = COALESCE($1::date, CURRENT_DATE) AND a.status <> 'cancelled'
         ORDER BY a.start_time`,
        [today]
      ),
      // Clientes que cumplen años este mes
      query(
        `SELECT id, name, phone, birthday, EXTRACT(DAY FROM birthday)::int AS day
         FROM customers
         WHERE birthday IS NOT NULL AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM COALESCE($1::date, CURRENT_DATE))
         ORDER BY EXTRACT(DAY FROM birthday)`,
        [today]
      ),
      // Productos de reventa con stock en o por debajo del mínimo
      query(
        `SELECT id, name, stock_qty, min_stock, unit
         FROM products
         WHERE active = true AND is_service = false AND min_stock > 0 AND stock_qty <= min_stock
         ORDER BY name
         LIMIT 10`
      ),
    ]);

    res.json({
      data: {
        salesMonth: sales.rows[0],
        purchasesMonth: purchases.rows[0],
        stock: stock.rows[0],
        receivable: receivable.rows[0].total,
        payable: payable.rows[0].total,
        recentSales: recentSales.rows,
        todayAppointments: todayAppts.rows,
        birthdays: birthdays.rows,
        lowStock: lowStock.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
