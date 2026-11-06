const { leerConfig } = require('../../lib/config');
const { leerKeys } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');
const { probarClave } = require('../../lib/gemini');
const { caja, advertencia } = require('../../lib/estilo');

// Modelos que usa el bot en cada proveedor (si los cambias en lib/gemini.js, cambialos aqui tambien)
const MODELO_GROQ = 'llama-3.3-70b-versatile';
const MODELO_OPENROUTER = 'deepseek/deepseek-v3.2';
const MODELO_NVIDIA = 'meta/llama-3.3-70b-instruct';
const TIMEOUT_MS = 20000;

function verClave(clave) {
  return clave ? `${clave.slice(0, 4)}${'*'.repeat(Math.max(Math.min(clave.length - 4, 8), 0))}` : '';
}

function cortar(texto, max = 90) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// Prueba un proveedor con formato OpenAI (Groq, OpenRouter, NVIDIA) con una peticion minima
async function probarEstiloOpenAI(url, apiKey, modelo) {
  const inicio = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelo, messages: [{ role: 'user', content: 'hola' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && !data.error && Array.isArray(data.choices)) {
      return { estado: 'ok', ms: Date.now() - inicio };
    }

    const mensaje = data?.error?.message || data?.detail || data?.message || `HTTP ${res.status}`;
    const m = String(mensaje).toLowerCase();
    if (res.status === 429 || m.includes('rate limit') || m.includes('quota')) return { estado: 'cupo', mensaje };
    if (res.status === 401 || res.status === 403) return { estado: 'invalida', mensaje };
    if (res.status === 402) return { estado: 'credito', mensaje };
    if (res.status === 404) return { estado: 'modelo', mensaje };
    return { estado: 'error', mensaje };
  } catch (err) {
    const causa = err?.name === 'TimeoutError' ? 'tardo demasiado en responder' : (err?.cause?.code || err?.message || 'error de red');
    return { estado: 'red', mensaje: causa };
  }
}

// Prueba varios modelos en orden hasta que uno responda (igual que hace el bot)
async function probarConModelos(url, apiKey, modelos) {
  let ultimo;
  for (const modelo of modelos) {
    const r = await probarEstiloOpenAI(url, apiKey, modelo);
    ultimo = { ...r, modelo };
    if (r.estado === 'ok') return ultimo;
    const modeloRetirado = r.estado === 'modelo' || /end of life|does not exist|do not have access|deprecat|decommission|not found/i.test(String(r.mensaje));
    if (!modeloRetirado) return ultimo;
  }
  return ultimo;
}

async function probarGemini(clave) {
  const r = await probarClave(clave);
  if (r.ok) return { estado: 'ok', ms: r.ms };
  if (r.esCuota) return { estado: 'cupo', mensaje: r.esperaSegundos ? `espera ~${r.esperaSegundos}s` : 'puede ser cupo diario, se libera despues' };
  if (r.esTemporal) return { estado: 'saturado', mensaje: r.mensaje };
  return { estado: 'invalida', mensaje: r.mensaje };
}

const PROVEEDORES_IA = [
  { servicio: 'gemini', probar: (k) => probarGemini(k) },
  { servicio: 'groq', probar: (k) => probarConModelos('https://api.groq.com/openai/v1/chat/completions', k, ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant']) },
  { servicio: 'openrouter', probar: (k) => probarEstiloOpenAI('https://openrouter.ai/api/v1/chat/completions', k, MODELO_OPENROUTER) },
  { servicio: 'nvidia', probar: (k) => probarConModelos('https://integrate.api.nvidia.com/v1/chat/completions', k, ['google/gemma-4-31b-it', 'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3.5-lightning-30b-a3b']) }
];

// Servicios con clave que no se pueden probar sin gastar un uso real
const SERVICIOS_SIN_PRUEBA = ['tiktok', 'mediafire', 'pinterest', 'facebook', 'instagram', 'ytmp3', 'ytmp4', 'dvyer', 'evogb', 'audd', 'sightengine_user', 'sightengine_secret'];

function describir(r) {
  switch (r.estado) {
    case 'ok': return `✅ Funciona (${r.ms}ms${r.modelo ? ', ' + r.modelo : ''})`;
    case 'cupo': return `⏳ Sin cupo ahora (${cortar(r.mensaje, 60)})`;
    case 'saturado': return '🟡 Google saturado, no es culpa de la clave';
    case 'invalida': return `❌ Clave invalida o bloqueada: ${cortar(r.mensaje)}`;
    case 'credito': return `💸 Sin creditos: ${cortar(r.mensaje)}`;
    case 'modelo': return `⚠️ Modelo no disponible: ${cortar(r.mensaje)}`;
    case 'red': return `🌐 Sin conexion: ${cortar(r.mensaje)}`;
    default: return `❌ Fallo: ${cortar(r.mensaje)}`;
  }
}

async function probarDvyer() {
  try {
    const res = await fetch('https://dv-yer-api.online', { signal: AbortSignal.timeout(8000) });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, mensaje: err?.cause?.code || err?.message || 'sin respuesta' };
  }
}

async function probarYoutube() {
  let ytd;
  try { ytd = require('../../lib/ytdirecto'); } catch (_) { return null; }
  if (typeof ytd.probar !== 'function') return null;
  const inicio = Date.now();
  try {
    const titulo = await ytd.probar();
    return { ok: true, ms: Date.now() - inicio, titulo };
  } catch (err) {
    return { ok: false, mensaje: err.message };
  }
}

module.exports = {
  name: 'apistatustest',
  category: 'owner',
  description: 'Prueba EN VIVO todas las APIs (Gemini, Groq, OpenRouter, NVIDIA, YouTube) y marca cuales funcionan (solo owner).',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    await sock.sendMessage(jid, { react: { text: '🔬', key: msg.key } });
    await sock.sendMessage(jid, { text: 'Probando todas las APIs en vivo, espera un momento (puede tardar hasta ~30 segundos)...' }, { quoted: msg });

    const keys = leerKeys();
    const tareas = [];
    for (const prov of PROVEEDORES_IA) {
      const claves = Array.isArray(keys[prov.servicio]) ? keys[prov.servicio] : [];
      claves.forEach((clave, i) => {
        tareas.push(prov.probar(clave).then((r) => ({ servicio: prov.servicio, i, clave, r })));
      });
    }

    const [resultados, dvyer, youtube] = await Promise.all([
      Promise.all(tareas),
      probarDvyer(),
      probarYoutube()
    ]);

    const lineas = [];
    const resumen = [];

    lineas.push('🤖 *IA (chat)*  orden: gemini > groq > nvidia > openrouter');
    for (const prov of PROVEEDORES_IA) {
      const claves = Array.isArray(keys[prov.servicio]) ? keys[prov.servicio] : [];
      if (!claves.length) {
        lineas.push(`${prov.servicio}: 🔴 sin clave guardada`);
        continue;
      }
      const delServicio = resultados.filter((x) => x.servicio === prov.servicio);
      const buenas = delServicio.filter((x) => x.r.estado === 'ok').length;
      resumen.push(`${prov.servicio} ${buenas}/${claves.length}`);
      lineas.push(`${prov.servicio}: ${buenas}/${claves.length} funcionando`);
      for (const x of delServicio) {
        lineas.push(`   ${x.i + 1}. ${verClave(x.clave)} ${describir(x.r)}`);
      }
    }

    lineas.push('', '🎬 *Descargas*');
    if (youtube === null) {
      lineas.push('YouTube (yt-dlp): sin prueba disponible (falta el parche de ytdirecto)');
    } else if (youtube.ok) {
      lineas.push(`YouTube (yt-dlp): ✅ Funciona (${youtube.ms}ms)`);
    } else {
      lineas.push(`YouTube (yt-dlp): ❌ ${cortar(youtube.mensaje, 120)}`);
    }
    lineas.push(dvyer.ok
      ? `dv-yer-api.online: ✅ El servidor responde (HTTP ${dvyer.status})`
      : `dv-yer-api.online: ❌ No responde (${dvyer.mensaje})`);

    const guardadas = SERVICIOS_SIN_PRUEBA.filter((s) => Array.isArray(keys[s]) && keys[s].length > 0 && s !== 'dvyer');
    if (guardadas.length) {
      lineas.push('', '🔑 *Con clave, sin prueba automatica*', `${guardadas.join(', ')}`);
    }

    const hayIa = resultados.some((x) => x.r.estado === 'ok');
    await sock.sendMessage(jid, {
      text: caja(lineas, {
        titulo: 'PRUEBA DE APIs',
        pie: resumen.length ? resumen.join(' | ') : 'sin claves de IA guardadas',
        estilo: 'neon'
      })
    });
    await sock.sendMessage(jid, { react: { text: hayIa ? '✅' : '❌', key: msg.key } });
  }
};
