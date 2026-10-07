import { useState } from 'react';
import { CUSTOMER_FIELDS, fieldsForRubros } from '../rubros';
import { useStore } from '../store';

// Formulario de cliente / proveedor.
// Con kind="customers" se muestra además la ficha, con los campos de los rubros que trabaja el negocio.
export default function PartyForm({ title, form, kind = 'customers', onClose, onSave }) {
  const { settings } = useStore();
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false); // datos poco usados (DNI, dirección) plegados para simplificar
  const isCustomer = kind === 'customers';
  const rubroFields = fieldsForRubros(settings?.business_types);

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className={`modal-card ${isCustomer ? 'wide' : ''}`}
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave(state);
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="modal-head">{title}</div>
        <div className={`grid gap-3 px-5 py-4 ${isCustomer ? 'sm:grid-cols-2' : ''}`}>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>
          )}

          {/* Datos de contacto */}
          <label className="field sm:col-span-2">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="field">
            <span>Teléfono / WhatsApp</span>
            <input type="tel" inputMode="tel" value={state.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          {isCustomer ? (
            <label className="field">
              <span>Cumpleaños</span>
              <input type="date" value={state.birthday} onChange={(e) => set('birthday', e.target.value)} />
            </label>
          ) : (
            <label className="field">
              <span>CUIT / DNI</span>
              <input value={state.taxId} onChange={(e) => set('taxId', e.target.value)} />
            </label>
          )}
          {!isCustomer && (
            <>
              <label className="field">
                <span>Email</span>
                <input type="email" value={state.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label className="field">
                <span>Dirección</span>
                <input value={state.address} onChange={(e) => set('address', e.target.value)} />
              </label>
            </>
          )}

          {/* Ficha: campos según los rubros del negocio */}
          {isCustomer && (
            <>
              <div className="mt-2 text-sm font-semibold sm:col-span-2">Ficha</div>
              {rubroFields.map((field) => (
                <label key={field.key} className={`field ${field.wide ? 'sm:col-span-2' : ''}`}>
                  <span>{field.label}</span>
                  {field.textarea ? (
                    <textarea
                      rows={2}
                      value={state[field.key]}
                      placeholder={field.placeholder}
                      onChange={(e) => set(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      value={state[field.key]}
                      placeholder={field.placeholder}
                      onChange={(e) => set(field.key, e.target.value)}
                    />
                  )}
                </label>
              ))}
              <label className="field">
                <span>Alergias o sensibilidades</span>
                <textarea
                  rows={2}
                  value={state.sensitivities}
                  placeholder="Productos que no tolera, reacciones previas…"
                  onChange={(e) => set('sensitivities', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Preferencias</span>
                <textarea
                  rows={2}
                  value={state.preferences}
                  placeholder="Horarios, profesional favorito, estilo…"
                  onChange={(e) => set('preferences', e.target.value)}
                />
              </label>
              {!more ? (
                <button type="button" className="link-btn self-start text-sm sm:col-span-2" onClick={() => setMore(true)}>
                  + Más datos (Instagram, email, DNI, dirección)
                </button>
              ) : (
                <>
                  <label className="field">
                    <span>Instagram</span>
                    <input value={state.instagram} placeholder="@usuario" onChange={(e) => set('instagram', e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input type="email" value={state.email} onChange={(e) => set('email', e.target.value)} />
                  </label>
                  <label className="field">
                    <span>DNI / CUIT (para facturar)</span>
                    <input value={state.taxId} onChange={(e) => set('taxId', e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Dirección</span>
                    <input value={state.address} onChange={(e) => set('address', e.target.value)} />
                  </label>
                </>
              )}
            </>
          )}

          <label className={`field ${isCustomer ? 'sm:col-span-2' : ''}`}>
            <span>Notas</span>
            <textarea rows={2} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
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

export function emptyParty() {
  const base = {
    id: null,
    name: '',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    birthday: '',
    instagram: '',
    sensitivities: '',
    preferences: '',
  };
  // Todos los campos de rubro arrancan vacíos (aunque no se muestren, para no perder datos)
  for (const field of CUSTOMER_FIELDS) base[field.key] = '';
  return base;
}

export function toPartyForm(row) {
  const form = {
    id: row.id,
    name: row.name || '',
    taxId: row.tax_id || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    notes: row.notes || '',
    birthday: row.birthday ? String(row.birthday).slice(0, 10) : '',
    instagram: row.instagram || '',
    sensitivities: row.sensitivities || '',
    preferences: row.preferences || '',
  };
  for (const field of CUSTOMER_FIELDS) form[field.key] = row[field.column] || '';
  return form;
}
