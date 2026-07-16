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

function construirTexto(plantilla, { numero, metadata, sock, prefix }) {
  const numerobot = (sock.user?.id || '').split(':')[0].split('@')[0];
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return String(plantilla)
    .replace(/#hora#/g, hora)
    .replace(/#namegp#/g, metadata.subject || '')
    .replace(/#numberuser#/g, `@${numero}`)
    .replace(/#numerobot#/g, numerobot)
    .replace(/#prefijo#/g, prefix)
    .replace(/#decgrupo#/g, metadata.desc || '')
    .replace(/\{user\}/g, `@${numero}`)
    .replace(/\{group\}/g, metadata.subject || '')
    .replace(/\{desc\}/g, metadata.desc || '');
}

function obtenerMediaGuardada(tipo, jid, grupo) {
  const ruta = rutaMedia(tipo, jid);
  const tipoMedia = (tipo === 'welcome' ? grupo.welcomeMediaType : grupo.byeMediaType) || 'texto';

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

module.exports = { construirTexto, obtenerMediaGuardada, construirPayloadEnvio };
