import { useState } from 'react';
import { APPOINTMENT_STATUSES } from '../format';

// Formulario para dar o editar un turno.
// customers y services vienen cargados desde la página de agenda.
export default function AppointmentForm({ form, customers, services, staffNames, onClose, onSave, onDelete }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Si no hay cliente elegido pero sí nombre escrito, es un cliente "de paso" sin ficha
  const [walkIn, setWalkIn] = useState(!form.customerId && Boolean(form.customerName));

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  // Al elegir un servicio completamos duración y precio sugeridos
  function pickService(id) {
    const svc = services.find((item) => String(item.id) === String(id));
    setState((prev) => ({
      ...prev,
      serviceId: id,
      durationMin: svc?.duration_min ? String(svc.duration_min) : prev.durationMin,
      price: svc ? String(Number(svc.sale_price)) : prev.price,
    }));
  }

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
            await onSave({
              ...state,
              customerId: walkIn ? null : state.customerId || null,
              customerName: walkIn ? state.customerName : null,
            });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="border-b border-[#e7dfe1] px-5 py-4 text-lg">{state.id ? 'Editar turno' : 'Nuevo turno'}</div>
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          {error && <div className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="field col-span-2">
            <span>Cliente</span>
            {walkIn ? (
              <input
                value={state.customerName || ''}
                placeholder="Nombre del cliente"
                onChange={(e) => set('customerName', e.target.value)}
                required
              />
            ) : (
              <select value={state.customerId} onChange={(e) => set('customerId', e.target.value)} required>
                <option value="">Elegí un cliente…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="self-start text-xs text-[#8e3b5f]"
              onClick={() => setWalkIn((prev) => !prev)}
            >
              {walkIn ? 'Elegir de mis clientes' : '¿No está en la lista? Escribir solo el nombre'}
            </button>
          </div>

          <label className="field col-span-2">
            <span>Servicio</span>
            <select value={state.serviceId} onChange={(e) => pickService(e.target.value)}>
              <option value="">Sin especificar</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Día</span>
            <input type="date" value={state.day} onChange={(e) => set('day', e.target.value)} required />
          </label>
          <label className="field">
            <span>Hora</span>
            <input type="time" step="300" value={state.startTime} onChange={(e) => set('startTime', e.target.value)} required />
          </label>
          <label className="field">
            <span>Duración (min)</span>
            <input
              type="number"
              min="5"
              step="5"
              value={state.durationMin}
              onChange={(e) => set('durationMin', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Precio</span>
            <input type="number" min="0" step="0.01" value={state.price} onChange={(e) => set('price', e.target.value)} />
          </label>
          <label className="field">
            <span>Profesional</span>
            <input list="staff-names" value={state.staffName} onChange={(e) => set('staffName', e.target.value)} />
            <datalist id="staff-names">
              {staffNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          {state.id ? (
            <label className="field">
              <span>Estado</span>
              <select value={state.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(APPOINTMENT_STATUSES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
          <label className="field col-span-2">
            <span>Notas</span>
            <textarea rows={2} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        <div className="flex gap-2 border-t border-[#e7dfe1] px-5 py-3">
          {state.id && onDelete && (
            <button type="button" className="pill-btn danger mr-auto" onClick={onDelete}>
              Borrar
            </button>
          )}
          <button type="button" className="pill-btn ml-auto" onClick={onClose}>
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

export function emptyAppointment(day, customerId = '') {
  return {
    id: null,
    customerId: customerId ? String(customerId) : '',
    customerName: '',
    serviceId: '',
    staffName: '',
    day,
    startTime: '10:00',
    durationMin: '60',
    price: '',
    status: 'scheduled',
    notes: '',
  };
}

export function toAppointmentForm(row) {
  return {
    id: row.id,
    customerId: row.customer_id ? String(row.customer_id) : '',
    customerName: row.customer_id ? '' : row.customer_name || '',
    serviceId: row.service_id ? String(row.service_id) : '',
    staffName: row.staff_name || '',
    day: String(row.day).slice(0, 10),
    startTime: String(row.start_time).slice(0, 5),
    durationMin: String(row.duration_min || 60),
    price: row.price != null ? String(Number(row.price)) : '',
    status: row.status,
    notes: row.notes || '',
  };
}
