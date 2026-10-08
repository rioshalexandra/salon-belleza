import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cake, CalendarDays, MessageCircle, PackageOpen, Wallet } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  APPOINTMENT_STATUSES,
  METHODS,
  birthdayLabel,
  longDate,
  money,
  planIncludes,
  qty,
  today,
  whatsappLink,
} from '../format';
import { useStore } from '../store';
import { initials } from './StaffPage';

// Inicio. Administración: números del negocio y una tarjeta por empleado.
// Empleado: su propio resumen (turnos, lo facturado y su comisión).
export default function DashboardPage() {
  const { currency, settings } = useStore();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard(today()).then((res) => setData(res.data)).catch((err) => setError(err.message));
  }, []);

  if (!data && !error) return <div className="page text-[#6b6266]">Cargando…</div>;

  const cashTotal = (data?.cashToday || []).reduce((sum, row) => sum + Number(row.total), 0);
  const firstName = String(user?.name || '').split(' ')[0];

  return (
    <div className="page">
      <h1 className="text-2xl">Hola{firstName ? `, ${firstName}` : ''}</h1>
      <div className="mb-5 text-sm text-[#6b6266] first-letter:uppercase">{longDate(today())}</div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <>
          {/* Números del negocio (solo administración) */}
          {data.isAdmin && (
            <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi label="Cobrado hoy" value={money(cashTotal, currency)} hint="Caja del día" />
              <Kpi label="Turnos de hoy" value={data.todayAppointments.length} hint={`${data.todayAppointments.filter((a) => a.status === 'done').length} realizados`} />
              <Kpi label="Ventas del mes" value={money(data.month.total, currency)} hint={`${data.month.count} ventas`} />
              <Kpi label="Comisiones del mes" value={money(data.month.commissions, currency)} hint="A pagar a empleados" />
            </div>
          )}

          {/* Una tarjeta por empleado (o solo la propia) */}
          <section className="mb-6">
            <h2 className="section-title">{data.isAdmin ? 'Equipo' : 'Mi resumen'}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.staff.map((s) => (
                <div key={s.id} className="card-tile staff-card" style={{ borderTopColor: s.color || '#b08a3e' }}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="avatar" style={{ background: s.color || '#b08a3e' }}>
                      {initials(s.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.name}</div>
                      {/* El resumen de turnos solo tiene sentido si el plan incluye la agenda */}
                      <div className="text-xs text-[#6b6266]">
                        {!planIncludes(settings?.plan, 'agenda')
                          ? 'Resumen de cobros'
                          : s.today_total
                          ? `${s.today_done} de ${s.today_total} turnos hoy${s.next_time ? ` · próximo ${s.next_time}` : ''}`
                          : 'Sin turnos hoy'}
                      </div>
                    </div>
                    <span className="gold-pill">{Number(s.commission_pct)}%</span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Hoy" value={money(s.today_billed, currency)} />
                    <Stat label="Mes" value={money(s.month_billed, currency)} />
                    <Stat label="Comisión" value={money(s.month_commission, currency)} strong />
                  </dl>
                </div>
              ))}
              {!data.staff.length && <div className="text-sm text-[#6b6266]">No hay empleados cargados.</div>}
            </div>
            {data.isAdmin && (
              <Link className="text-link mt-2 inline-block text-sm" to="/empleados">
                Administrar empleados y comisiones
              </Link>
            )}
          </section>

          <div className="mb-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
            {/* Turnos de hoy (solo si el plan incluye la agenda) */}
            {planIncludes(settings?.plan, 'agenda') && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title m-0 flex items-center gap-2">
                  <CalendarDays size={18} /> {data.isAdmin ? 'Turnos de hoy' : 'Mis turnos de hoy'}
                </h2>
                <Link className="text-link text-sm" to="/agenda">
                  Abrir agenda
                </Link>
              </div>
              <ol className="agenda-thread compact">
                {data.todayAppointments.map((row) => (
                  <li key={row.id} className={`agenda-item status-${row.status}`}>
                    <div className="agenda-time font-semibold">{row.start_hhmm}</div>
                    <div className="agenda-card flex items-center gap-2" style={{ borderLeftColor: row.staff_color || undefined }}>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{row.customer}</div>
                        <div className="text-sm text-[#5a5155]">
                          {row.service || 'Servicio sin especificar'}
                          {data.isAdmin && row.staff_name && ` · ${row.staff_name}`}
                        </div>
                      </div>
                      <span className={`badge appt-${row.status}`}>{APPOINTMENT_STATUSES[row.status]}</span>
                    </div>
                  </li>
                ))}
                {!data.todayAppointments.length && (
                  <li className="agenda-empty">
                    Hoy no hay turnos.{' '}
                    <Link className="text-link" to="/agenda?nuevo=1">
                      Dar un turno
                    </Link>
                  </li>
                )}
              </ol>
            </section>
            )}

            <div className="grid content-start gap-6">
              {/* Caja del día por medio de pago */}
              {data.isAdmin && (
                <section>
                  <h2 className="section-title flex items-center gap-2">
                    <Wallet size={18} /> Caja de hoy
                  </h2>
                  <div className="list-card">
                    {data.cashToday.map((row) => (
                      <div key={row.method} className="list-row">
                        <span>{METHODS[row.method] || row.method}</span>
                        <span className="font-medium">{money(row.total, currency)}</span>
                      </div>
                    ))}
                    {!data.cashToday.length && <div className="list-empty">Todavía no se cobró nada hoy.</div>}
                  </div>
                </section>
              )}

              {/* Cumpleaños del mes, con saludo por WhatsApp */}
              <section>
                <h2 className="section-title flex items-center gap-2">
                  <Cake size={18} /> Cumpleaños del mes
                </h2>
                <div className="list-card">
                  {data.birthdays.map((row) => {
                    const wa = whatsappLink(
                      row.phone,
                      `¡Feliz cumpleaños ${row.name.split(' ')[0]}! Te saludamos desde ${settings?.name || 'el salón'} 🎉`
                    );
                    return (
                      <div key={row.id} className="list-row">
                        <Link className="min-w-0 truncate text-[#1c1a1b] no-underline" to={`/clientes/${row.id}`}>
                          {row.name}
                        </Link>
                        <span className="flex items-center gap-2 text-[#6b6266]">
                          {birthdayLabel(row.birthday)}
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" className="icon-btn h-8 w-8 text-[#7a5c1e]" title="Saludar por WhatsApp">
                              <MessageCircle size={16} />
                            </a>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {!data.birthdays.length && <div className="list-empty">Nadie cumple años este mes.</div>}
                </div>
              </section>

              {/* Productos de reventa por debajo del mínimo */}
              {data.isAdmin && planIncludes(settings?.plan, 'stock') && (
                <section>
                  <h2 className="section-title flex items-center gap-2">
                    <PackageOpen size={18} /> Para reponer
                  </h2>
                  <div className="list-card">
                    {data.lowStock.map((row) => (
                      <Link key={row.id} to={`/productos/${row.id}`} className="list-row text-[#1c1a1b] no-underline">
                        <span>{row.name}</span>
                        <span className="badge badge-low">
                          {qty(row.stock_qty)} / crítico {qty(row.min_stock)}
                        </span>
                      </Link>
                    ))}
                    {!data.lowStock.length && <div className="list-empty">Todo el stock está en orden.</div>}
                  </div>
                  {data.lowStock.length > 0 && (
                    <Link className="pill-btn primary mt-3 inline-flex items-center no-underline" to="/pedido">
                      Armar pedido
                    </Link>
                  )}
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="mt-1 text-xs text-[#6b6266]">{hint}</div>
    </div>
  );
}

function Stat({ label, value, strong }) {
  return (
    <div className={`rounded-lg px-1 py-2 ${strong ? 'bg-[#f7efe0]' : 'bg-[#fbf3f5]'}`}>
      <dt className="text-[11px] text-[#6b6266]">{label}</dt>
      <dd className={`m-0 text-sm ${strong ? 'font-semibold text-[#6b5120]' : 'font-medium'}`}>{value}</dd>
    </div>
  );
}
