import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cake, CalendarDays, PackageOpen } from 'lucide-react';
import { api } from '../api';
import { APPOINTMENT_STATUSES, birthdayLabel, longDate, money, qty, today } from '../format';
import { useStore } from '../store';
import StatusBadge from '../components/StatusBadge';

// Inicio del salón: turnos de hoy, números del mes, cumpleaños y productos a reponer.
export default function DashboardPage() {
  const { currency } = useStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard(today()).then((res) => setData(res.data)).catch((err) => setError(err.message));
  }, []);

  if (!data && !error) return <div className="p-6 text-[#7a6f73]">Cargando…</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="text-2xl">Inicio</h1>
      <div className="mb-4 text-sm text-[#7a6f73] first-letter:uppercase">{longDate(today())}</div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Turnos de hoy"
              value={data.todayAppointments.length}
              hint={`${data.todayAppointments.filter((a) => a.status === 'done').length} realizados`}
            />
            <Kpi label="Ventas del mes" value={money(data.salesMonth.total, currency)} hint={`${data.salesMonth.count} ventas`} />
            <Kpi label="Por cobrar" value={money(data.receivable, currency)} hint="Saldo de clientes" />
            <Kpi label="Stock a costo" value={money(data.stock.cost_value, currency)} hint={`A venta ${money(data.stock.sale_value, currency)}`} />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
            {/* Turnos de hoy en línea de tiempo */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-medium">
                  <CalendarDays size={18} /> Turnos de hoy
                </h2>
                <Link className="text-sm text-[#8e3b5f]" to="/agenda">
                  Abrir agenda
                </Link>
              </div>
              <ol className="agenda-thread compact">
                {data.todayAppointments.map((row) => (
                  <li key={row.id} className={`agenda-item status-${row.status}`}>
                    <div className="agenda-time font-semibold">{row.start_hhmm}</div>
                    <div className="agenda-card flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{row.customer}</div>
                        <div className="text-sm text-[#655a5e]">
                          {row.service || 'Servicio sin especificar'}
                          {row.staff_name && ` · ${row.staff_name}`}
                        </div>
                      </div>
                      <span className={`badge appt-${row.status}`}>{APPOINTMENT_STATUSES[row.status]}</span>
                    </div>
                  </li>
                ))}
                {!data.todayAppointments.length && (
                  <li className="agenda-empty">
                    Hoy no hay turnos.{' '}
                    <Link className="text-[#8e3b5f]" to="/agenda?nuevo=1">
                      Dar un turno
                    </Link>
                  </li>
                )}
              </ol>
            </section>

            <div className="grid content-start gap-6">
              {/* Cumpleaños del mes */}
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
                  <Cake size={18} /> Cumpleaños del mes
                </h2>
                <div className="rounded-xl border border-[#e7dfe1]">
                  {data.birthdays.map((row) => (
                    <Link
                      key={row.id}
                      to={`/clientes/${row.id}`}
                      className="flex items-center justify-between border-b border-[#e7dfe1] px-4 py-2.5 text-sm no-underline last:border-b-0 hover:bg-[#fcf9fa]"
                    >
                      <span className="text-[#3a3034]">{row.name}</span>
                      <span className="text-[#7a6f73]">{birthdayLabel(row.birthday)}</span>
                    </Link>
                  ))}
                  {!data.birthdays.length && (
                    <div className="px-4 py-6 text-center text-sm text-[#7a6f73]">Nadie cumple años este mes.</div>
                  )}
                </div>
              </section>

              {/* Productos de reventa por debajo del mínimo */}
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
                  <PackageOpen size={18} /> Para reponer
                </h2>
                <div className="rounded-xl border border-[#e7dfe1]">
                  {data.lowStock.map((row) => (
                    <Link
                      key={row.id}
                      to={`/productos/${row.id}`}
                      className="flex items-center justify-between border-b border-[#e7dfe1] px-4 py-2.5 text-sm no-underline last:border-b-0 hover:bg-[#fcf9fa]"
                    >
                      <span className="text-[#3a3034]">{row.name}</span>
                      <span className="badge badge-low">
                        {qty(row.stock_qty)} / mín. {qty(row.min_stock)}
                      </span>
                    </Link>
                  ))}
                  {!data.lowStock.length && (
                    <div className="px-4 py-6 text-center text-sm text-[#7a6f73]">Todo el stock está en orden.</div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Últimas ventas</h2>
              <Link className="text-sm text-[#8e3b5f]" to="/ventas">
                Ver todas
              </Link>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#e7dfe1]">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link className="text-[#8e3b5f]" to={`/ventas/${row.id}`}>
                          {row.number}
                        </Link>
                      </td>
                      <td>{row.customer_name || 'Sin cliente'}</td>
                      <td>{money(row.total, currency)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                  {!data.recentSales.length && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#7a6f73]">
                        Todavía no hay ventas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
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
      <div className="mt-1 text-xs text-[#7a6f73]">{hint}</div>
    </div>
  );
}
