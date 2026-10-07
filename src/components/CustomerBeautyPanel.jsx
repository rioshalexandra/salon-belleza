import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { APPOINTMENT_STATUSES, birthdayLabel, today, ymd } from '../format';

// Panel de la ficha de un cliente: datos de belleza, historial de visitas y turnos.
export default function CustomerBeautyPanel({ party, onChanged }) {
  const facts = [
    ['Cumpleaños', party.birthday ? birthdayLabel(party.birthday) : null],
    ['Instagram', party.instagram],
    ['Tipo de cabello', party.hair_type],
    ['Tipo de piel', party.skin_type],
    ['Fórmula de color', party.color_formula],
    ['Preferencias', party.preferences],
  ];

  return (
    <div className="mb-6 grid gap-6 xl:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-medium">Ficha de belleza</h2>
        {party.sensitivities && (
          <div className="mb-3 rounded-xl border border-[#f6aea9] bg-[#fce8e6] px-4 py-3 text-sm text-[#a50e0e]">
            <strong>Alergias / sensibilidades:</strong> {party.sensitivities}
          </div>
        )}
        <dl className="grid gap-x-4 gap-y-3 rounded-xl border border-[#e7dfe1] p-4 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="kpi-label">{label}</dt>
              <dd className="m-0 mt-0.5 text-sm">{value || <span className="text-[#a39a9d]">—</span>}</dd>
            </div>
          ))}
        </dl>
        <AppointmentsList party={party} />
      </section>
      <VisitsSection party={party} onChanged={onChanged} />
    </div>
  );
}

// Próximos turnos y los últimos pasados del cliente
function AppointmentsList({ party }) {
  const rows = party.appointments || [];
  const now = today();
  const upcoming = rows.filter((row) => ymd(row.day) >= now && row.status === 'scheduled').reverse();

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Turnos</h2>
        <Link className="pill-btn inline-flex items-center gap-2 no-underline" to={`/agenda?nuevo=1&cliente=${party.id}`}>
          <CalendarPlus size={16} /> Dar turno
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#e7dfe1]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Día</th>
              <th>Hora</th>
              <th>Servicio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {[...upcoming, ...rows.filter((row) => !upcoming.includes(row)).slice(0, 8)].map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="text-[#8e3b5f]" to={`/agenda?dia=${ymd(row.day)}`}>
                    {ymd(row.day)}
                  </Link>
                </td>
                <td>{String(row.start_time).slice(0, 5)}</td>
                <td>{row.service_name || '—'}</td>
                <td>
                  <span className={`badge appt-${row.status}`}>{APPOINTMENT_STATUSES[row.status]}</span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-8 text-center text-[#7a6f73]" colSpan={4}>
                  Sin turnos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Historial de visitas con formulario para anotar una nueva
function VisitsSection({ party, onChanged }) {
  const empty = { visitedAt: today(), service: '', staffName: '', formula: '', notes: '' };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const visits = party.visits || [];

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Historial de visitas</h2>
        {!open && (
          <button className="pill-btn" onClick={() => setOpen(true)}>
            Anotar visita
          </button>
        )}
      </div>
      {open && (
        <form
          className="mb-4 grid gap-3 rounded-xl border border-[#e7dfe1] p-4 sm:grid-cols-2"
          onSubmit={async (ev) => {
            ev.preventDefault();
            setError('');
            try {
              await api.addVisit(party.id, form);
              setForm(empty);
              setOpen(false);
              await onChanged();
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={form.visitedAt} onChange={(e) => set('visitedAt', e.target.value)} />
          </label>
          <label className="field">
            <span>Profesional</span>
            <input value={form.staffName} onChange={(e) => set('staffName', e.target.value)} />
          </label>
          <label className="field sm:col-span-2">
            <span>Qué se hizo</span>
            <input
              value={form.service}
              placeholder="Ej: corte en capas + baño de crema"
              onChange={(e) => set('service', e.target.value)}
              required
            />
          </label>
          <label className="field sm:col-span-2">
            <span>Fórmula / productos usados</span>
            <input value={form.formula} onChange={(e) => set('formula', e.target.value)} />
          </label>
          <label className="field sm:col-span-2">
            <span>Notas</span>
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="pill-btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="pill-btn primary">
              Guardar visita
            </button>
          </div>
        </form>
      )}
      {/* Línea de tiempo de visitas */}
      <ol className="visit-timeline">
        {visits.map((visit) => (
          <li key={visit.id}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[#7a6f73]">
                  {ymd(visit.visited_at)}
                  {visit.staff_name && ` · ${visit.staff_name}`}
                </div>
                <div className="font-medium">{visit.service}</div>
                {visit.formula && <div className="text-sm text-[#655a5e]">Fórmula: {visit.formula}</div>}
                {visit.notes && <div className="text-sm text-[#655a5e]">{visit.notes}</div>}
              </div>
              <button
                className="icon-btn h-8 w-8 text-[#a39a9d]"
                title="Borrar visita"
                onClick={async () => {
                  if (!confirm('¿Borrar esta visita del historial?')) return;
                  await api.deleteVisit(party.id, visit.id);
                  await onChanged();
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
        {!visits.length && <li className="text-sm text-[#7a6f73]">Todavía no hay visitas anotadas.</li>}
      </ol>
    </section>
  );
}
