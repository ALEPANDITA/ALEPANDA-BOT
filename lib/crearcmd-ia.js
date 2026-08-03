// lib/crearcmd-ia.js
// Arma el prompt que se le manda a la IA (Gemini -> Groq -> OpenRouter, via
// generarTexto en lib/gemini.js, que ya trae esa cascada) para que redacte un
// comando nuevo del bot, y limpia la respuesta para quedarnos solo con codigo.

const EJEMPLO_1 = `module.exports = {
  name: 'mediafire',
  category: 'download',
  description: 'Descarga un archivo de Mediafire (ej: .mediafire <link>)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'mediafire ').length).trim();
    if (!url) {
      return sock.sendMessage(jid, { text: \`Uso: \${prefix}mediafire <link>\` });
    }
    try {
      const res = await fetch(url);
      // ... procesar respuesta y mandar el archivo ...
      await sock.sendMessage(jid, { document: { url: 'https://...' }, fileName: 'archivo', mimetype: 'application/octet-stream' });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el archivo.' });
    }
  }
};`;

const EJEMPLO_2 = `const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'pindl',
  aliases: ['pdl'],
  category: 'download',
  description: 'Descarga un pin de Pinterest. Uso: .pindl <link>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const input = texto.trim().split(/\\s+/).slice(1).join(' ').trim();
    if (!input) {
      return sock.sendMessage(jid, { text: advertencia(\`Uso: \${prefix}pindl <link>\`, { titulo: 'FALTA INFORMACION' }) });
    }
    try {
      // ... llamar al endpoint / API ...
    } catch (err) {
      await sock.sendMessage(jid, { text: cajaError('No se pudo descargar: ' + err.message) });
    }
  }
};`;

const REGLAS = `Reglas OBLIGATORIAS del proyecto (bot de WhatsApp con Node.js y Baileys):

1. El archivo debe hacer "module.exports = { ... }" con un objeto (o un arreglo de objetos si son varios comandos relacionados). Cada objeto necesita como minimo:
   - name: string, minusculas, sin espacios (ej: 'descargarx')
   - execute: async (sock, jid, msg, ctx) => { ... }
   Opcionalmente: aliases (array de strings), category (string, minusculas, ej: 'download', 'tools', 'fun'), description (string corta explicando el uso con el prefijo).

2. ctx (cuarto argumento de execute) trae, entre otras cosas: { prefix, texto, comandos }. "texto" es el mensaje completo tal cual lo escribio el usuario (incluye el prefijo y el nombre del comando), hay que parsear los argumentos con .split(/\\s+/) o .slice(...).

3. Para responder se usa siempre sock.sendMessage(jid, { text: '...' }) o, para archivos: sock.sendMessage(jid, { document: { url } o Buffer, fileName, mimetype }). Para audio/imagen/video usar { audio }, { image }, { video } igual con url o Buffer.

4. Fetch a APIs/endpoints: usar el fetch global de Node (ya disponible, NO hacer require('node-fetch')). Siempre envolver en try/catch y responder algo claro al usuario si falla, nunca dejar que el error tumbe el proceso.

5. NO uses process.exit, NO bucles infinitos ni sincronos pesados, NO leer/escribir archivos fuera de lo estrictamente necesario, NO ejecutar comandos de shell (child_process), NO instalar paquetes nuevos (solo lo que ya viene con Node: fetch, fs, path, etc).

6. Si el comando necesita una API key guardada por el owner, se puede leer con: const { getApiKey } = require('../../lib/apikeys'); const key = getApiKey('nombreDelServicio');

7. Para mensajes con formato/estilo del bot (opcional) existe: const { caja, exito, error: cajaError, advertencia, cargando } = require('../../lib/estilo');

8. Devuelve UNICAMENTE el codigo JavaScript final, sin explicaciones antes o despues, sin comentarios de markdown, sin \`\`\`. Si necesitas explicar algo, hazlo como comentario // dentro del propio codigo.

Dos ejemplos reales de comandos ya usados en este bot, para que sigas el mismo estilo:

--- ejemplo 1 ---
${EJEMPLO_1}

--- ejemplo 2 ---
${EJEMPLO_2}`;

function construirPromptNuevo(descripcionUsuario) {
  return `${REGLAS}

Ahora escribe un comando NUEVO para este bot segun la siguiente descripcion que dio el owner (puede incluir un endpoint/API a usar, el nombre que quiere, la categoria, ejemplos de uso, etc. Usa tu criterio para lo que no se especifique, como el "name" si no lo dieron, basado en la descripcion):

"""
${descripcionUsuario}
"""

Responde solo con el codigo del archivo .js final.`;
}

function construirPromptArreglo({ descripcionOriginal, codigoAnterior, errorAnterior, aclaracionUsuario }) {
  return `${REGLAS}

Ya habias escrito un comando para este bot, pero fallo al instalarlo (o el owner reporto que no funciona bien). Aqui esta todo el contexto para que lo corrijas:

Descripcion original del comando:
"""
${descripcionOriginal}
"""

Codigo que escribiste antes:
"""
${codigoAnterior}
"""

Error o problema reportado (puede ser un error tecnico de validacion, o una descripcion en palabras simples de lo que el owner vio que fallaba):
"""
${errorAnterior}
${aclaracionUsuario ? '\nAclaracion adicional del owner:\n' + aclaracionUsuario : ''}
"""

Corrige el codigo para resolver ese problema, manteniendo el mismo "name" del comando salvo que el error indique claramente que debe cambiar. Responde solo con el codigo .js final completo y corregido (no un diff, no un fragmento: el archivo entero).`;
}

function construirPromptAdaptar(codigoOriginal, instruccionUsuario, categoriaForzada) {
  return `${REGLAS}

El owner subio un archivo .js que NO esta escrito para este bot (puede ser de otro bot, un script suelto, codigo de otro framework, etc). Tu trabajo es ADAPTARLO para que funcione en este bot, siguiendo las reglas de arriba, MANTENIENDO su funcionalidad principal (que hace, que API/logica usa) pero reescribiendo la estructura (module.exports, name, execute(sock, jid, msg, ctx), como manda las respuestas, etc) para que encaje en este proyecto.

${categoriaForzada ? `El owner pidio que quede en la categoria: "${categoriaForzada}". Usa exactamente esa categoria en el campo "category".` : 'Elige una categoria razonable segun lo que hace el comando (ej: "fun", "download", "tools", "ia").'}
${instruccionUsuario ? `\nInstrucciones adicionales del owner sobre como adaptarlo:\n"""\n${instruccionUsuario}\n"""\n` : ''}

Codigo original a adaptar:
"""
${codigoOriginal}
"""

Responde solo con el codigo .js final ya adaptado a este bot.`;
}

function limpiarCodigo(textoCrudo) {
  let codigo = String(textoCrudo || '').trim();

  // Quita fences de markdown si la IA los agrego a pesar de la instruccion.
  const matchFence = codigo.match(/^```(?:js|javascript)?\s*([\s\S]*?)```$/i);
  if (matchFence) {
    codigo = matchFence[1].trim();
  } else {
    codigo = codigo.replace(/^```(?:js|javascript)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  codigo = normalizarCaracteresRaros(codigo);

  return codigo;
}

// Las IAs a veces meten caracteres Unicode "parecidos" a los normales (comillas
// tipograficas, acentos sueltos que se ven como backtick, espacios especiales,
// guiones largos) que en pantalla se ven identicos a los de siempre pero para
// Node son un caracter totalmente distinto -> rompen la sintaxis con errores
// confusos tipo "Unexpected identifier" justo donde todo se ve bien a simple
// vista. Esto los reemplaza por su equivalente ASCII normal.
function normalizarCaracteresRaros(codigo) {
  return codigo
    // acentos/marcas "parecidas" a backtick -> backtick real (abre/cierra template literals)
    .replace(/[\u02CB\u00B4\u2032\u2035]/g, '`')
    // comillas simples tipograficas -> apostrofe normal (NO a backtick, para no romper strings normales)
    .replace(/[\u2018\u2019\u02BB\u02BC]/g, "'")
    // comillas dobles tipograficas -> comilla doble normal
    .replace(/[\u201C\u201D]/g, '"')
    // guion largo/medio -> guion normal
    .replace(/[\u2013\u2014]/g, '-')
    // espacio de no separacion -> espacio normal
    .replace(/\u00A0/g, ' ')
    // caracteres invisibles (zero-width space, BOM) -> se eliminan
    .replace(/[\u200B\uFEFF]/g, '');
}

module.exports = { construirPromptNuevo, construirPromptArreglo, construirPromptAdaptar, limpiarCodigo };
