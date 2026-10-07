# Salón de belleza

Gestión para un salón de belleza: agenda de turnos, ficha de clientes, servicios y venta de productos con stock. Un solo servicio sirve la interfaz y la API; PostgreSQL guarda los datos.

Basado en el template [gestion-stock](https://github.com/ProfesIA-IA/gestion-stock) de ProfesIA.

## Qué hace

El staff entra con usuario y contraseña. Con `SEED_DEMO=true` y la base vacía, se cargan servicios, productos, clientes y turnos de ejemplo.

| Área | Qué incluye |
|------|-------------|
| **Inicio** | Turnos de hoy, ventas del mes, cumpleaños del mes y productos para reponer |
| **Agenda** | Turnos por día con vista semanal, profesional, estado (pendiente, realizado, no vino, cancelado) y botón **Cobrar** que arma la venta |
| **Clientes** | Ficha de belleza (cumpleaños, Instagram, tipo de cabello y piel, fórmula de color, alergias, preferencias), historial de visitas, turnos y saldo |
| **Servicios** | Corte, color, manicura… con precio, costo de insumos y duración. No manejan stock |
| **Productos** | Productos de reventa con código, categoría, costo, precio, stock y mínimo |
| **Ventas** | Servicios y productos en el mismo comprobante; al confirmar solo descuenta stock de productos |
| **Proveedores y compras** | Compras que ingresan stock y actualizan costo, pagos al proveedor |
| **Precios, pagos, CSV / Excel, configuración** | Igual que el template original |

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19 + Vite + Tailwind 4 |
| API | Express en el mismo proceso |
| Base | PostgreSQL 16 |
| Deploy | Railway (Nixpacks) e IaC en `.railway/railway.ts` |

```text
Navegador  →  Stock (React + API)  →  Postgres
```

## Desarrollo local

Requisitos: Node 20+, Docker (para Postgres) y npm.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev
```

Atajo equivalente:

```bash
npm run setup
npm run dev
```

- Interfaz: http://localhost:5173
- API: http://localhost:3001
- Salud: http://localhost:3001/health
- Usuario: `admin` / `admin123`

En desarrollo Vite hace proxy de `/api` al backend. En producción un solo proceso sirve el build estático y la API.

### Variables locales

Copiá `.env.example`. Las más usadas:

| Variable | Default | Uso |
|----------|---------|-----|
| `DATABASE_URL` | `postgres://stock:stock@localhost:5433/stock` | Conexión a Postgres (Docker publica 5433) |
| `PORT` | `3001` | Puerto de la API |
| `DEFAULT_ADMIN_USER` | `admin` | Usuario inicial |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Contraseña inicial (solo local) |
| `STORE_TIMEZONE` | `America/Argentina/Buenos_Aires` | Zona horaria |
| `STORE_NAME` | `Comercio Demo` | Nombre visible |
| `SEED_DEMO` | `true` | Carga productos, clientes y comprobantes de ejemplo si la base está vacía |
| `CORS_ORIGIN` | `*` | Orígenes permitidos |

## Cómo usar el sistema

### Productos y stock

1. Entrá a **Productos**. Creá SKU, precios y stock mínimo.
2. El stock baja al **confirmar** una venta y sube al confirmar una compra.
3. Desde la ficha del producto podés hacer un ajuste (+ / −) con motivo.

### Ventas y cobros

1. **Ventas → Nueva venta**. Buscá productos, cargá cantidades y precio.
2. Guardá borrador o **Confirmar y mover stock**.
3. En un comprobante confirmado registrá cobros (efectivo, transferencia, tarjeta, cheque).
4. El saldo del cliente es lo no cobrado de ventas confirmadas.

### Compras y pagos a proveedores

Mismo flujo: borrador → confirmar (ingresa mercadería y actualiza costo) → registrar pagos.

### Precios masivos

En **Precios** elegí porcentaje o importe, una categoría o todo el catálogo, previsualizá y aplicá. Queda historial.

### CSV / Excel

En **CSV / Excel** descargá la plantilla, editala y subila. Los productos se actualizan por SKU; clientes y proveedores por CUIT o nombre.

## Producción en Railway

`npm start` corre migraciones y levanta Express sirviendo el build de Vite (`server/public`).

Healthcheck: `GET /health` → `{ "ok": true }`.

| Variable | En Railway |
|----------|------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `DEFAULT_ADMIN_USER` | `admin` |
| `DEFAULT_ADMIN_PASSWORD` | `${{secret(20)}}` (copiala de Variables al primer login) |
| `STORE_TIMEZONE` | `America/Argentina/Buenos_Aires` |
| `STORE_NAME` | Nombre del comercio |
| `SEED_DEMO` | `true` la primera vez; después podés pasarlo a `false` |
| `CORS_ORIGIN` | `*` o el dominio público |

Después del deploy:

1. Generá un dominio HTTPS para el servicio **stock**.
2. Copiá `DEFAULT_ADMIN_PASSWORD` de las variables del servicio.
3. Entrá con usuario `admin`.
4. Revisá productos demo y cargá tu lista (o importá CSV/Excel).

Definición IaC: [`.railway/railway.ts`](.railway/railway.ts). Guía de plantilla: [`template/TEMPLATE.md`](template/TEMPLATE.md).

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | API + Vite en paralelo |
| `npm run dev:api` | Solo API, con recarga |
| `npm run dev:web` | Solo frontend |
| `npm run build` | Build de producción |
| `npm run migrate` | Aplica `server/db/schema.sql` |
| `npm start` | Migraciones + servidor (producción) |
| `npm run setup` | Postgres local, dependencias y migrate |

## Publicar o actualizar el template

Hace falta una cuenta Railway verificada. Categoría válida del marketplace: `Starters`. La descripción corta tiene un máximo de 75 caracteres.

```bash
railway templates create --project gestion-stock --environment production --json
railway templates publish <template-id> \
  --category Starters \
  --description "Stock, ventas, compras, precios masivos y CSV/Excel" \
  --readme-file template/marketplace.md \
  --json
```

Más detalle en [`template/TEMPLATE.md`](template/TEMPLATE.md) y el texto del marketplace en [`template/marketplace.md`](template/marketplace.md).
