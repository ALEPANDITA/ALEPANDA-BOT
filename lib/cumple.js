// Cumpleanos del perfil (.setbirth). Se guarda como { dia, mes, anio|null }.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// nombre (es/en, completo o de 3 letras) -> numero de mes
const NOMBRE_A_MES = {};
const MESES_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
MESES.forEach((m, i) => { NOMBRE_A_MES[m] = i + 1; NOMBRE_A_MES[m.slice(0, 3)] = i + 1; });
MESES_EN.forEach((m, i) => { NOMBRE_A_MES[m] = i + 1; NOMBRE_A_MES[m.slice(0, 3)] = i + 1; });
NOMBRE_A_MES.sept = 9;

function diasDelMes(mes) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]; // febrero 29 para no rechazar a quien nacio el 29
}

// Acepta: 25/12/2000, 25/12, 25-12-2000, "25 diciembre", "25 de diciembre de 2000", "december 25".
// Con numeros el orden es DIA/MES (si el primero es mayor a 12 es obvio; si el segundo es mayor a 12 se voltean).
function parsearFecha(texto) {
  const t = String(texto || '').toLowerCase().replace(/\bde\b/g, ' ').replace(/,/g, ' ').trim();
  let dia; let mes; let anio = null;

  let m = t.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{4}))?$/);
  if (m) {
    dia = parseInt(m[1], 10);
    mes = parseInt(m[2], 10);
    if (mes > 12 && dia <= 12) [dia, mes] = [mes, dia];
    if (m[3]) anio = parseInt(m[3], 10);
  } else {
    m = t.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/) || null;
    if (m && NOMBRE_A_MES[m[2]]) {
      dia = parseInt(m[1], 10); mes = NOMBRE_A_MES[m[2]]; if (m[3]) anio = parseInt(m[3], 10);
    } else {
      m = t.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
      if (!m || !NOMBRE_A_MES[m[1]]) return null;
      mes = NOMBRE_A_MES[m[1]]; dia = parseInt(m[2], 10); if (m[3]) anio = parseInt(m[3], 10);
    }
  }

  if (!(mes >= 1 && mes <= 12) || !(dia >= 1 && dia <= diasDelMes(mes))) return null;
  if (anio !== null && (anio < 1900 || anio > new Date().getFullYear())) return null;
  return { dia, mes, anio };
}

function formatearCumple(c) {
  if (!c || !c.dia || !c.mes) return '';
  return `${c.dia} de ${MESES[c.mes - 1]}${c.anio ? ` de ${c.anio}` : ''}`;
}

// Edad cumplida hoy (solo si guardo el ano), o null.
function edadDe(c, ahora = new Date()) {
  if (!c?.anio) return null;
  let edad = ahora.getFullYear() - c.anio;
  if (ahora.getMonth() + 1 < c.mes || (ahora.getMonth() + 1 === c.mes && ahora.getDate() < c.dia)) edad--;
  return edad >= 0 ? edad : null;
}

module.exports = { parsearFecha, formatearCumple, edadDe };
