-- Gestión de stock — schema idempotente (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Mi comercio',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  currency TEXT NOT NULL DEFAULT 'ARS',
  tax_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO store_settings (id, name)
VALUES (1, 'Mi comercio')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  barcode TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_status CHECK (status IN ('draft', 'confirmed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL,
  CONSTRAINT sale_items_qty CHECK (qty > 0)
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT purchases_status CHECK (status IN ('draft', 'confirmed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  CONSTRAINT purchase_items_qty CHECK (qty > 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
  purchase_id INT REFERENCES purchases(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_kind CHECK (kind IN ('in', 'out')),
  CONSTRAINT payments_amount CHECK (amount > 0),
  CONSTRAINT payments_method CHECK (method IN ('cash', 'transfer', 'card', 'check', 'other'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  kind TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2),
  ref_type TEXT,
  ref_id INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_kind CHECK (kind IN ('sale', 'purchase', 'adjustment', 'import', 'manual'))
);

CREATE TABLE IF NOT EXISTS price_adjustments (
  id SERIAL PRIMARY KEY,
  mode TEXT NOT NULL,
  value NUMERIC(14,4) NOT NULL,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  notes TEXT,
  product_count INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT price_adjustments_mode CHECK (mode IN ('percent', 'amount'))
);

CREATE TABLE IF NOT EXISTS price_adjustment_items (
  id SERIAL PRIMARY KEY,
  adjustment_id INT NOT NULL REFERENCES price_adjustments(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  old_price NUMERIC(14,2) NOT NULL,
  new_price NUMERIC(14,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token);
CREATE INDEX IF NOT EXISTS products_name_idx ON products (name);
CREATE INDEX IF NOT EXISTS products_sku_idx ON products (sku);
CREATE INDEX IF NOT EXISTS products_barcode_idx ON products (barcode);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (name);
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers (name);
CREATE INDEX IF NOT EXISTS sales_issued_idx ON sales (issued_at);
CREATE INDEX IF NOT EXISTS purchases_issued_idx ON purchases (issued_at);
CREATE INDEX IF NOT EXISTS payments_paid_idx ON payments (paid_at);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file',
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  storage_key TEXT NOT NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attachments_entity_type CHECK (entity_type IN ('product', 'purchase')),
  CONSTRAINT attachments_kind CHECK (kind IN ('photo', 'file'))
);

CREATE INDEX IF NOT EXISTS attachments_entity_idx ON attachments (entity_type, entity_id);

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_kind;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_kind
  CHECK (kind IN ('sale', 'purchase', 'adjustment', 'import', 'manual'));

-- ============================================================
-- Salón de belleza: servicios, ficha de cliente, visitas y turnos
-- (todo idempotente: se puede correr muchas veces sin romper nada)
-- ============================================================

-- Servicios: se guardan en la misma tabla que los productos,
-- marcados con is_service = true. No llevan stock.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS duration_min INT;

-- Ficha de cliente ampliada
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS hair_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS skin_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS color_formula TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sensitivities TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferences TEXT;

-- Historial de visitas de cada cliente (qué se hizo, quién lo hizo, fórmula usada)
CREATE TABLE IF NOT EXISTS customer_visits (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  visited_at DATE NOT NULL DEFAULT CURRENT_DATE,
  service TEXT NOT NULL,
  staff_name TEXT,
  formula TEXT,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_visits_customer_idx ON customer_visits (customer_id, visited_at DESC);

-- Agenda de turnos. Día y hora se guardan por separado (hora local del salón)
-- para evitar problemas de zona horaria.
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  service_id INT REFERENCES products(id) ON DELETE SET NULL,
  service_name TEXT,
  staff_name TEXT,
  day DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled',
  price NUMERIC(14,2),
  notes TEXT,
  sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_status CHECK (status IN ('scheduled', 'done', 'cancelled', 'no_show')),
  CONSTRAINT appointments_duration CHECK (duration_min > 0)
);

CREATE INDEX IF NOT EXISTS appointments_day_idx ON appointments (day, start_time);
CREATE INDEX IF NOT EXISTS appointments_customer_idx ON appointments (customer_id, day DESC);

-- Nombre por defecto pensado para el salón
ALTER TABLE store_settings ALTER COLUMN name SET DEFAULT 'Mi salón'
;

-- ============================================================
-- Empleados, comisiones y rubros
-- ============================================================

-- Cada usuario es un empleado. role: 'admin' ve y maneja todo; 'staff' ve su agenda,
-- clientes, cobra y consulta sus comisiones.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role;
ALTER TABLE users ADD CONSTRAINT users_role CHECK (role IN ('admin', 'staff'));

-- Quién atiende cada turno y quién hizo cada venta
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS staff_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS staff_id INT REFERENCES users(id) ON DELETE SET NULL;
-- El % se guarda en cada venta: si después cambia el % del empleado, lo ya cobrado no se modifica
ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE customer_visits ADD COLUMN IF NOT EXISTS staff_id INT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_staff_idx ON appointments (staff_id, day);
CREATE INDEX IF NOT EXISTS sales_staff_idx ON sales (staff_id, issued_at);

-- Rubros que trabaja el negocio (peluquería, barbería, estética, uñas, depilación, masajes)
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS business_types TEXT[] NOT NULL DEFAULT ARRAY['peluqueria']::TEXT[];

-- Campos de la ficha según rubro
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nail_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS waxing_notes TEXT
;

-- ============================================================
-- Pedido a proveedores: stock crítico individual (min_stock),
-- cantidad sugerida para pedir y proveedor habitual de cada producto
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_qty NUMERIC(14,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL;

-- ============================================================
-- Rubros: se quita kinesiología (para no guardar datos de salud) y se suma barbería
-- ============================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS beard_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS massage_notes TEXT;
-- El campo de motivo de consulta / lesiones se elimina junto con lo que tuviera guardado
ALTER TABLE customers DROP COLUMN IF EXISTS health_notes;
UPDATE store_settings SET business_types = array_remove(business_types, 'kinesiologia');
UPDATE store_settings SET business_types = ARRAY['peluqueria']::TEXT[] WHERE cardinality(business_types) = 0
;
-- Los servicios sugeridos de kinesiología que se hayan cargado quedan inactivos (no se borran por si tienen ventas)
UPDATE products SET active = false WHERE sku LIKE 'KIN-%' AND is_service = true AND active = true
;

-- ============================================================
-- Plan contratado: define qué secciones se ven en la app.
--   'turnos'   = Opción A: agenda con recordatorio por WhatsApp
--   'stock'    = Opción C: ficha de clienta y control de stock
--   'completo' = A + C (todo)
-- Cambiar de plan solo muestra u oculta secciones: nunca borra datos.
-- ============================================================
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'completo';
ALTER TABLE store_settings DROP CONSTRAINT IF EXISTS store_settings_plan;
ALTER TABLE store_settings ADD CONSTRAINT store_settings_plan CHECK (plan IN ('turnos', 'stock', 'completo'))
