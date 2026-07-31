let limpiarTexto = (t) => t ? t.trim() : '';
try {
  const apiLib = require('../../../lib/dvyerapi');
  if (apiLib.limpiarTexto) limpiarTexto = apiLib.limpiarTexto;
} catch (e) {}

module.exports = {
  name: 'apkmod',
  category: 'download',
  description: 'Busca y descarga APKs modificados',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const rawText = texto.slice((prefix + 'apkmod').length);
    const query = limpiarTexto(rawText);

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}apkmod <nombre de la app>` }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: `🔍 Buscando *${query}*, un momento...` }, { quoted: msg });

    try {
      const apiKey = 'dvyer635784575156';
      const endpoint = `https://dv-yer-api.online/apkmoddl?q=${encodeURIComponent(query)}&pick=1&apikey=${apiKey}`;
      
      const res = await fetch(endpoint);

      // Manejo específico de errores HTTP del servidor externo
      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          return sock.sendMessage(jid, { 
            text: '⚠️ *Servidor de la API en mantenimiento o sobrecargado (Error 502).* \nIntenta de nuevo en unos minutos o prueba con otra búsqueda.' 
          }, { quoted: msg });
        }
        throw new Error(`HTTP Error: ${res.status}`);
      }
      
      const data = await res.json();

      const downloadUrl = data.dllink || data.download || data.url || data.link || 
                          data.result?.dllink || data.result?.download || data.result?.url;
                          
      const appName = data.title || data.name || data.appName || data.result?.title || query;
      
      const appIcon = data.icon || data.thumbnail || data.image || data.thumb || data.img || 
                      data.result?.icon || data.result?.thumbnail || data.result?.image;

      if (!downloadUrl) {
        return sock.sendMessage(jid, { 
          text: `⚠️ No se encontró un enlace directo de descarga en la API para esa búsqueda.` 
        }, { quoted: msg });
      }

      if (appIcon && typeof appIcon === 'string' && appIcon.startsWith('http')) {
        try {
          await sock.sendMessage(jid, {
            image: { url: appIcon },
            caption: `📱 *${appName}*\n\n⏳ Descargando y preparando el archivo APK...`
          }, { quoted: msg });
        } catch (imgErr) {
          console.warn('[apkmod] No se pudo enviar la miniatura:', imgErr.message);
        }
      }

      await sock.sendMessage(jid, {
        document: { url: downloadUrl },
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${appName.replace(/[^a-zA-Z0-9]/g, '_')}.apk`
      }, { quoted: msg });

    } catch (err) {
      console.error('[apkmod] Error:', err.message);
      await sock.sendMessage(jid, { 
        text: `❌ Hubo un error al procesar la solicitud:\n\`\`\`${err.message}\`\`\`` 
      }, { quoted: msg });
    }
  }
};
