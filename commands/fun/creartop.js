// commands/fun/creartop.js
// .creartop <nombre> <cantidad>  -> crea un top con usuarios random del grupo
// .topsver                       -> lista los tops del grupo
// .topsver <nombre>              -> muestra los usuarios de ese top
//
// Cada top se renueva a las HORAS_RENOVACION horas, pero SOLO cuando alguien lo
// revisa (o intenta crearlo de nuevo) despues de ese tiempo. Un usuario que salio
// en una ronda no vuelve a salir en las siguientes 2 rondas (escalera); despues
// ya puede volver a aparecer. Si el grupo es chico y no alcanzan usuarios nuevos,
// se completan primero con los que salieron hace mas tiempo.

const fs = require('fs');
const path = require('path');
const { caja, error: cajaError } = require('../../lib/estilo');

const ARCHIVO = path.join(__dirname, '..', '..', 'tops-data.json');
const HORAS_RENOVACION = 12;      // cada cuantas horas se puede renovar un top
const RONDAS_SIN_REPETIR = 2;     // rondas que se recuerdan para no repetir usuarios
const MAX_TOPS_POR_GRUPO = 15;
const MAX_CANTIDAD = 20;
const MAX_NOMBRE = 30;

// ---------- Almacenamiento ----------
function leer() {
  if (!fs.existsSync(ARCHIVO)) return {};
  try {
    const d = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  } catch (_) {
    try { fs.renameSync(ARCHIVO, ARCHIVO + '.bak-corrupto-' + Date.now()); } catch (_) {}
    return {};
  }
}

function guardar(datos) {
  const tmp = ARCHIVO + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2));
  fs.renameSync(tmp, ARCHIVO);
}

// ---------- Utilidades ----------
function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function limpiarNombre(raw) {
  const n = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/@\S+/g, ' ')
    .replace(/\*|_|~|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOMBRE)
    .trim();
  if (!n || /https?:\/\/|www\./i.test(n)) return '';
  return n;
}

function mayusculaInicial(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function numeroDe(id) {
  return String(id || '').split('@')[0].split(':')[0];
}

function barajar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tiempoRestante(ms) {
  if (ms <= 0) return 'ya se puede renovar';
  const min = Math.ceil(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function candidatosDelGrupo(sock, jid) {
  const metadata = await sock.groupMetadata(jid);
  const bot = new Set([sock.user?.id, sock.user?.lid].filter(Boolean).map(numeroDe));
  const vistos = new Set();
  const lista = [];
  for (const p of metadata.participants || []) {
    const id = p.id;
    if (!id || id.includes('status@broadcast')) continue;
    if (bot.has(numeroDe(id))) continue;
    if (vistos.has(id)) continue;
    vistos.add(id);
    lista.push(id);
  }
  return lista;
}

// Escalera: primero los que NO salieron en las ultimas rondas; si no alcanzan,
// se completa con los que salieron hace mas tiempo (nunca con los mas recientes antes).
function elegir(candidatos, cantidad, historial) {
  const ultimaRonda = new Map();
  historial.forEach((ronda, i) => ronda.forEach((id) => ultimaRonda.set(id, i)));

  const niveles = new Map();
  for (const id of barajar(candidatos)) {
    const nivel = ultimaRonda.has(id) ? ultimaRonda.get(id) : -1;
    if (!niveles.has(nivel)) niveles.set(nivel, []);
    niveles.get(nivel).push(id);
  }

  const ordenados = [...niveles.keys()].sort((a, b) => a - b).flatMap((k) => niveles.get(k));
  return barajar(ordenados.slice(0, cantidad));
}

async function renovarSiToca(sock, jid, top) {
  if (Date.now() < top.expira) return false;
  const candidatos = await candidatosDelGrupo(sock, jid);
  if (!candidatos.length) return false;
  top.historial = [...(top.historial || []), top.actual].slice(-RONDAS_SIN_REPETIR);
  top.actual = elegir(candidatos, top.cantidad, top.historial);
  top.expira = Date.now() + HORAS_RENOVACION * 3600 * 1000;
  top.ronda = (top.ronda || 1) + 1;
  return true;
}

const LINEA = '━━━━━━━━━━━━━━━━━━━━━';
const MEDALLAS = ['🥇', '🥈', '🥉'];
const NUMEROS = ['4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const EMOJIS_TEMA = [
  [/guap|bonit|lind|hermos|sexy/, '😎'],
  [/\bfe[oa]s?\b|feisim/, '👹'],
  [/mens|tont|burr|lent|bobo/, '🤡'],
  [/gracios|chist|payas/, '😂'],
  [/flojo|vag|dormil/, '😴'],
  [/inteligent|list[oa]|cerebr|genio/, '🧠'],
  [/rico|millonar|ricach/, '💰'],
  [/gamer|jugador/, '🎮'],
  [/pesad|molest|fastidi/, '😤'],
  [/amor|enamor|cursi/, '💘'],
  [/chism/, '🗣️']
];

function emojiDelTop(nombre) {
  const n = normalizar(nombre);
  for (const [re, emoji] of EMOJIS_TEMA) if (re.test(n)) return emoji;
  return '🏆';
}

function iconoPuesto(i) {
  if (i < 3) return MEDALLAS[i];
  if (i - 3 < NUMEROS.length) return NUMEROS[i - 3];
  return `${i + 1}.`;
}

function armarMensaje(top, nota) {
  const e = emojiDelTop(top.nombre);
  const puestos = top.actual.map((id, i) => `${iconoPuesto(i)} @${numeroDe(id)}${i === 0 ? ' 👑' : ''}`);
  const lineas = [
    LINEA,
    `${e} *TOP ${top.nombre.toUpperCase()}* ${e}`,
    LINEA,
    '',
    ...puestos,
    '',
    LINEA,
    `👥 ${top.actual.length} elegido(s)  •  🔁 Ronda ${top.ronda || 1}`,
    `⏳ Se renueva en ${tiempoRestante(top.expira - Date.now())}`
  ];
  if (nota) lineas.push('', nota);
  lineas.push('', '🐼 _ALEPANDA BOT_');
  return { text: lineas.join('\n'), mentions: top.actual };
}

function buscarTop(grupo, texto) {
  const k = normalizar(texto);
  if (!k) return null;
  if (grupo[k]) return grupo[k];
  const parecidos = Object.keys(grupo).filter((x) => x.startsWith(k) || x.includes(k));
  return parecidos.length === 1 ? grupo[parecidos[0]] : null;
}

function argumentos(texto) {
  return String(texto || '').trim().split(/\s+/).slice(1);
}

// ---------- Comandos ----------
const creartop = {
  name: 'creartop',
  category: 'fun',
  description: 'Crea un top con usuarios random del grupo. Ej: .creartop guapos 5',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = argumentos(texto);
    const ultimo = partes[partes.length - 1];

    if (partes.length < 2 || !/^\d+$/.test(ultimo)) {
      return sock.sendMessage(jid, {
        text: cajaError(`Uso: ${prefix}creartop <nombre> <cantidad>\nEjemplo: ${prefix}creartop guapos 5`)
      }, { quoted: msg });
    }

    const cantidad = parseInt(ultimo, 10);
    if (cantidad < 1 || cantidad > MAX_CANTIDAD) {
      return sock.sendMessage(jid, { text: cajaError(`La cantidad debe ser de 1 a ${MAX_CANTIDAD}.`) }, { quoted: msg });
    }

    const nombre = limpiarNombre(partes.slice(0, -1).join(' '));
    const clave = normalizar(nombre);
    if (!clave) {
      return sock.sendMessage(jid, { text: cajaError('Ese nombre no es valido. Usa solo texto, sin links.') }, { quoted: msg });
    }

    try {
      const datos = leer();
      if (!datos[jid]) datos[jid] = {};
      const grupo = datos[jid];

      // Si ya existe, no se duplica: se muestra (y se renueva si ya toca)
      if (grupo[clave]) {
        const top = grupo[clave];
        const renovado = await renovarSiToca(sock, jid, top);
        guardar(datos);
        const m = armarMensaje(top, renovado ? '♻️ Se renovo con nuevos usuarios' : `ℹ️ Ese top ya existe. Usa ${prefix}topsver ${top.nombre}`);
        return sock.sendMessage(jid, m, { quoted: msg });
      }

      if (Object.keys(grupo).length >= MAX_TOPS_POR_GRUPO) {
        return sock.sendMessage(jid, { text: cajaError(`Ya hay ${MAX_TOPS_POR_GRUPO} tops en este grupo, es el maximo.`) }, { quoted: msg });
      }

      const candidatos = await candidatosDelGrupo(sock, jid);
      if (!candidatos.length) {
        return sock.sendMessage(jid, { text: cajaError('No encontre usuarios en el grupo para armar el top.') }, { quoted: msg });
      }

      const top = {
        nombre: mayusculaInicial(nombre),
        cantidad,
        creador: msg.key.participant || msg.key.remoteJid,
        creado: Date.now(),
        expira: Date.now() + HORAS_RENOVACION * 3600 * 1000,
        ronda: 1,
        actual: elegir(candidatos, cantidad, []),
        historial: []
      };
      grupo[clave] = top;
      guardar(datos);

      const nota = top.actual.length < cantidad ? `⚠️ Solo hay ${top.actual.length} usuarios disponibles en el grupo` : '';
      await sock.sendMessage(jid, armarMensaje(top, nota), { quoted: msg });
    } catch (err) {
      console.error('[creartop]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo crear el top, intenta de nuevo.') }, { quoted: msg });
    }
  }
};

const topsver = {
  name: 'topsver',
  category: 'fun',
  description: 'Lista los tops del grupo o muestra uno: .topsver / .topsver guapos',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const datos = leer();
      const grupo = datos[jid] || {};
      const claves = Object.keys(grupo);
      const consulta = argumentos(texto).join(' ');

      if (!claves.length) {
        return sock.sendMessage(jid, {
          text: cajaError(`Todavia no hay tops en este grupo.\nCrea uno con ${prefix}creartop <nombre> <cantidad>`)
        }, { quoted: msg });
      }

      if (!consulta) {
        const lineas = claves.map((k, i) => {
          const t = grupo[k];
          return `${emojiDelTop(t.nombre)} *${i + 1}. ${t.nombre}*  •  ${t.cantidad} ${t.cantidad === 1 ? 'usuario' : 'usuarios'}  •  ⏳ ${tiempoRestante(t.expira - Date.now())}`;
        });
        return sock.sendMessage(jid, {
          text: [
            LINEA,
            '📋 *TOPS DEL GRUPO* 📋',
            LINEA,
            '',
            ...lineas,
            '',
            LINEA,
            `👉 Usa *${prefix}topsver <nombre>* para ver uno`,
            `✨ Crea el tuyo con *${prefix}creartop <nombre> <cantidad>*`,
            '',
            '🐼 _ALEPANDA BOT_'
          ].join('\n')
        }, { quoted: msg });
      }

      const top = buscarTop(grupo, consulta);
      if (!top) {
        const lista = claves.map((k) => grupo[k].nombre).join(', ');
        return sock.sendMessage(jid, { text: cajaError(`No encontre ese top.\nTops disponibles: ${lista}`) }, { quoted: msg });
      }

      let renovado = false;
      try {
        renovado = await renovarSiToca(sock, jid, top);
        if (renovado) guardar(datos);
      } catch (e) {
        console.error('[topsver] no se pudo renovar:', e.message);
      }

      await sock.sendMessage(jid, armarMensaje(top, renovado ? '♻️ Se renovo con nuevos usuarios' : ''), { quoted: msg });
    } catch (err) {
      console.error('[topsver]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo mostrar el top, intenta de nuevo.') }, { quoted: msg });
    }
  }
};

module.exports = [creartop, topsver];
