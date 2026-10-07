import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { QUICK_METHODS, money } from '../format';
import { useStore } from '../store';

// Cobro en un solo paso: elegir qué se cobra, quién lo hizo y cómo paga. Listo.
// Si viene `appointment`, se completan cliente, empleado y servicio del turno.
export default function CheckoutModal({ appointment, onClose, onDone }) {
  const { currency } = useStore();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customerId, setCustomerId] = useState(appointment?.customer_id ? String(appointment.customer_id) : '');
  const [staffId, setStaffId] = useState(String(appointment?.staff_id || user?.id || ''));
  const [items, setItems] = useState([]);
  const [method, setMethod] = useState('cash');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.products(), api.customers(), api.staff()])
      .then(([p, c, s]) => {
        setCatalog(p.data);
        setCustomers(c.data);
        setStaff(s.data);
        // Turno: arranca con su servicio y el precio acordado
        if (appointment?.service_id) {
          const svc = p.data.find((row) => row.id === appointment.service_id);
          if (svc) {
            setItems([
              {
                productId: svc.id,
                name: svc.name,
                isService: true,
                qty: 1,
                price: Number(appointment.price ?? svc.sale_price),
              },
            ]);
          }
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.qty * Number(item.price || 0), 0), [items]);

  // Resultados del buscador: servicios primero, luego productos con stock
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return catalog
      .filter((row) => row.name.toLowerCase().includes(term))
      .sort((a, b) => Number(b.is_service) - Number(a.is_service))
      .slice(0, 6);
  }, [search, catalog]);

  // Accesos rápidos: los servicios del catálogo (los primeros 8)
  const quickServices = catalog.filter((row) => row.is_service).slice(0, 8);

  function add(row) {
    setItems((prev) => {
      const found = prev.find((item) => item.productId === row.id);
      if (found) return prev.map((item) => (item.productId === row.id ? { ...item, qty: item.qty + 1 } : item));
      return [
        ...prev,
        { productId: row.id, name: row.name, isService: row.is_service, qty: 1, price: Number(row.sale_price) },
      ];
    });
    setSearch('');
  }

  function changeQty(productId, delta) {
    setItems((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  }

  function setPrice(productId, price) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, price } : item)));
  }

  async function submit() {
    if (!items.length) {
      setError('Agregá al menos un servicio o producto');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.quickSale({
        appointmentId: appointment?.id || null,
        customerId: customerId || null,
        staffId: staffId || null,
        method,
        items: items.map((item) => ({ productId: item.productId, qty: item.qty, unitPrice: Number(item.price || 0) })),
      });
      onDone?.(res.data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-head flex items-center">
          <span className="mr-auto">Cobrar{appointment ? ` turno de ${appointment.display_customer}` : ''}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* Quién y a quién */}
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Cliente</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Sin cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Atendió</span>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Qué se cobra */}
          <div>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6266]" />
              <input
                className="search-input pl-9"
                placeholder="Buscar servicio o producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {!!matches.length && (
                <div className="dropdown">
                  {matches.map((row) => (
                    <button key={row.id} type="button" className="dropdown-item" onClick={() => add(row)}>
                      <span>
                        {row.name}
                        {!row.is_service && <span className="ml-2 text-xs text-[#6b6266]">stock {Number(row.stock_qty)}</span>}
                      </span>
                      <span>{money(row.sale_price, currency)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!items.length && quickServices.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quickServices.map((row) => (
                  <button key={row.id} type="button" className="chip" onClick={() => add(row)}>
                    {row.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <ul className="divide-y divide-[#eadfe2] rounded-xl border border-[#eadfe2] bg-white">
              {items.map((item) => (
                <li key={item.productId} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <input
                      className="mt-1 w-28 rounded-md border border-[#eadfe2] px-2 py-1 text-sm"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={item.price}
                      onChange={(e) => setPrice(item.productId, e.target.value)}
                      aria-label="Precio"
                    />
                  </div>
                  <button type="button" className="qty-btn" onClick={() => changeQty(item.productId, -1)} aria-label="Restar">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                  <button type="button" className="qty-btn" onClick={() => changeQty(item.productId, 1)} aria-label="Sumar">
                    <Plus size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Cómo paga */}
          <div>
            <div className="mb-2 text-xs font-medium text-[#6b6266]">Medio de pago</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_METHODS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`method-btn ${method === value ? 'active' : ''}`}
                  onClick={() => setMethod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <div className="mr-auto">
            <div className="text-xs text-[#6b6266]">Total</div>
            <div className="text-2xl font-semibold">{money(total, currency)}</div>
          </div>
          <button className="pill-btn primary big" onClick={submit} disabled={busy || !items.length}>
            {busy ? 'Cobrando…' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
