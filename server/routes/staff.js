// Empleados del salón. Cada empleado es un usuario que puede entrar a la app.
// GET está disponible para todos (para elegir profesional en turnos y cobros);
// crear, editar y dar de baja es solo para administración.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { emptyToNull, httpError } from '../lib/helpers.js';

const router = Router();

// Colores para diferenciar a cada empleado en la agenda
const PALETTE = ['#b08a3e', '#c2667f', '#5b8a72', '#6a6fb3', '#c97b43', '#8f5fa8', '#3f8fa6', '#a35252'];

const STAFF_SELECT = `
  SELECT id, username, name, role, active, commission_pct, color, phone, created_at
  FROM users
`;

router.get('/', async (req, res, next) => {
  try {
    // ?all=1 incluye a los dados de baja (para la pantalla de administración)
    const all = req.query.all === '1' && req.user?.role === 'admin';
    const result = await query(`${STAFF_SELECT} ${all ? '' : 'WHERE active = true'} ORDER BY active DESC, name`);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!name) throw httpError(400, 'El nombre es obligatorio');
    if (!/^[a-z0-9._-]{3,}$/.test(username)) {
      throw httpError(400, 'El usuario debe tener al menos 3 letras o números, sin espacios');
    }
    if (password.length < 6) throw httpError(400, 'La contraseña debe tener al menos 6 caracteres');
    const count = await query('SELECT COUNT(*)::int AS n FROM users');
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (username, password_hash, name, role, commission_pct, color, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        username,
        hash,
        name,
        body.role === 'admin' ? 'admin' : 'staff',
        pct(body.commissionPct),
        emptyToNull(body.color) || PALETTE[count.rows[0].n % PALETTE.length],
        emptyToNull(body.phone),
      ]
    );
    res.status(201).json({ data: await loadStaff(result.rows[0].id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const id = Number(req.params.id);
    const current = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!current.rowCount) throw httpError(404, 'Empleado no encontrado');
    const prev = current.rows[0];
    const role = body.role === 'staff' ? 'staff' : body.role === 'admin' ? 'admin' : prev.role;
    const active = body.active === undefined ? prev.active : Boolean(body.active);

    // Nunca dejar el negocio sin al menos un administrador activo
    if (prev.role === 'admin' && (role !== 'admin' || !active)) {
      const admins = await query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND active = true AND id <> $1`, [id]);
      if (!admins.rows[0].n) throw httpError(400, 'Tiene que quedar al menos un administrador activo');
    }

    await query(
      `UPDATE users SET name = $1, role = $2, active = $3, commission_pct = $4, color = $5, phone = $6 WHERE id = $7`,
      [
        String(body.name ?? prev.name).trim() || prev.name,
        role,
        active,
        body.commissionPct === undefined ? prev.commission_pct : pct(body.commissionPct),
        emptyToNull(body.color) || prev.color,
        body.phone === undefined ? prev.phone : emptyToNull(body.phone),
        id,
      ]
    );
    // Cambio de contraseña opcional
    if (body.password) {
      if (String(body.password).length < 6) throw httpError(400, 'La contraseña debe tener al menos 6 caracteres');
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(String(body.password), 10), id]);
    }
    // Si se da de baja, se cierran sus sesiones abiertas
    if (!active) await query('DELETE FROM sessions WHERE user_id = $1', [id]);
    res.json({ data: await loadStaff(id) });
  } catch (err) {
    next(err);
  }
});

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n * 100) / 100);
}

async function loadStaff(id) {
  const result = await query(`${STAFF_SELECT} WHERE id = $1`, [id]);
  return result.rows[0];
}

export default router;
