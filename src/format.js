export function money(value, currency = 'ARS') {
  return Number(value || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

export function qty(value) {
  return Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

export function ymd(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function ymdt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ymd(value);
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export const METHODS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  other: 'Otro',
};

export const STATUSES = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

export const MOVEMENT_KINDS = {
  sale: 'Venta',
  purchase: 'Compra',
  manual: 'Modificación manual',
  adjustment: 'Ajuste',
  import: 'Importación',
};

// Fecha local AAAA-MM-DD (no UTC, así a la noche no salta al día siguiente)
export function today() {
  return toYmd(new Date());
}

export function toYmd(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Suma (o resta) días a una fecha AAAA-MM-DD
export function addDays(ymdValue, days) {
  const [y, m, d] = ymdValue.split('-').map(Number);
  return toYmd(new Date(y, m - 1, d + days));
}

// "miércoles 7 de octubre"
export function longDate(ymdValue) {
  const [y, m, d] = String(ymdValue).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// "7 de octubre" a partir de una fecha de cumpleaños (ignora el año)
export function birthdayLabel(value) {
  if (!value) return '—';
  const [, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

export function minutesLabel(min) {
  const n = Number(min || 0);
  if (!n) return '—';
  const h = Math.floor(n / 60);
  const r = n % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const APPOINTMENT_STATUSES = {
  scheduled: 'Pendiente',
  done: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'No vino',
};

// Rubros que puede trabajar el negocio
export const BUSINESS_TYPES = {
  peluqueria: 'Peluquería',
  barberia: 'Barbería',
  estetica: 'Estética',
  unas: 'Uñas',
  depilacion: 'Depilación',
  masajes: 'Masajes',
};

// Medios de pago que se ofrecen al cobrar (los más usados primero)
export const QUICK_METHODS = [
  ['cash', 'Efectivo'],
  ['transfer', 'Transferencia'],
  ['card', 'Tarjeta'],
  ['other', 'Otro'],
];

// Pasa un teléfono argentino al formato que entiende WhatsApp (549 + área + número).
// Acepta cómo se suele cargar a mano: "011 15 1234-5678", "11 1234 5678",
// "+54 9 11 1234 5678", "0351 15 123-4567", etc. Devuelve null si no hay número.
export function normalizePhoneAR(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;

  // Sacamos el código de país (con o sin el 9 de celular) para trabajar con el número nacional
  if (digits.startsWith('54')) {
    digits = digits.slice(2);
    if (digits.startsWith('9')) digits = digits.slice(1);
  }
  // Sacamos el 0 del código de área
  if (digits.startsWith('0')) digits = digits.slice(1);

  // Un número nacional tiene 10 dígitos. Si tiene 12, viene con el "15" de celular
  // metido después del código de área (que puede ser de 2, 3 o 4 dígitos): lo sacamos.
  if (digits.length === 12) {
    if (digits.startsWith('11') && digits.slice(2, 4) === '15') {
      digits = digits.slice(0, 2) + digits.slice(4); // Buenos Aires (área 11)
    } else if (digits.slice(3, 5) === '15') {
      digits = digits.slice(0, 3) + digits.slice(5); // área de 3 dígitos (ej. 351, 221)
    } else if (digits.slice(4, 6) === '15') {
      digits = digits.slice(0, 4) + digits.slice(6); // área de 4 dígitos (ej. 2223)
    }
  }

  return `549${digits}`;
}

// Link de WhatsApp con mensaje armado. Asume Argentina.
export function whatsappLink(phone, text = '') {
  const digits = normalizePhoneAR(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

// "hoy", "mañana" o "el viernes 9 de octubre", según la fecha del turno
export function relativeDay(ymdValue) {
  const day = String(ymdValue).slice(0, 10);
  if (day === today()) return 'hoy';
  if (day === addDays(today(), 1)) return 'mañana';
  return `el ${longDate(day)}`;
}

// Primer nombre para saludar: "Sofía Pérez" → "Sofía"
export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}
