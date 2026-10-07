import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import AttachmentsPanel from '../components/AttachmentsPanel';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import ProductForm, { toProductForm } from '../components/ProductForm';
import StockAdjustModal from '../components/StockAdjustModal';
import { MOVEMENT_KINDS, minutesLabel, money, qty, ymd } from '../format';
import { useStore } from '../store';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useStore();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [res, cats] = await Promise.all([api.product(id), api.categories()]);
    setProduct(res.data);
    setCategories(cats.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  if (!product) return <div className="p-6 text-[#7a6f73]">{error || 'Cargando…'}</div>;

  // Los servicios comparten esta página pero sin stock ni movimientos
  const isService = Boolean(product.is_service);
  const backPath = isService ? '/servicios' : '/productos';

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <Link className="text-sm text-[#8e3b5f]" to={backPath}>
            ← {isService ? 'Servicios' : 'Productos'}
          </Link>
          <h1 className="text-2xl">{product.name}</h1>
          <div className="text-sm text-[#7a6f73]">
            {product.sku} · {product.category_name || 'Sin categoría'}
          </div>
        </div>
        {!isService && (
          <button className="pill-btn" onClick={() => setAdjusting(true)}>
            Ajustar stock
          </button>
        )}
        <button className="pill-btn" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button className="pill-btn danger" onClick={() => setRemoving(true)}>
          Borrar
        </button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="kpi-card">
          <div className="kpi-label">{isService ? 'Duración' : 'Stock'}</div>
          <div className="kpi-value">
            {isService ? minutesLabel(product.duration_min) : `${qty(product.stock_qty)} ${product.unit}`}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{isService ? 'Costo de insumos' : 'Costo'}</div>
          <div className="kpi-value">{money(product.cost_price, currency)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Precio</div>
          <div className="kpi-value">{money(product.sale_price, currency)}</div>
        </div>
      </div>
      <AttachmentsPanel
        title="Fotos"
        entityType="product"
        entityId={product.id}
        items={product.attachments || []}
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,.jpg,.jpeg,.png,.webp,.gif,.heic"
        helper={
          isService
            ? 'Podés subir fotos de trabajos de este servicio (hasta 12 MB cada una).'
            : 'Podés subir varias fotos del producto (hasta 12 MB cada una).'
        }
        onChanged={load}
      />
      {!isService && (
      <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-medium">Historial de stock</h2>
        <Link className="text-sm text-[#8e3b5f]" to={`/movimientos?productId=${product.id}`}>
          Ver todos los movimientos
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#e7dfe1]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {(product.movements || []).map((row) => (
              <tr key={row.id}>
                <td>{ymd(row.created_at)}</td>
                <td>{MOVEMENT_KINDS[row.kind] || row.kind}</td>
                <td className={Number(row.qty) < 0 ? 'text-[#c5221f]' : 'text-[#137333]'}>
                  {qty(row.qty)}
                </td>
                <td>{row.notes || '—'}</td>
              </tr>
            ))}
            {!product.movements?.length && (
              <tr>
                <td className="py-8 text-center text-[#7a6f73]" colSpan={4}>
                  Sin movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>
      )}
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${product.name}`}
          message={`Se va a borrar ${isService ? 'el servicio' : 'el producto'} ${product.name} (${product.sku}). Si está en ventas o compras, primero hay que borrar esos comprobantes.`}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await api.deleteProduct(product.id);
            navigate(backPath);
          }}
        />
      )}
      {adjusting && (
        <StockAdjustModal
          product={product}
          onClose={() => setAdjusting(false)}
          onSave={async (body) => {
            await api.adjustStock(product.id, body);
            setAdjusting(false);
            await load();
          }}
        />
      )}
      {editing && (
        <ProductForm
          form={toProductForm(product)}
          categories={categories}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            await api.saveProduct(product.id, body);
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
