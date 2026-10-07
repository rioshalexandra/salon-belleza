import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, attachmentFileUrl } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import ProductForm, { emptyProduct, toProductForm } from '../components/ProductForm';
import StockAdjustModal from '../components/StockAdjustModal';
import { minutesLabel, money, qty } from '../format';
import { useStore } from '../store';

// Textos de cada variante de la página: productos de reventa o servicios del salón
const COPY = {
  products: {
    title: 'Productos',
    newLabel: 'Nuevo producto',
    path: '/productos',
    type: 'product',
    empty: 'No hay productos con esos filtros.',
  },
  services: {
    title: 'Servicios',
    newLabel: 'Nuevo servicio',
    path: '/servicios',
    type: 'service',
    empty: 'Todavía no cargaste servicios. Probá con "Corte", "Color" o "Manicura".',
  },
};

export default function ProductsPage({ kind = 'products' }) {
  const meta = COPY[kind];
  const isServices = kind === 'services';
  const { currency } = useStore();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [categoryId, setCategoryId] = useState(params.get('categoryId') || '');
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const search = new URLSearchParams();
    search.set('type', meta.type);
    if (q.trim()) search.set('q', q.trim());
    if (categoryId) search.set('categoryId', categoryId);
    return `?${search.toString()}`;
  }, [q, categoryId, meta.type]);

  async function load() {
    const [products, cats] = await Promise.all([api.products(query), api.categories()]);
    setRows(products.data);
    setCategories(cats.data);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (q.trim()) next.set('q', q.trim());
        else next.delete('q');
        if (categoryId) next.set('categoryId', categoryId);
        else next.delete('categoryId');
        return next;
      }, { replace: true });
      load().catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">{meta.title}</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#eadfe2] px-4 text-sm outline-none focus:border-[#7a5c1e] sm:w-auto sm:min-w-[220px]"
          placeholder={isServices ? 'Buscar servicio…' : 'Buscar nombre, código o código de barras…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {isServices && (
          <button
            className="pill-btn"
            onClick={async () => {
              try {
                const res = await api.addSuggestedServices();
                setError('');
                alert(
                  res.data.added
                    ? `Se agregaron ${res.data.added} servicios. Revisá los precios y ajustalos a los tuyos.`
                    : 'Ya tenés cargados los servicios sugeridos de tus rubros.'
                );
                await load();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            Cargar servicios sugeridos
          </button>
        )}
        <button className="pill-btn primary" onClick={() => setEditing(emptyProduct(isServices))}>
          {meta.newLabel}
        </button>
      </div>
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!newCategory.trim()) return;
          await api.saveCategory({ name: newCategory.trim() });
          setNewCategory('');
          await load();
        }}
      >
        <input
          className="h-9 rounded-full border border-[#eadfe2] px-4 text-sm"
          placeholder="Nueva categoría"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button className="pill-btn" type="submit">
          Agregar categoría
        </button>
      </form>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
        <table className="data-table">
          <thead>
            <tr>
              <th>{isServices ? 'Servicio' : 'Producto'}</th>
              <th>Categoría</th>
              <th>{isServices ? 'Duración' : 'Stock'}</th>
              <th>{isServices ? 'Costo insumos' : 'Costo'}</th>
              <th>Precio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex items-center gap-3">
                    {row.photo_id ? (
                      <img
                        src={attachmentFileUrl(row.photo_id)}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border border-[#eadfe2] object-cover"
                      />
                    ) : (
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-[#eadfe2] text-xs text-[#6b6266]">
                        Foto
                      </div>
                    )}
                    <div>
                      <Link className="font-medium text-[#7a5c1e]" to={`${meta.path}/${row.id}`}>
                        {row.name}
                      </Link>
                      <div className="text-xs text-[#6b6266]">{row.sku}</div>
                    </div>
                  </div>
                </td>
                <td>{row.category_name || '—'}</td>
                <td>
                  {isServices ? (
                    minutesLabel(row.duration_min)
                  ) : (
                    <>
                      {qty(row.stock_qty)} {row.unit}
                      {Number(row.min_stock) > 0 && Number(row.stock_qty) <= Number(row.min_stock) && (
                        <span className="badge badge-low ml-2">Stock crítico</span>
                      )}
                    </>
                  )}
                </td>
                <td>{money(row.cost_price, currency)}</td>
                <td>{money(row.sale_price, currency)}</td>
                <td className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {!isServices && (
                      <button className="pill-btn" onClick={() => setAdjusting(row)}>
                        Stock
                      </button>
                    )}
                    <button className="pill-btn" onClick={() => setEditing(toProductForm(row))}>
                      Editar
                    </button>
                    <button className="pill-btn danger" onClick={() => setRemoving(row)}>
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-8 text-center text-[#6b6266]" colSpan={6}>
                  {meta.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={async (body) => {
            await api.adjustStock(adjusting.id, body);
            setAdjusting(null);
            await load();
          }}
        />
      )}
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${removing.name}`}
          message={`Se va a borrar ${isServices ? 'el servicio' : 'el producto'} ${removing.name} (${removing.sku}). Si está en ventas o compras, primero hay que borrar esos comprobantes.`}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.deleteProduct(removing.id);
            setRemoving(null);
            await load();
          }}
        />
      )}
      {editing && (
        <ProductForm
          form={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.saveProduct(editing.id, body);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
