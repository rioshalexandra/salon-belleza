import { Router } from 'express';
import { query } from '../db/pool.js';

// Rubros que puede trabajar el negocio
export const BUSINESS_TYPES = ['peluqueria', 'barberia', 'estetica', 'unas', 'depilacion', 'masajes'];

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM store_settings WHERE id = 1');
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM store_settings WHERE id = 1');
    const prev = current.rows[0];
    const {
      name = prev.name,
      timezone = prev.timezone,
      currency = prev.currency,
      taxRate = prev.tax_rate,
    } = req.body || {};
    // Solo se aceptan rubros conocidos; si no viene ninguno se mantiene lo anterior
    const types = Array.isArray(req.body?.businessTypes)
      ? req.body.businessTypes.filter((t) => BUSINESS_TYPES.includes(t))
      : prev.business_types;
    const result = await query(
      `UPDATE store_settings
       SET name = $1, timezone = $2, currency = $3, tax_rate = $4, business_types = $5, updated_at = now()
       WHERE id = 1
       RETURNING *`,
      [name, timezone, currency, taxRate, types.length ? types : prev.business_types]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
