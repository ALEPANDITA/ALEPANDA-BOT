const fs = require('fs');
const oldStr = "      const tieneLink = /(https?:\\/\\/|www\\.)\\S+/i.test(texto);\n      if (grupo.antilink && tieneLink) {\n        const metadata = await sock.groupMetadata(jid);\n        const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;\n        if (!esAdmin) {\n          await sock.sendMessage(jid, { delete: msg.key });\n          await sock.sendMessage(jid, { text: 'Enlace eliminado. El antilink esta activado.' });\n          return;\n        }\n      }\n    }";
const newStr = "      const tieneLink = /(https?:\\/\\/|www\\.)\\S+/i.test(texto);\n      if (grupo.antilink && tieneLink) {\n        const metadata = await sock.groupMetadata(jid);\n        const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;\n        if (!esAdmin) {\n          await sock.sendMessage(jid, { delete: msg.key });\n          await sock.sendMessage(jid, { text: 'Enlace eliminado. El antilink esta activado.' });\n          return;\n        }\n      }\n\n      // Simon vigila la conversacion del grupo y puede intervenir por su cuenta\n      // si detecta que la cosa se esta poniendo pesada, sin que nadie lo llame.\n      if (texto) {\n        const { registrarMensaje, evaluarIntervencionSimon } = require('./lib/simonWatcher');\n        const nombreParaSimon = msg.pushName || remitente.split('@')[0];\n        registrarMensaje(jid, nombreParaSimon, texto);\n        // Fire-and-forget: no bloquea el resto del manejo del mensaje (comandos, etc.)\n        evaluarIntervencionSimon(sock, jid).catch(err => {\n          console.error('Fallo el watcher de Simon:', err);\n        });\n      }\n    }";
const contenido = fs.readFileSync('index.js', 'utf8');
if (contenido.includes(newStr)) {
  console.log('index.js ya tenia el parche de Simon aplicado, no se toco nada.');
} else if (!contenido.includes(oldStr)) {
  console.error('No encontre el bloque esperado en index.js. No se modifico el archivo (puede que ya lo hayas editado a mano). Avisale a Claude.');
  process.exit(1);
} else {
  const actualizado = contenido.replace(oldStr, newStr);
  fs.writeFileSync('index.js', actualizado);
  console.log('index.js actualizado correctamente con el vigilante de Simon.');
}
