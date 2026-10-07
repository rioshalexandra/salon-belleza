import { useState } from 'react';

// Formulario de cliente / proveedor.
// Con kind="customers" se muestra además la ficha del salón (cumpleaños, cabello, piel, fórmula de color…).
export default function PartyForm({ title, form, kind = 'customers', onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isCustomer = kind === 'customers';

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
        <div className="border-b border-[#e7dfe1] px-5 py-4 text-lg">{title}</div>
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
            <input value={state.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          {isCustomer ? (
            <label className="field">
              <span>Instagram</span>
              <input
                value={state.instagram}
                placeholder="@usuario"
                onChange={(e) => set('instagram', e.target.value)}
              />
            </label>
          ) : (
            <label className="field">
              <span>CUIT / DNI</span>
              <input value={state.taxId} onChange={(e) => set('taxId', e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input value={state.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          {isCustomer ? (
            <label className="field">
              <span>Cumpleaños</span>
              <input type="date" value={state.birthday} onChange={(e) => set('birthday', e.target.value)} />
            </label>
          ) : (
            <label className="field">
              <span>Dirección</span>
              <input value={state.address} onChange={(e) => set('address', e.target.value)} />
            </label>
          )}

          {/* Ficha del salón: solo para clientes */}
          {isCustomer && (
            <>
              <div className="mt-2 text-sm font-medium text-[#3a3034] sm:col-span-2">Ficha de belleza</div>
              <label className="field">
                <span>Tipo de cabello</span>
                <input
                  value={state.hairType}
                  placeholder="Ej: rizado, fino, poroso, con canas"
                  onChange={(e) => set('hairType', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Tipo de piel</span>
                <input
                  value={state.skinType}
                  placeholder="Ej: mixta, sensible, seca"
                  onChange={(e) => set('skinType', e.target.value)}
                />
              </label>
              <label className="field sm:col-span-2">
                <span>Fórmula de color habitual</span>
                <input
                  value={state.colorFormula}
                  placeholder="Ej: 7.1 + 7.0 (1:1) con oxidante 20 vol, 35 min"
                  onChange={(e) => set('colorFormula', e.target.value)}
                />
              </label>
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
                  placeholder="Horarios, profesional favorita, estilo…"
                  onChange={(e) => set('preferences', e.target.value)}
                />
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

          <label className={`field ${isCustomer ? 'sm:col-span-2' : ''}`}>
            <span>Notas</span>
            <textarea rows={2} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e7dfe1] px-5 py-3">
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
  return {
    id: null,
    name: '',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    // ficha del salón
    birthday: '',
    instagram: '',
    hairType: '',
    skinType: '',
    colorFormula: '',
    sensitivities: '',
    preferences: '',
  };
}

export function toPartyForm(row) {
  return {
    id: row.id,
    name: row.name || '',
    taxId: row.tax_id || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    notes: row.notes || '',
    birthday: row.birthday ? String(row.birthday).slice(0, 10) : '',
    instagram: row.instagram || '',
    hairType: row.hair_type || '',
    skinType: row.skin_type || '',
    colorFormula: row.color_formula || '',
    sensitivities: row.sensitivities || '',
    preferences: row.preferences || '',
  };
}
