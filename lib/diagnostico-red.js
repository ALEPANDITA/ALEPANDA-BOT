// lib/diagnostico-red.js
// Extrae las URLs que un comando llama (fetch/fetchEvogb/axios.get) y las
// prueba EN VIVO contra el servidor real, para dar al owner el error tecnico
// exacto (codigo HTTP, cuerpo de la respuesta, o el error de red tal cual)
// en vez de que tenga que adivinarlo o describirlo el mismo.

const TIMEOUT_MS = 8000;

// Encuentra strings de URL (backtick o comilla simple/doble) que aparecen
// como argumento de fetch(...), fetchEvogb(...) o axios.get(...).
function extraerUrls(codigoFuente) {
  const patrones = [
    /(?:fetch|fetchEvogb)\(\s*`([^`]*https?:\/\/[^`]*)`/g,
    /(?:fetch|fetchEvogb)\(\s*'([^']*https?:\/\/[^']*)'/g,
    /(?:fetch|fetchEvogb)\(\s*"([^"]*https?:\/\/[^"]*)"/g,
    /axios\.get\(\s*`([^`]*https?:\/\/[^`]*)`/g,
    /axios\.get\(\s*'([^']*https?:\/\/[^']*)'/g,
    /axios\.get\(\s*"([^"]*https?:\/\/[^"]*)"/g,
  ];

  const encontradas = new Set();
  for (const patron of patrones) {
    let m;
    while ((m = patron.exec(codigoFuente)) !== null) {
      encontradas.add(m[1]);
    }
  }
  return [...encontradas];
}

// Reemplaza cualquier ${...} (interpolacion de plantilla) por un valor de
// prueba generico, para poder probar la URL aunque dependa de variables.
function rellenarConValorDePrueba(urlConPlaceholders) {
  return urlConPlaceholders.replace(/\$\{[^}]*\}/g, 'test');
}

async function probarUrl(urlOriginal) {
  const urlDePrueba = rellenarConValorDePrueba(urlOriginal);
  const eraDinamica = urlDePrueba !== urlOriginal;

  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(urlDePrueba, { signal: controlador.signal });
    clearTimeout(timeoutId);
    let cuerpo = '';
    try {
      cuerpo = (await res.text()).slice(0, 400);
    } catch (e) {
      cuerpo = '(no se pudo leer el cuerpo de la respuesta)';
    }
    return {
      urlOriginal,
      urlProbada: urlDePrueba,
      eraDinamica,
      ok: res.ok,
      status: res.status,
      cuerpo
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      urlOriginal,
      urlProbada: urlDePrueba,
      eraDinamica,
      ok: false,
      status: null,
      error: err.name === 'AbortError' ? `Tiempo de espera agotado (${TIMEOUT_MS}ms)` : err.message
    };
  }
}

// Prueba todas las URLs encontradas en el codigo fuente de un comando y
// devuelve un resumen legible + el detalle crudo (para dar contexto real a la IA).
async function diagnosticarComando(codigoFuente) {
  const urls = extraerUrls(codigoFuente);
  if (!urls.length) {
    return { urls: [], resumenTexto: 'No se encontraron URLs de red en el codigo de este comando para probar en vivo.' };
  }

  const resultados = [];
  for (const url of urls) {
    resultados.push(await probarUrl(url));
  }

  const lineas = resultados.map((r) => {
    const etiquetaDinamica = r.eraDinamica ? ' (con valor de prueba generico en los ${...})' : '';
    if (r.error) {
      return `❌ ${r.urlOriginal}${etiquetaDinamica}\n   Error de red: ${r.error}`;
    }
    const estadoTexto = r.ok ? `HTTP ${r.status} OK` : `HTTP ${r.status} (fallo)`;
    return `${r.ok ? '✅' : '❌'} ${r.urlOriginal}${etiquetaDinamica}\n   ${estadoTexto}\n   Respuesta: ${r.cuerpo.replace(/\s+/g, ' ').trim()}`;
  });

  return { urls, resultados, resumenTexto: lineas.join('\n\n') };
}

module.exports = { diagnosticarComando, extraerUrls, probarUrl };
