const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'ff',
  aliases: ['sala', '1vs1', '2vs2', '3vs3', '4vs4', '5vs5', '6vs6'],
  category: 'fun',
  description: 'Arma equipos aleatorios para salas de Free Fire (ej: .ff 4vs4)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Verificar si el mensaje viene de un grupo
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: advertencia('Este comando solo se puede usar en grupos.', { titulo: 'ERROR DE USO' }) });
    }

    const textoLimpio = texto.trim();
    const args = textoLimpio.split(/\s+/);
    
    // Identificar el comando o alias con el que fue invocado (ej. ".ff", ".4vs4", "ff", "4vs4")
    let comandoLlamado = args[0] ? args[0].replace(prefix, '').toLowerCase() : '';
    let formatoArg = args[1] || '';

    // Si usaron un alias directo (ej. .4vs4), el argumento del formato pasa a ser el comandoLlamado
    if (!formatoArg && comandoLlamado && comandoLlamado !== 'ff' && comandoLlamado !== 'sala') {
      formatoArg = comandoLlamado;
    }

    if (!formatoArg || !formatoArg.includes('vs')) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Uso incorrecto.\nEjemplo: ${prefix}ff 4vs4\nTambién puedes usar alias directos como ${prefix}4vs4`, { titulo: 'SALAS FREE FIRE' }) 
      });
    }

    // Parsear el formato XvsX de forma robusta
    const partes = formatoArg.toLowerCase().split('vs');
    const porEquipo = parseInt(partes[0], 10);

    if (isNaN(porEquipo) || porEquipo < 1 || porEquipo > 6) {
      return sock.sendMessage(jid, { text: advertencia('El formato de la sala debe ser desde 1vs1 hasta 6vs6.', { titulo: 'FORMATO INVALIDO' }) });
    }

    const totalNecesario = porEquipo * 2;

    try {
      // Obtener metadata actualizada del grupo
      const metadata = await sock.groupMetadata(jid);
      const participantes = metadata.participants || [];

      // Ajustado para extraer correctamente el identificador sin importar la versión de Baileys
      let jugadores = participantes
        .map(p => {
          const rawId = p.id || p.jid || (p.user ? `${p.user}@s.whatsapp.net` : null);
          return rawId;
        })
        .filter(id => id && typeof id === 'string' && (id.includes('@s.whatsapp.net') || id.includes('@c.us')));

      // Normalizar asegurando que terminen en @s.whatsapp.net si es necesario, o conservar tal cual
      jugadores = jugadores.map(id => id.includes('@') ? id : `${id}@s.whatsapp.net`);

      if (jugadores.length < totalNecesario) {
        return sock.sendMessage(jid, { 
          text: advertencia(`Se necesitan al menos ${totalNecesario} jugadores en el grupo para armar una sala ${formatoArg.toUpperCase()}. Actualmente hay ${jugadores.length} jugadores detectados.`, { titulo: 'POCOS JUGADORES' }) 
        });
      }

      // Mezclar aleatoriamente los jugadores
      jugadores.sort(() => Math.random() - 0.5);

      // Seleccionar los participantes para ambos equipos
      const equipoBermuda = jugadores.slice(0, porEquipo);
      const equipoPurgatorio = jugadores.slice(porEquipo, totalNecesario);

      // Construir el mensaje con los JIDs limpios para que las menciones funcionen correctamente
      let mensajeTexto = `🔥 *SALA DE FREE FIRE - ${formatoArg.toUpperCase()}* 🔥\n\n`;
      mensajeTexto += `🎯 *Mapa: Bermuda (Equipo 1)*\n`;
      equipoBermuda.forEach((j, index) => {
        const usuarioReal = j.split('@')[0];
        mensajeTexto += `  ${index + 1}. @${usuarioReal}\n`;
      });

      mensajeTexto += `\n🎯 *Mapa: Purgatorio (Equipo 2)*\n`;
      equipoPurgatorio.forEach((j, index) => {
        const usuarioReal = j.split('@')[0];
        mensajeTexto += `  ${index + 1}. @${usuarioReal}\n`;
      });

      mensajeTexto += `\n⚡ _¡Prepárense para saltar a Puesto Militar!_ 🪂`;

      // Recopilar todas las menciones necesarias para Baileys
      const menciones = [...equipoBermuda, ...equipoPurgatorio];

      await sock.sendMessage(jid, { 
        text: mensajeTexto, 
        mentions: menciones 
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo armar la sala de Free Fire: ' + (err.message || err)) });
    }
  }
};