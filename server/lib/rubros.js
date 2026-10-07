// Servicios sugeridos para cada rubro. Se usan para cargar el catálogo inicial con un botón.
// [código, nombre, precio sugerido, duración en minutos]
export const SUGGESTED_SERVICES = {
  peluqueria: {
    label: 'Peluquería',
    category: 'Peluquería',
    services: [
      ['PEL-CORTE', 'Corte y peinado', 14000, 45],
      ['PEL-BRUSHING', 'Brushing', 9000, 30],
      ['PEL-COLOR', 'Color raíz', 28000, 90],
      ['PEL-MECHAS', 'Mechas / balayage', 55000, 150],
      ['PEL-TRAT', 'Tratamiento capilar', 18000, 45],
    ],
  },
  estetica: {
    label: 'Estética',
    category: 'Estética',
    services: [
      ['EST-LIMPIEZA', 'Limpieza facial', 22000, 60],
      ['EST-PEELING', 'Peeling', 26000, 45],
      ['EST-CEJAS', 'Perfilado de cejas', 7000, 20],
      ['EST-PESTANAS', 'Lifting de pestañas', 18000, 60],
    ],
  },
  unas: {
    label: 'Uñas',
    category: 'Uñas',
    services: [
      ['UNA-SEMI', 'Esmaltado semipermanente', 15000, 60],
      ['UNA-KAPPING', 'Kapping', 20000, 75],
      ['UNA-ESCULP', 'Uñas esculpidas', 28000, 120],
      ['UNA-PEDI', 'Pedicura', 16000, 60],
    ],
  },
  depilacion: {
    label: 'Depilación',
    category: 'Depilación',
    services: [
      ['DEP-PIERNA', 'Depilación pierna entera', 14000, 40],
      ['DEP-CAVADO', 'Depilación cavado', 9000, 25],
      ['DEP-AXILAS', 'Depilación axilas', 6000, 15],
      ['DEP-BOZO', 'Depilación bozo', 4000, 10],
    ],
  },
  kinesiologia: {
    label: 'Kinesiología',
    category: 'Kinesiología',
    services: [
      ['KIN-SESION', 'Sesión de kinesiología', 15000, 45],
      ['KIN-EVAL', 'Evaluación inicial', 18000, 60],
      ['KIN-DRENAJE', 'Drenaje linfático', 20000, 60],
    ],
  },
  masajes: {
    label: 'Masajes',
    category: 'Masajes',
    services: [
      ['MAS-RELAX', 'Masaje relajante', 20000, 60],
      ['MAS-DESCONT', 'Masaje descontracturante', 22000, 60],
      ['MAS-PIEDRAS', 'Masaje con piedras calientes', 26000, 75],
    ],
  },
};
