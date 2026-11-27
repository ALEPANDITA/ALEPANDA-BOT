// Parche de WAProto para stickers con sonido: Message.soundStickerMessage (campo 134) y StickerMessage.audioMessage (campo 26).
// Se aplica dentro de node_modules; es seguro correrlo varias veces. Uso: node scripts/parche-sticker-sonido.js [ruta/a/WAProto/index.js]
const fs = require('fs');
const path = require('path');

const MARCA = 'PARCHE-SONIDO-STICKER';
const candidatos = [
  process.argv[2],
  path.join(__dirname, '..', 'node_modules', '@whiskeysockets', 'baileys', 'WAProto', 'index.js'),
  path.join(__dirname, '..', 'node_modules', 'baileys', 'WAProto', 'index.js')
].filter(Boolean);
const destino = candidatos.find((p) => fs.existsSync(p));
if (!destino) { console.log('[sticker-sonido] No encontre WAProto/index.js de baileys. No hice nada.'); process.exit(0); }

let s = fs.readFileSync(destino, 'utf8');
if (s.includes(MARCA)) { console.log('[sticker-sonido] Ya estaba parchado:', destino); process.exit(0); }

const falla = (msg) => { console.log('[sticker-sonido] ERROR:', msg, '-> no toque nada.'); process.exit(1); };
const unica = (txt, anchor, nombre) => { const n = txt.split(anchor).length - 1; if (n !== 1) falla(`${nombre} aparece ${n} veces (se esperaba 1)`); };
const poner = (txt, anchor, nuevo, nombre, antes) => { unica(txt, anchor, nombre); return txt.replace(anchor, () => (antes ? nuevo + anchor : anchor + nuevo)); };

// ---------- clase Message (soundStickerMessage = campo 134, FutureProofMessage) ----------
s = poner(s, 'Message.prototype.pollResultSnapshotMessageV3 = null;', '\n        Message.prototype.soundStickerMessage = null; // ' + MARCA, 'Message.prototype');
s = poner(s, '$root.proto.Message.PollResultSnapshotMessage.encode(m.pollResultSnapshotMessageV3, w.uint32(914).fork()).ldelim();',
  '\n            if (m.soundStickerMessage != null && Object.hasOwnProperty.call(m, "soundStickerMessage"))\n                $root.proto.Message.FutureProofMessage.encode(m.soundStickerMessage, w.uint32(1074).fork()).ldelim();', 'Message.encode');
s = poner(s, 'case 114: {\n                        m.pollResultSnapshotMessageV3 = $root.proto.Message.PollResultSnapshotMessage.decode(r, r.uint32());\n                        break;\n                    }',
  '\n                case 134: {\n                        m.soundStickerMessage = $root.proto.Message.FutureProofMessage.decode(r, r.uint32());\n                        break;\n                    }', 'Message.decode');
s = poner(s, 'm.pollResultSnapshotMessageV3 = $root.proto.Message.PollResultSnapshotMessage.fromObject(d.pollResultSnapshotMessageV3);\n            }',
  '\n            if (d.soundStickerMessage != null) {\n                if (typeof d.soundStickerMessage !== "object")\n                    throw TypeError(".proto.Message.soundStickerMessage: object expected");\n                m.soundStickerMessage = $root.proto.Message.FutureProofMessage.fromObject(d.soundStickerMessage);\n            }', 'Message.fromObject');

// toObject de Message: se agrega justo despues del bloque de pollResultSnapshotMessageV3
{
  const re = /^( *)if \(m\.pollResultSnapshotMessageV3 != null && m\.hasOwnProperty\("pollResultSnapshotMessageV3"\)\) \{[\s\S]*?\n\1\}\n/m;
  const trozo = s.match(re);
  if (!trozo) falla('Message.toObject');
  const sg = trozo[1];
  s = s.replace(re, (m) => m + sg + 'if (m.soundStickerMessage != null && m.hasOwnProperty("soundStickerMessage")) {\n' + sg + '    d.soundStickerMessage = $root.proto.Message.FutureProofMessage.toObject(m.soundStickerMessage, o);\n' + sg + '}\n');
}

// ---------- clase StickerMessage (audioMessage = campo 26) ----------
const ini = s.indexOf('Message.StickerMessage = (function() {');
const fin = ini < 0 ? -1 : s.indexOf('return StickerMessage;', ini);
if (ini < 0 || fin < 0) falla('no encontre la clase StickerMessage');
let bloque = s.slice(ini, fin);

bloque = poner(bloque, 'StickerMessage.prototype.mediaKeyDomain = null;', '\n            StickerMessage.prototype.audioMessage = null; // ' + MARCA, 'StickerMessage.prototype');
bloque = poner(bloque, 'w.uint32(184).int32(m.mediaKeyDomain);',
  '\n                if (m.audioMessage != null && Object.hasOwnProperty.call(m, "audioMessage"))\n                    $root.proto.Message.AudioMessage.encode(m.audioMessage, w.uint32(210).fork()).ldelim();', 'StickerMessage.encode');

{ // decode: antes del primer "default:" despues de StickerMessage.decode
  const d0 = bloque.indexOf('StickerMessage.decode = function decode');
  const d1 = bloque.indexOf('default:', d0);
  if (d0 < 0 || d1 < 0) falla('StickerMessage.decode');
  const linea = bloque.lastIndexOf('\n', d1) + 1;
  const sangria = bloque.slice(linea, d1);
  bloque = bloque.slice(0, linea) + sangria + 'case 26: {\n' + sangria + '        m.audioMessage = $root.proto.Message.AudioMessage.decode(r, r.uint32());\n' + sangria + '        break;\n' + sangria + '    }\n' + bloque.slice(linea);
}
{ // fromObject: antes del "return m;" que cierra la funcion
  const f0 = bloque.indexOf('StickerMessage.fromObject = function fromObject');
  const f1 = bloque.indexOf('return m;', f0);
  if (f0 < 0 || f1 < 0) falla('StickerMessage.fromObject');
  bloque = bloque.slice(0, f1) + 'if (d.audioMessage != null) {\n                    if (typeof d.audioMessage !== "object")\n                        throw TypeError(".proto.Message.StickerMessage.audioMessage: object expected");\n                    m.audioMessage = $root.proto.Message.AudioMessage.fromObject(d.audioMessage);\n                }\n                ' + bloque.slice(f1);
}
{ // toObject: antes del "return d;" que cierra la funcion
  const t0 = bloque.indexOf('StickerMessage.toObject = function toObject');
  const t1 = bloque.indexOf('return d;', t0);
  if (t0 < 0 || t1 < 0) falla('StickerMessage.toObject');
  bloque = bloque.slice(0, t1) + 'if (m.audioMessage != null && m.hasOwnProperty("audioMessage")) {\n                    d.audioMessage = $root.proto.Message.AudioMessage.toObject(m.audioMessage, o);\n                }\n                ' + bloque.slice(t1);
}
s = s.slice(0, ini) + bloque + s.slice(fin);

fs.copyFileSync(destino, destino + '.antes-sticker-sonido');
fs.writeFileSync(destino, s);
console.log('[sticker-sonido] Parche aplicado en:', destino);
