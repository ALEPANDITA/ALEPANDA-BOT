const fs = require('fs');
const path = require('path');
const { getApiKeys } = require('./apikeys');

const MODELOS_CHAT = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
// gemini-2.5-flash-image SI tiene cuota gratis real (hasta 500 img/dia). gemini-3.1-flash-image
// (Nano Banana 2) no tiene cuota gratuita en absoluto, asi que se deja solo como respaldo.
const MODELOS_IMAGEN = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];

// Aqui guardamos cual fue la ultima clave de Gemini que funciono, para no
// empezar siempre por la clave 1 si esa ya se sabe que esta agotada.
const estadoPath = path.join(__dirname, '..', 'gemini-key-state.json');

function leerIndiceGuardado() {
  try {
    const data = JSON.parse(fs.readFileSync(estadoPath, 'utf-8'));
    return Number.isInteger(data.indice) ? data.indice : 0;
  } catch {
    return 0;
  }
}

function guardarIndice(indice) {
  try {
    fs.writeFileSync(estadoPath, JSON.stringify({ indice }, null, 2));
  } catch {
    // si no se pudo guardar, no pasa nada grave: solo se perdera el "recuerdo" al reiniciar
  }
}

let indiceActual = leerIndiceGuardado();

function requireApiKeys() {
  const claves = getApiKeys('gemini');
  if (!claves.length) {
    const err = new Error('NO_API_KEY');
    err.code = 'NO_API_KEY';
    throw err;
  }
  return claves;
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Errores pasajeros del servidor de Gemini: vale la pena reintentar con la MISMA clave
function esErrorTemporal(mensaje = '') {
  const m = mensaje.toLowerCase();
  return m.includes('high demand') || m.includes('overloaded') || m.includes('unavailable') || m.includes('503');
}

// Errores que indican que ESTA clave especifica ya no sirve (sin cuota, invalida, bloqueada):
// aqui no tiene sentido reintentar con la misma, hay que pasar a la siguiente clave.
function esErrorDeClave(mensaje = '') {
  const m = mensaje.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('quota') ||
    m.includes('resource_exhausted') ||
    m.includes('rate limit') ||
    m.includes('api key not valid') ||
    m.includes('api_key_invalid') ||
    m.includes('permission_denied') ||
    m.includes('unregistered_callers') ||
    m.includes('403')
  );
}

async function llamarModelo(modelo, body, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message || 'Error desconocido de la API de Gemini');
    err.temporal = esErrorTemporal(err.message);
    err.errorDeClave = esErrorDeClave(err.message);
    throw err;
  }

  const texto = data?.candidates?.[0]?.content?.parts
    ?.map(p => p.text)
    .filter(Boolean)
    .join('\n');

  if (!texto) {
    const razon = data?.candidates?.[0]?.finishReason;
    throw new Error(razon ? `La API no devolvio texto (motivo: ${razon})` : 'La API no devolvio texto.');
  }

  return texto;
}

// Ejecuta `intentar(apiKey)` probando todas las claves de Gemini guardadas, en orden,
// empezando por la ultima que funciono. Si una clave falla por cuota/invalida, pasa
// automaticamente a la siguiente sin que el usuario note nada.
async function conRotacionDeClaves(intentar) {
  const claves = requireApiKeys();
  let ultimoError;

  for (let vueltas = 0; vueltas < claves.length; vueltas++) {
    const indice = (indiceActual + vueltas) % claves.length;
    const apiKey = claves[indice];

    try {
      const resultado = await intentar(apiKey);
      if (indice !== indiceActual) {
        indiceActual = indice;
        guardarIndice(indiceActual);
      }
      return resultado;
    } catch (err) {
      ultimoError = err;
      if (err.errorDeClave) {
        continue; // esta clave ya no sirve por ahora, probamos la siguiente
      }
      throw err; // error que no tiene que ver con la clave (ej: prompt bloqueado)
    }
  }

  // Todas las claves fallaron por cuota/invalidas
  const errFinal = new Error(
    ultimoError ? `Todas las claves de Gemini fallaron. Ultimo error: ${ultimoError.message}` : 'No se pudo obtener respuesta con ninguna clave de Gemini.'
  );
  errFinal.todasLasClavesFallaron = true;
  throw errFinal;
}

async function conReintentos(body) {
  return conRotacionDeClaves(async (apiKey) => {
    let ultimoError;
    for (const modelo of MODELOS_CHAT) {
      for (let intento = 1; intento <= 2; intento++) {
        try {
          return await llamarModelo(modelo, body, apiKey);
        } catch (err) {
          ultimoError = err;
          if (err.errorDeClave) throw err; // que lo maneje la rotacion de claves
          if (err.temporal && intento < 2) {
            await esperar(1500 * intento);
            continue;
          }
          break;
        }
      }
    }
    throw ultimoError || new Error('No se pudo obtener respuesta de ningun modelo.');
  });
}

async function generarTexto(prompt, { imagenBase64, mimeType } = {}) {
  const parts = [];
  if (imagenBase64) {
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imagenBase64 } });
  }
  parts.push({ text: prompt });

  return conReintentos({ contents: [{ parts }] });
}

async function chatConPersonalidad(systemInstruction, historial, mensajeNuevo) {
  const contents = [
    ...historial.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: mensajeNuevo }] }
  ];

  return conReintentos({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents
  });
}

async function llamarModeloImagen(modelo, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_modalities: ['TEXT', 'IMAGE'] }
    })
  });

  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message || 'Error desconocido de la API de Gemini');
    err.errorDeClave = esErrorDeClave(err.message);
    throw err;
  }

  const parte = data?.candidates?.[0]?.content?.parts?.find(p => p.inline_data || p.inlineData);
  const inline = parte?.inline_data || parte?.inlineData;

  if (!inline?.data) {
    throw new Error('La API no devolvio ninguna imagen. Intenta con otra descripcion.');
  }

  return Buffer.from(inline.data, 'base64');
}

async function generarImagen(prompt) {
  return conRotacionDeClaves(async (apiKey) => {
    let ultimoError;
    for (const modelo of MODELOS_IMAGEN) {
      try {
        return await llamarModeloImagen(modelo, prompt, apiKey);
      } catch (err) {
        ultimoError = err;
        // Si el modelo en si no tiene cuota (o esta clave no puede usarlo), probamos
        // el siguiente modelo de la lista antes de darnos por vencidos con esta clave.
        if (err.errorDeClave) continue;
        throw err;
      }
    }
    throw ultimoError || new Error('No se pudo generar la imagen con ningun modelo.');
  });
}

module.exports = { generarTexto, generarImagen, chatConPersonalidad };
