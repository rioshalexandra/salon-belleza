import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api } from '../api';
import AppointmentForm, { emptyAppointment, toAppointmentForm } from '../components/AppointmentForm';
import { APPOINTMENT_STATUSES, addDays, longDate, money, today, ymd } from '../format';
import { useStore } from '../store';

// Agenda de turnos: tira de 7 días arriba y el día elegido como línea de tiempo.
export default function AgendaPage() {
  const { currency } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('dia') || '') ? params.get('dia') : today();

  // La semana visible arranca el lunes de la semana del día elegido
  const weekStart = useMemo(() => {
    const [y, m, d] = day.split('-').map(Number);
    const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // lunes = 0
    return addDays(day, -weekday);
  }, [day]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [staffNames, setStaffNames] = useState([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const res = await api.appointments(weekDays[0], weekDays[6]);
    setRows(res.data);
  }

  // Listas para el formulario (se cargan una sola vez)
  useEffect(() => {
    Promise.all([api.customers(), api.products('?type=service'), api.staffNames()])
      .then(([c, s, st]) => {
        setCustomers(c.data);
        setServices(s.data);
        setStaffNames(st.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [weekStart]);

  // Abrir el formulario directo si venimos de "Dar turno" en la ficha de un cliente
  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditing(emptyAppointment(day, params.get('cliente') || ''));
      const next = new URLSearchParams(params);
      next.delete('nuevo');
      next.delete('cliente');
      setParams(next, { replace: true });
    }
  }, []);

  function goTo(nextDay) {
    const next = new URLSearchParams(params);
    next.set('dia', nextDay);
    setParams(next, { replace: true });
  }

  const dayRows = rows
    .filter((row) => ymd(row.day) === day)
    .filter((row) => !staffFilter || row.staff_name === staffFilter);
  const staffInWeek = [...new Set(rows.map((row) => row.staff_name).filter(Boolean))].sort();

  async function changeStatus(row, status) {
    try {
      await api.setAppointmentStatus(row.id, status);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function checkout(row) {
    try {
      const res = await api.checkoutAppointment(row.id);
      navigate(`/ventas/${res.data.saleId}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl">Agenda</h1>
        {staffInWeek.length > 0 && (
          <select
            className="h-9 rounded-full border border-[#e7dfe1] px-3 text-sm"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="">Todas las profesionales</option>
            {staffInWeek.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <button className="pill-btn primary inline-flex items-center gap-1" onClick={() => setEditing(emptyAppointment(day))}>
          <Plus size={16} /> Nuevo turno
        </button>
      </div>

      {/* Navegación por semana */}
      <div className="mb-2 flex items-center gap-1">
        <button className="icon-btn" onClick={() => goTo(addDays(day, -7))} title="Semana anterior">
          <ChevronLeft size={18} />
        </button>
        <button className="pill-btn" onClick={() => goTo(today())}>
          Hoy
        </button>
        <button className="icon-btn" onClick={() => goTo(addDays(day, 7))} title="Semana siguiente">
          <ChevronRight size={18} />
        </button>
        <input
          type="date"
          className="ml-2 h-9 rounded-full border border-[#e7dfe1] px-3 text-sm"
          value={day}
          onChange={(e) => e.target.value && goTo(e.target.value)}
        />
      </div>
      <div className="week-strip mb-5">
        {weekDays.map((d) => {
          const count = rows.filter((row) => ymd(row.day) === d && row.status !== 'cancelled').length;
          const [, , dd] = d.split('-');
          const label = longDate(d).split(' ')[0].slice(0, 3);
          return (
            <button
              key={d}
              className={`week-day ${d === day ? 'active' : ''} ${d === today() ? 'is-today' : ''}`}
              onClick={() => goTo(d)}
            >
              <span className="week-day-name">{label}</span>
              <span className="week-day-num">{Number(dd)}</span>
              <span className="week-day-count">{count ? `${count} turno${count > 1 ? 's' : ''}` : '—'}</span>
            </button>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-medium first-letter:uppercase">{longDate(day)}</h2>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Línea de tiempo del día */}
      <ol className="agenda-thread">
        {dayRows.map((row) => (
          <li key={row.id} className={`agenda-item status-${row.status}`}>
            <div className="agenda-time">
              <div className="font-semibold">{row.start_hhmm}</div>
              <div className="text-xs text-[#7a6f73]">{row.end_hhmm}</div>
            </div>
            <div className="agenda-card">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {row.customer_id ? (
                      <Link className="text-[#8e3b5f]" to={`/clientes/${row.customer_id}`}>
                        {row.display_customer}
                      </Link>
                    ) : (
                      row.display_customer
                    )}
                  </div>
                  <div className="text-sm text-[#655a5e]">
                    {row.display_service || 'Servicio sin especificar'}
                    {row.staff_name && ` · con ${row.staff_name}`}
                    {row.price != null && ` · ${money(row.price, currency)}`}
                  </div>
                  {row.customer_phone && <div className="text-xs text-[#7a6f73]">{row.customer_phone}</div>}
                  {row.notes && <div className="mt-1 text-sm text-[#655a5e]">{row.notes}</div>}
                </div>
                <span className={`badge appt-${row.status}`}>{APPOINTMENT_STATUSES[row.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.sale_id ? (
                  <Link className="pill-btn inline-flex items-center no-underline" to={`/ventas/${row.sale_id}`}>
                    Ver venta {row.sale_number}
                  </Link>
                ) : (
                  row.status !== 'cancelled' && (
                    <button className="pill-btn primary" onClick={() => checkout(row)}>
                      Cobrar
                    </button>
                  )
                )}
                {row.status === 'scheduled' && (
                  <>
                    <button className="pill-btn" onClick={() => changeStatus(row, 'done')}>
                      Realizado
                    </button>
                    <button className="pill-btn" onClick={() => changeStatus(row, 'no_show')}>
                      No vino
                    </button>
                  </>
                )}
                {row.status !== 'scheduled' && !row.sale_id && (
                  <button className="pill-btn" onClick={() => changeStatus(row, 'scheduled')}>
                    Volver a pendiente
                  </button>
                )}
                <button className="pill-btn" onClick={() => setEditing(toAppointmentForm(row))}>
                  Editar
                </button>
              </div>
            </div>
          </li>
        ))}
        {!dayRows.length && (
          <li className="agenda-empty">
            No hay turnos para este día.{' '}
            <button className="text-[#8e3b5f]" onClick={() => setEditing(emptyAppointment(day))}>
              Dar un turno
            </button>
          </li>
        )}
      </ol>

      {editing && (
        <AppointmentForm
          form={editing}
          customers={customers}
          services={services}
          staffNames={staffNames}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            const res = await api.saveAppointment(editing.id, body);
            setEditing(null);
            // Si el turno se dio para otro día, la agenda salta a ese día
            await load();
            const savedDay = ymd(res.data.day);
            if (savedDay !== day) goTo(savedDay);
            if (body.staffName && !staffNames.includes(body.staffName)) {
              setStaffNames((prev) => [...prev, body.staffName].sort());
            }
          }}
          onDelete={async () => {
            if (!confirm('¿Borrar este turno?')) return;
            await api.deleteAppointment(editing.id);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
