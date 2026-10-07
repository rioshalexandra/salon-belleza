import { NavLink, Outlet } from 'react-router-dom';
import {
  Boxes,
  CalendarDays,
  FileSpreadsheet,
  History,
  Home,
  LogOut,
  Menu,
  PackagePlus,
  Percent,
  Receipt,
  Scissors,
  Settings,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useStore } from '../store';
import PoweredBy from './PoweredBy';

// Menú completo. adminOnly: solo lo ve administración.
// main: aparece arriba; el resto queda agrupado en "Administración".
export const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true, main: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, main: true },
  { to: '/cobrar', label: 'Cobrar', icon: Wallet, main: true },
  { to: '/clientes', label: 'Clientes', icon: Users, main: true },
  { to: '/ventas', label: 'Ventas', icon: Receipt, main: true },
  { to: '/servicios', label: 'Servicios', icon: Scissors, adminOnly: true },
  { to: '/productos', label: 'Productos', icon: Boxes, adminOnly: true },
  { to: '/empleados', label: 'Empleados', icon: UserCog, adminOnly: true },
  { to: '/proveedores', label: 'Proveedores', icon: Truck, adminOnly: true },
  { to: '/compras', label: 'Compras', icon: PackagePlus, adminOnly: true },
  { to: '/movimientos', label: 'Movimientos de stock', icon: History, adminOnly: true },
  { to: '/pagos', label: 'Pagos', icon: Wallet, adminOnly: true },
  { to: '/precios', label: 'Precios', icon: Percent, adminOnly: true },
  { to: '/importar', label: 'CSV / Excel', icon: FileSpreadsheet, adminOnly: true },
  { to: '/configuracion', label: 'Configuración', icon: Settings, adminOnly: true },
];

// Barra inferior del celular: lo de todos los días al alcance del pulgar
const BOTTOM = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/cobrar', label: 'Cobrar', icon: Wallet, accent: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((item) => isAdmin || !item.adminOnly);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="flex min-w-0 items-center gap-2">
          <div className="brand-mark grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <div className="brand-name truncate text-lg sm:text-xl">{settings?.name || 'Mi salón'}</div>
            <div className="truncate text-xs text-[#6b6266]">
              {user?.name || user?.username}
              {isAdmin ? ' · Administración' : ''}
            </div>
          </div>
        </div>
        <button className="icon-btn ml-auto" type="button" onClick={logout} title="Salir">
          <LogOut size={18} />
        </button>
      </header>

      {/* Menú lateral completo (celular): se abre con "Más" */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside className="drawer" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="brand-name text-lg">Menú</div>
              <button className="icon-btn" type="button" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <Nav items={items} onPick={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="side-nav hidden lg:block">
          <Nav items={items} />
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (solo celular) */}
      <nav className="bottom-nav lg:hidden" aria-label="Accesos rápidos">
        {BOTTOM.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-link ${item.accent ? 'accent' : ''} ${isActive ? 'active' : ''}`}
          >
            <item.icon size={item.accent ? 24 : 20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottom-link" onClick={() => setOpen(true)}>
          <Menu size={20} />
          <span>Más</span>
        </button>
      </nav>
      <div className="hidden lg:block">
        <PoweredBy />
      </div>
    </div>
  );
}

function Nav({ items, onPick }) {
  const main = items.filter((item) => item.main);
  const rest = items.filter((item) => !item.main);
  return (
    <nav>
      {main.map((item) => (
        <NavItem key={item.to} item={item} onPick={onPick} />
      ))}
      {rest.length > 0 && <div className="nav-group">Administración</div>}
      {rest.map((item) => (
        <NavItem key={item.to} item={item} onPick={onPick} />
      ))}
    </nav>
  );
}

function NavItem({ item, onPick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
      onClick={onPick}
    >
      <item.icon size={18} />
      {item.label}
    </NavLink>
  );
}
