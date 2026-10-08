import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle, Plus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import AppointmentForm, { emptyAppointment, toAppointmentForm } from '../components/AppointmentForm';
import CheckoutModal from '../components/CheckoutModal';
import {
  APPOINTMENT_STATUSES,
  addDays,
  firstName,
  longDate,
  money,
  relativeDay,
  today,
  whatsappLink,
  ymd,
} from '../format';
import { useStore } from '../store';

// Agenda de turnos: tira de 7 días arriba y el día elegido como línea de tiempo.
export default function AgendaPage() {
  const { currency, settings } = useStore();
  const { user, isAdmin } = useAuth();
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
  const [staff, setStaff] = useState([]);
  // Un empleado arranca viendo solo sus turnos; administración ve a todos
  const [staffFilter, setStaffFilter] = useState(isAdmin ? '' : String(user?.id || ''));
  const [editing, setEditing] = useState(null);
  const [charging, setCharging] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const res = await api.appointments(weekDays[0], weekDays[6]);
    setRows(res.data);
  }

  // Listas para los formularios (se cargan una sola vez)
  useEffect(() => {
    Promise.all([api.customers(), api.products('?type=service'), api.staff()])
      .then(([c, s, st]) => {
        setCustomers(c.data);
        setServices(s.data);
        setStaff(st.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [weekStart]);

  // Abrir el formulario directo si venimos de "Dar turno" (ficha del cliente o botón +)
  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditing(emptyAppointment(day, params.get('cliente') || '', isAdmin ? '' : user?.id));
      const next = new URLSearchParams(params);
      next.delete('nuevo');
      next.delete('cliente');
      setParams(next, { replace: true });
    }
  }, [params]);

  function goTo(nextDay) {
    const next = new URLSearchParams(params);
    next.set('dia', nextDay);
    setParams(next, { replace: true });
  }

  const visible = rows.filter((row) => !staffFilter || String(row.staff_id) === staffFilter);
  const dayRows = visible.filter((row) => ymd(row.day) === day);

  async function changeStatus(row, status) {
    try {
      await api.setAppointmentStatus(row.id, status);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Mensaje de recordatorio: saluda por el primer nombre y dice "hoy" / "mañana" cuando corresponde.
  // Ej.: "Hola Sofía! Te recordamos tu turno en Salón Rosa mañana a las 15:00 (Corte). ¡Te esperamos!"
  function reminderText(row) {
    const nombre = firstName(row.display_customer);
    const saludo = nombre ? `Hola ${nombre}!` : 'Hola!';
    const servicio = row.display_service ? ` (${row.display_service})` : '';
    return `${saludo} Te recordamos tu turno en ${settings?.name || 'el salón'} ${relativeDay(row.day)} a las ${
      row.start_hhmm
    }${servicio}. ¡Te esperamos!`;
  }

  // Si la clienta no tiene teléfono, el botón "Recordar" queda en gris y al tocarlo
  // muestra, dentro de la tarjeta de ese turno, el aviso de que falta cargarlo.
  const [sinTelefono, setSinTelefono] = useState(null); // id del turno que muestra el aviso

  return (
    <div className="page">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl">Agenda</h1>
        <select className="pill-select" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="">Todos</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="pill-btn primary hidden items-center gap-1 lg:inline-flex"
          onClick={() => setEditing(emptyAppointment(day, '', isAdmin ? '' : user?.id))}
        >
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
          className="pill-select ml-auto"
          value={day}
          onChange={(e) => e.target.value && goTo(e.target.value)}
        />
      </div>
      <div className="week-strip mb-5">
        {weekDays.map((d) => {
          const count = visible.filter((row) => ymd(row.day) === d && row.status !== 'cancelled').length;
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
      {notice && <div className="notice mb-3">{notice}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Línea de tiempo del día */}
      <ol className="agenda-thread">
        {dayRows.map((row) => {
          const wa = whatsappLink(row.customer_phone, reminderText(row));
          return (
            <li key={row.id} className={`agenda-item status-${row.status}`}>
              <div className="agenda-time">
                <div className="font-semibold">{row.start_hhmm}</div>
                <div className="text-xs text-[#6b6266]">{row.end_hhmm}</div>
              </div>
              <div className="agenda-card" style={{ borderLeftColor: row.staff_color || undefined }}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {row.customer_id ? (
                        <Link className="text-link" to={`/clientes/${row.customer_id}`}>
                          {row.display_customer}
                        </Link>
                      ) : (
                        row.display_customer
                      )}
                    </div>
                    <div className="text-sm text-[#5a5155]">
                      {row.display_service || 'Servicio sin especificar'}
                      {row.price != null && ` · ${money(row.price, currency)}`}
                    </div>
                    {row.display_staff && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#5a5155]">
                        <span className="dot" style={{ background: row.staff_color || '#b08a3e' }} />
                        {row.display_staff}
                      </div>
                    )}
                    {row.notes && <div className="mt-1 text-sm text-[#5a5155]">{row.notes}</div>}
                  </div>
                  <span className={`badge appt-${row.status}`}>{APPOINTMENT_STATUSES[row.status]}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.sale_id ? (
                    <Link className="pill-btn inline-flex items-center no-underline" to={`/ventas/${row.sale_id}`}>
                      Cobrado · {row.sale_number}
                    </Link>
                  ) : (
                    row.status !== 'cancelled' && (
                      <button className="pill-btn primary" onClick={() => setCharging(row)}>
                        Cobrar
                      </button>
                    )
                  )}
                  {row.status === 'scheduled' && (
                    <button className="pill-btn" onClick={() => changeStatus(row, 'no_show')}>
                      No vino
                    </button>
                  )}
                  {row.status !== 'scheduled' && !row.sale_id && (
                    <button className="pill-btn" onClick={() => changeStatus(row, 'scheduled')}>
                      Pendiente
                    </button>
                  )}
                  {/* Recordatorio por WhatsApp: abre el chat con el mensaje ya escrito, solo falta tocar enviar */}
                  {row.status === 'scheduled' &&
                    (wa ? (
                      <a className="pill-btn inline-flex items-center gap-1 no-underline" href={wa} target="_blank" rel="noreferrer">
                        <MessageCircle size={15} /> Recordar
                      </a>
                    ) : (
                      <button
                        className="pill-btn muted inline-flex items-center gap-1"
                        title="Falta el teléfono de la clienta"
                        onClick={() => setSinTelefono(sinTelefono === row.id ? null : row.id)}
                      >
                        <MessageCircle size={15} /> Recordar
                      </button>
                    ))}
                  <button className="pill-btn" onClick={() => setEditing(toAppointmentForm(row))}>
                    Editar
                  </button>
                </div>
                {/* Aviso cuando se toca "Recordar" y la clienta no tiene teléfono cargado */}
                {!wa && sinTelefono === row.id && (
                  <div className="mt-2 text-sm text-[#5a5155]">
                    Para recordarle el turno, cargá el teléfono de {firstName(row.display_customer) || 'la clienta'}
                    {row.customer_id ? (
                      <>
                        {' '}
                        en su{' '}
                        <Link className="text-link" to={`/clientes/${row.customer_id}`}>
                          ficha
                        </Link>
                        .
                      </>
                    ) : (
                      '. Este turno no tiene una clienta registrada: elegila desde Editar.'
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {!dayRows.length && (
          <li className="agenda-empty">
            No hay turnos para este día.{' '}
            <button className="link-btn" onClick={() => setEditing(emptyAppointment(day, '', isAdmin ? '' : user?.id))}>
              Dar un turno
            </button>
          </li>
        )}
      </ol>

      {/* Botón flotante para dar turno desde el celular */}
      <button
        className="fab lg:hidden"
        onClick={() => setEditing(emptyAppointment(day, '', isAdmin ? '' : user?.id))}
        aria-label="Nuevo turno"
      >
        <Plus size={26} />
      </button>

      {editing && (
        <AppointmentForm
          form={editing}
          customers={customers}
          services={services}
          staff={staff}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            const res = await api.saveAppointment(editing.id, body);
            setEditing(null);
            await load();
            const savedDay = ymd(res.data.day);
            if (savedDay !== day) goTo(savedDay);
          }}
          onDelete={async () => {
            if (!confirm('¿Borrar este turno?')) return;
            await api.deleteAppointment(editing.id);
            setEditing(null);
            await load();
          }}
        />
      )}

      {charging && (
        <CheckoutModal
          appointment={charging}
          onClose={() => setCharging(null)}
          onDone={async (sale) => {
            setCharging(null);
            setNotice(`Cobrado ${money(sale.total, currency)} · ${sale.number}`);
            setTimeout(() => setNotice(''), 4000);
            await load();
          }}
        />
      )}
    </div>
  );
}
