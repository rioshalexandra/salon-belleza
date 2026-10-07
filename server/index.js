import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { assertRuntimeConfig, config } from './config.js';
import { requireAdmin, requireAuth, userFromToken, readToken } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import dashboardRouter from './routes/dashboard.js';
import productsRouter from './routes/products.js';
import { partyRouter } from './routes/parties.js';
import salesRouter from './routes/sales.js';
import purchasesRouter from './routes/purchases.js';
import paymentsRouter from './routes/payments.js';
import pricesRouter from './routes/prices.js';
import ioRouter from './routes/io.js';
import attachmentsRouter from './routes/attachments.js';
import movementsRouter from './routes/movements.js';
import appointmentsRouter from './routes/appointments.js';
import staffRouter from './routes/staff.js';
import { ensureUploadDir } from './lib/storage.js';

assertRuntimeConfig();
await ensureUploadDir();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const hasFrontendBuild = fs.existsSync(path.join(publicDir, 'index.html'));

const app = express();
app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()),
  })
);
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gestion-stock',
    frontend: hasFrontendBuild,
  });
});

app.use('/api/auth', async (req, res, next) => {
  if (req.path === '/login') return next();
  const user = await userFromToken(readToken(req));
  if (user) req.user = user;
  next();
}, authRouter);
// Permite leer a todos los empleados, pero solo administración puede modificar
const readAllWriteAdmin = (req, res, next) => (req.method === 'GET' ? next() : requireAdmin(req, res, next));
// Los empleados pueden cargar y editar clientes, pero borrar es solo para administración
const deleteAdmin = (req, res, next) => (req.method === 'DELETE' ? requireAdmin(req, res, next) : next());

// Rutas que usan todos los empleados
app.use('/api/settings', requireAuth, readAllWriteAdmin, settingsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/products', requireAuth, readAllWriteAdmin, productsRouter);
app.use('/api/customers', requireAuth, deleteAdmin, partyRouter('customers'));
app.use('/api/sales', requireAuth, salesRouter);
app.use('/api/appointments', requireAuth, appointmentsRouter);
app.use('/api/staff', requireAuth, staffRouter);
// Rutas solo para administración
app.use('/api/suppliers', requireAuth, requireAdmin, partyRouter('suppliers'));
app.use('/api/purchases', requireAuth, requireAdmin, purchasesRouter);
app.use('/api/payments', requireAuth, requireAdmin, paymentsRouter);
app.use('/api/prices', requireAuth, requireAdmin, pricesRouter);
app.use('/api/movements', requireAuth, requireAdmin, movementsRouter);
app.use('/api/io', requireAuth, requireAdmin, ioRouter);
app.use('/api/attachments', (req, res, next) => {
  if (req.method === 'GET') return next();
  return requireAuth(req, res, next);
}, attachmentsRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (hasFrontendBuild) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api(?:\/|$)|\/health(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  let status = err.status || 500;
  let message = err.message || 'Error interno';
  if (err.code === '23505') {
    status = 409;
    message = 'Ya existe un registro con esos datos';
  }
  if (err.code === '23503') {
    status = 409;
    message = 'No se puede eliminar porque tiene movimientos asociados';
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'El archivo supera los 12 MB';
  }
  // overlap: el turno se superpone con otro del mismo empleado (la app pregunta si guardarlo igual)
  res.status(status).json({ error: message, ...(err.overlap ? { overlap: true } : {}) });
});

app.listen(config.port, () => {
  console.log(`Salón de belleza listening on :${config.port}`);
  if (hasFrontendBuild) {
    console.log(`Serving UI from ${publicDir}`);
  }
});
