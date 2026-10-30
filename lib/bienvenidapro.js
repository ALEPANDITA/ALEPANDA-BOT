const fs = require('fs');
const path = require('path');

function carpetaMedia(tipo) {
  const carpeta = path.join(__dirname, '..', 'assets', tipo === 'welcome' ? 'bienvenida' : 'despedida');
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
  return carpeta;
}

function rutaMedia(tipo, jid) {
  return path.join(carpetaMedia(tipo), `${jid.replace('@g.us', '')}.media`);
}

// Admins del grupo listos para etiquetar (#admins# en el texto de bienvenida/despedida).
// Devuelve [{ jid, digitos }]. El texto "@digitos" tiene que usar los mismos digitos
// que el jid que se manda en "mentions", si no WhatsApp no lo toma como mencion.
function adminsParaEtiquetar(metadata, sock) {
  const miNumero = (sock?.user?.id || '').split(':')[0].split('@')[0];
  const miLid = (sock?.user?.lid || '').split(':')[0].split('@')[0];
  const vistos = new Set();
  const lista = [];
  for (const p of (metadata?.participants || [])) {
    if (!p.admin) continue;
    const esTelefono = (x) => String(x || '').endsWith('@s.whatsapp.net');
    const telefono = p.phoneNumber || (esTelefono(p.jid) ? p.jid : null) || (esTelefono(p.id) ? p.id : null);
    const jid = telefono
      ? `${String(telefono).split('@')[0].split(':')[0]}@s.whatsapp.net`
      : p.id;
    if (!jid) continue;
    const digitos = jid.split('@')[0];
    const suyos = [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).map((x) => String(x).split('@')[0].split(':')[0]);
    if (suyos.includes(miNumero) || (miLid && suyos.includes(miLid))) continue; // el propio bot no se etiqueta
    if (vistos.has(digitos) || suyos.some((x) => vistos.has(x))) continue;
    vistos.add(digitos);
    suyos.forEach((x) => vistos.add(x));
    lista.push({ jid, digitos });
  }
  return lista;
}

const REGEX_ADMINS = /#admins?#/gi;

// JIDs extra que hay que mandar en "mentions" cuando el texto lleva #admins#
function mencionesExtra(plantilla, metadata, sock) {
  if (!new RegExp(REGEX_ADMINS.source, 'i').test(String(plantilla))) return [];
  return adminsParaEtiquetar(metadata, sock).map((a) => a.jid);
}

function construirTexto(plantilla, { numero, metadata, sock, prefix, nombreConocido }) {
  const numerobot = (sock.user?.id || '').split(':')[0].split('@')[0];
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  // Si ya vimos escribir a esta persona antes (en cualquier chat), mostramos su
  // nombre de WhatsApp en texto visible ademas de la mencion -- WhatsApp solo
  // resuelve el "@numero" a un nombre bonito para quien tenga ese numero
  // guardado en SUS contactos, asi que sin esto la mayoria solo ve el numero.
  //
  // IMPORTANTE: el texto "@xxxxx" tiene que usar EXACTAMENTE los mismos
  // digitos que el JID que se manda en el array "mentions" para que WhatsApp
  // la reconozca como mencion real -- si no coinciden (o si ponemos un texto
  // fijo como "@usuario"), sale como texto plano sin funcionar. Cuando no se
  // pudo resolver un numero de telefono real, igual podemos mencionar
  // usando los digitos del LID (funciona igual para WhatsApp, el nombre se
  // muestra bien del lado de quien tenga a esa persona guardada).
  const esLidSinResolver = String(numero).startsWith('lid-');
  const digitosMencion = esLidSinResolver ? String(numero).replace(/^lid-/, '') : numero;
  const etiquetaUsuario = nombreConocido
    ? (esLidSinResolver ? `*${nombreConocido}*` : `*${nombreConocido}* (@${digitosMencion})`)
    : `@${digitosMencion}`;

  const textoAdmins = adminsParaEtiquetar(metadata, sock).map((a) => `@${a.digitos}`).join(' ');

  return String(plantilla)
    .replace(REGEX_ADMINS, () => textoAdmins)
    .replace(/#hora#/g, hora)
    .replace(/#namegp#/g, metadata.subject || '')
    .replace(/#numberuser#/g, etiquetaUsuario)
    .replace(/#numerobot#/g, numerobot)
    .replace(/#prefijo#/g, prefix)
    .replace(/#decgrupo#/g, metadata.desc || '')
    .replace(/\{user\}/g, etiquetaUsuario)
    .replace(/\{group\}/g, metadata.subject || '')
    .replace(/\{desc\}/g, metadata.desc || '');
}

const { generarImagenEvento } = require('./bienvenidaImagen');

function conTimeout(promesa, ms, valorTimeout) {
  return new Promise((resolve) => {
    const temporizador = setTimeout(() => resolve(valorTimeout), ms);
    Promise.resolve(promesa).then(
      (valor) => { clearTimeout(temporizador); resolve(valor); },
      () => { clearTimeout(temporizador); resolve(valorTimeout); }
    );
  });
}

// Descarga con fetch nativo de Node (no depende de que "curl" este instalado
// en el servidor, a diferencia de la version anterior que lo llamaba como
// binario externo -- si el VPS no tenia curl, esto fallaba en silencio).
async function descargarImagen(url, timeoutMs = 2500) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controlador.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (!buffer.length) throw new Error('Descarga vacia');
    return buffer;
  } finally {
    clearTimeout(temporizador);
  }
}

async function obtenerFotoPerfilSegura(sock, participanteId) {
  try {
    const url = await conTimeout(sock.profilePictureUrl(participanteId, 'image'), 1500, null);
    if (!url) return null;
    return await descargarImagen(url, 2500);
  } catch (err) {
    console.error(`[bienvenida] No se pudo obtener la foto de perfil de ${participanteId}:`, err.message);
    return null;
  }
}

async function obtenerMediaGuardada(tipo, jid, grupo, contexto = {}) {
  const ruta = rutaMedia(tipo, jid);
  const tipoConfigurado = tipo === 'welcome' ? grupo.welcomeMediaType : grupo.byeMediaType;

  if (tipoConfigurado === undefined) {
    try {
      const buffer = await generarImagenEvento({
        tipo,
        fotoBuffer: contexto.fotoBuffer || null,
        nombreGrupo: contexto.nombreGrupo,
        totalMiembros: contexto.totalMiembros,
        numero: contexto.numero,
        nombreConocido: contexto.nombreConocido || null
      });
      return { buffer, tipoMedia: 'imagen' };
    } catch (err) {
      console.error('No se pudo generar la imagen de bienvenida/despedida, se usa el respaldo estatico:', err.message);
    }
  }

  const tipoMedia = tipoConfigurado || 'texto';

  if (tipoMedia === 'texto' || !fs.existsSync(ruta)) {
    return { buffer: null, tipoMedia: 'texto' };
  }

  return { buffer: fs.readFileSync(ruta), tipoMedia };
}

function construirPayloadEnvio(tipoMedia, buffer, texto) {
  switch (tipoMedia) {
    case 'imagen':
      return buffer ? { image: buffer, caption: texto } : { text: texto };
    case 'video':
      return buffer ? { video: buffer, caption: texto } : { text: texto };
    case 'gif':
      return buffer ? { video: buffer, caption: texto, gifPlayback: true } : { text: texto };
    case 'audio':
      return buffer ? { audio: buffer, mimetype: 'audio/mp4', ptt: false } : { text: texto };
    case 'sticker':
      return buffer ? { sticker: buffer } : { text: texto };
    default:
      return { text: texto };
  }
}

module.exports = { construirTexto, mencionesExtra, adminsParaEtiquetar, obtenerMediaGuardada, construirPayloadEnvio, obtenerFotoPerfilSegura, conTimeout };
