import { useState } from 'react';

export default function ProductForm({ form, categories, onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Un servicio (corte, color…) no lleva stock, unidad ni código de barras; sí duración.
  const isService = Boolean(state.isService);

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card wide"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave({
              sku: state.sku,
              name: state.name,
              description: state.description,
              categoryId: state.categoryId || null,
              unit: state.unit,
              barcode: state.barcode,
              costPrice: Number(state.costPrice || 0),
              salePrice: Number(state.salePrice || 0),
              stockQty: isService ? 0 : Number(state.stockQty || 0),
              minStock: isService ? 0 : Number(state.minStock || 0),
              isService,
              durationMin: isService ? Number(state.durationMin || 0) || null : null,
              active: true,
            });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="border-b border-[#eadfe2] px-5 py-4 text-lg">
          {state.id
            ? isService
              ? 'Editar servicio'
              : 'Editar producto'
            : isService
              ? 'Nuevo servicio'
              : 'Nuevo producto'}
        </div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
          <label className="field">
            <span>Código (opcional)</span>
            <input value={state.sku} placeholder="Se genera solo" onChange={(e) => set('sku', e.target.value)} />
          </label>
          <label className="field">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="field">
            <span>Categoría</span>
            <select value={state.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          {isService ? (
            <label className="field">
              <span>Duración (minutos)</span>
              <input
                type="number"
                min="5"
                step="5"
                value={state.durationMin}
                onChange={(e) => set('durationMin', e.target.value)}
                placeholder="Ej: 60"
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>Unidad</span>
                <input value={state.unit} onChange={(e) => set('unit', e.target.value)} />
              </label>
              <label className="field">
                <span>Código de barras</span>
                <input value={state.barcode} onChange={(e) => set('barcode', e.target.value)} />
              </label>
            </>
          )}
          <label className="field">
            <span>{isService ? 'Costo de insumos' : 'Costo'}</span>
            <input type="number" min="0" step="0.01" value={state.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
          </label>
          <label className="field">
            <span>Precio de venta</span>
            <input type="number" min="0" step="0.01" value={state.salePrice} onChange={(e) => set('salePrice', e.target.value)} />
          </label>
          {!state.id && !isService && (
            <label className="field">
              <span>Stock inicial</span>
              <input type="number" min="0" step="0.001" value={state.stockQty} onChange={(e) => set('stockQty', e.target.value)} />
            </label>
          )}
          {!isService && (
            <label className="field">
              <span>Stock mínimo</span>
              <input type="number" min="0" step="0.001" value={state.minStock} onChange={(e) => set('minStock', e.target.value)} />
            </label>
          )}
          <label className="field sm:col-span-2">
            <span>Descripción</span>
            <textarea rows={2} value={state.description} onChange={(e) => set('description', e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eadfe2] px-5 py-3">
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

export function emptyProduct(isService = false) {
  return {
    id: null,
    isService,
    durationMin: isService ? '60' : '',
    sku: '',
    name: '',
    description: '',
    categoryId: '',
    unit: isService ? 'servicio' : 'un',
    barcode: '',
    costPrice: '',
    salePrice: '',
    stockQty: '',
    minStock: '',
  };
}

export function toProductForm(row) {
  return {
    id: row.id,
    isService: Boolean(row.is_service),
    durationMin: row.duration_min || '',
    sku: row.sku || '',
    name: row.name || '',
    description: row.description || '',
    categoryId: row.category_id || '',
    unit: row.unit || 'un',
    barcode: row.barcode || '',
    costPrice: row.cost_price || '',
    salePrice: row.sale_price || '',
    stockQty: row.stock_qty || '',
    minStock: row.min_stock || '',
  };
}
