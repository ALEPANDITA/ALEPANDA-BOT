'use strict';
const crypto = require('crypto');
const arcade = require('./arcade');
const { marco, lineasPremios, REGLA } = require('./arcade-ui');

function construirContenido(juego, html) {
  const unified = {
    response_id: crypto.randomUUID(),
    sections: [{
      __typename: 'GenAIUnifiedResponseSection',
      view_model: {
        __typename: 'GenAISingleLayoutViewModel',
        primitive: { __typename: 'GenAIBotProgressStatusPrimitive', is_in_progress: true, title: `${juego.emoji} CLICK AQUÍ Jugar ${juego.titulo} 🎮` }
      }
    }],
    embedded_screens: [{
      title: 'Preview',
      content: [{
        __typename: 'FOAIDNixelButtonSheets',
        tabs: [{
          id: 'tab_0',
          tab_header: `${juego.emoji} ${juego.titulo}`,
          sections: [{
            __typename: 'GenAIUnifiedResponseSection',
            view_model: {
              __typename: 'GenAISingleLayoutViewModel',
              primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: html, trusted_sources: ['example.com'], url: 'https://whatsapp.com' }
            }
          }],
          step_entries: []
        }]
      }]
    }]
  };
  return {
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          submessages: [{ messageType: 'AI_RICH_RESPONSE_TEXT', messageText: `${juego.emoji} ${juego.titulo} 🎮` }],
          unifiedResponse: { data: Buffer.from(JSON.stringify(unified), 'utf8') },
          contextInfo: {
            forwardingScore: 2, isForwarded: true, forwardOrigin: 'META_AI',
            forwardedAiBotMessageInfo: { botJid: '0@bot' }, botMessageSharingInfo: { forwardScore: 2 }
          }
        }
      }
    }
  };
}

async function enviarComoPanel(datos, alFallar) {
  const { sock, jid, msg, juego, prefix, ids, nueva, cfg } = datos;
  try {
    const { proto } = require('@whiskeysockets/baileys');
    const { tarjeta, nueva: esNueva } = arcade.obtenerTarjeta(juego, ids, { nueva });
    const html = arcade.htmlPersonalizado(juego, tarjeta, prefix);
    const m = proto.Message.fromObject(construirContenido(juego, html));
    const dato = m.botForwardedMessage && m.botForwardedMessage.message && m.botForwardedMessage.message.richResponseMessage
      && m.botForwardedMessage.message.richResponseMessage.unifiedResponse && m.botForwardedMessage.message.richResponseMessage.unifiedResponse.data;
    if (!dato || !dato.length) throw new Error('esta version de Baileys no trae richResponseMessage (el mensaje saldria vacio)');
    const messageId = '3EB0' + crypto.randomBytes(9).toString('hex').toUpperCase();
    await sock.relayMessage(jid, m, { messageId });
    const horas = Math.max(1, Math.round((tarjeta.expira - Date.now()) / 3600000));
    await sock.sendMessage(jid, {
      text: marco([
        esNueva ? '🪟 *Tu juego personal va arriba* ⬆️' : '🪟 *Tu juego sigue vigente, va arriba* ⬆️',
        '_Toca el mensaje y se abre aquí mismo, dentro de WhatsApp_',
        '',
        '🎮 *¿Cómo se juega?*',
        '① Toca el mensaje de arriba y juega',
        `② Al perder te da un boleto *${juego.tag}-...*`,
        `③ Escríbelo aquí: *${prefix}reclamar ${juego.tag}-...*`,
        '',
        REGLA,
        ...lineasPremios(cfg),
        `⏳ Dura ~${horas} h · 🤫 es solo tuyo, no lo compartas`
      ], { titulo: juego.titulo.toUpperCase(), emoji: juego.emoji })
    }, { quoted: msg });
    return true;
  } catch (err) {
    console.warn('[arcade] el panel fallo, mando el archivo:', err.message);
    return alFallar(datos);
  }
}

module.exports = { enviarComoPanel, construirContenido };
