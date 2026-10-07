import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../api';

// Pantalla de empleados (solo administración): alta, % de comisión, color, contraseña y baja.
export default function StaffPage() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const res = await api.staff(true);
    setRows(res.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Empleados</h1>
        <button className="pill-btn primary inline-flex items-center gap-2" onClick={() => setEditing(emptyStaff())}>
          <UserPlus size={16} /> Nuevo empleado
        </button>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-[#5a5155]">
        Cada empleado entra con su propio usuario y contraseña. Ve su agenda, los clientes, puede cobrar y consulta sus
        comisiones. La comisión se calcula sobre lo que factura cada uno (sin impuestos).
      </p>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <button
            key={row.id}
            className={`card-tile text-left ${row.active ? '' : 'opacity-50'}`}
            onClick={() => setEditing(toStaffForm(row))}
          >
            <div className="flex items-center gap-3">
              <span className="avatar" style={{ background: row.color || '#b08a3e' }}>
                {initials(row.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{row.name}</div>
                <div className="text-xs text-[#6b6266]">
                  @{row.username} · {row.role === 'admin' ? 'Administración' : 'Empleado'}
                  {!row.active && ' · Dado de baja'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{Number(row.commission_pct)}%</div>
                <div className="text-xs text-[#6b6266]">comisión</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {editing && (
        <StaffForm
          form={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.saveStaff(editing.id, body);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// Formulario de alta / edición de un empleado
function StaffForm({ form, onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setState((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave({ ...state, commissionPct: Number(state.commissionPct || 0) });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="modal-head">{state.id ? `Editar ${form.name}` : 'Nuevo empleado'}</div>
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          {error && <div className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field col-span-2">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="field">
            <span>Usuario para entrar</span>
            <input
              value={state.username}
              onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
              disabled={Boolean(state.id)}
              autoCapitalize="none"
              required
            />
          </label>
          <label className="field">
            <span>{state.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</span>
            <input
              type="text"
              value={state.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={state.id ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
              required={!state.id}
            />
          </label>
          <label className="field">
            <span>Comisión (%)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.5"
              value={state.commissionPct}
              onChange={(e) => set('commissionPct', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input type="tel" value={state.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label className="field">
            <span>Permisos</span>
            <select value={state.role} onChange={(e) => set('role', e.target.value)}>
              <option value="staff">Empleado</option>
              <option value="admin">Administración (ve todo)</option>
            </select>
          </label>
          <label className="field">
            <span>Color en la agenda</span>
            <input type="color" value={state.color} onChange={(e) => set('color', e.target.value)} className="h-[42px]" />
          </label>
          {state.id && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!state.active} onChange={(e) => set('active', !e.target.checked)} />
              Dar de baja (ya no puede entrar; sus turnos y ventas se conservan)
            </label>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function emptyStaff() {
  return { id: null, name: '', username: '', password: '', commissionPct: '40', phone: '', role: 'staff', color: '#c2667f', active: true };
}

function toStaffForm(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    password: '',
    commissionPct: String(Number(row.commission_pct)),
    phone: row.phone || '',
    role: row.role,
    color: row.color || '#b08a3e',
    active: row.active,
  };
}
