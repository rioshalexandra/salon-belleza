// Campos de la ficha del cliente según el rubro.
// Solo se muestran los campos de los rubros elegidos en Configuración.
export const CUSTOMER_FIELDS = [
  {
    key: 'hairType',
    column: 'hair_type',
    label: 'Tipo de cabello',
    placeholder: 'Ej: rizado, fino, poroso, con canas',
    rubros: ['peluqueria', 'barberia'],
  },
  {
    key: 'colorFormula',
    column: 'color_formula',
    label: 'Fórmula de color habitual',
    placeholder: 'Ej: 7.1 + 7.0 (1:1) con oxidante 20 vol, 35 min',
    rubros: ['peluqueria'],
    wide: true,
  },
  {
    key: 'skinType',
    column: 'skin_type',
    label: 'Tipo de piel',
    placeholder: 'Ej: mixta, sensible, seca',
    rubros: ['estetica', 'depilacion'],
  },
  {
    key: 'waxingNotes',
    column: 'waxing_notes',
    label: 'Depilación: zonas y método',
    placeholder: 'Ej: piernas y axilas con cera tibia, cada 4 semanas',
    rubros: ['depilacion'],
  },
  {
    key: 'nailNotes',
    column: 'nail_notes',
    label: 'Uñas: forma, largo y gustos',
    placeholder: 'Ej: almendra, largo medio, tonos nude',
    rubros: ['unas'],
  },
  {
    key: 'beardNotes',
    column: 'beard_notes',
    label: 'Barba: estilo y largo',
    placeholder: 'Ej: barba corta degradada, perfilado marcado',
    rubros: ['barberia'],
  },
  {
    key: 'massageNotes',
    column: 'massage_notes',
    label: 'Masajes: presión y preferencias',
    placeholder: 'Ej: presión media, sin aceites con aroma, música suave',
    rubros: ['masajes'],
  },
];

// Devuelve los campos que aplican a los rubros elegidos
export function fieldsForRubros(types = []) {
  const selected = types.length ? types : ['peluqueria'];
  return CUSTOMER_FIELDS.filter((field) => field.rubros.some((r) => selected.includes(r)));
}
