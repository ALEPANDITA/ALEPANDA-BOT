module.exports = {
  name: 'einfo',
  category: 'economia',
  description: 'Muestra todos los comandos de economia disponibles',
  execute: async (sock, jid, msg, { prefix }) => {
    const texto = `💰 *COMANDOS DE ECONOMIA*\n\n` +
      `${prefix}saldo — ver tu dinero\n` +
      `${prefix}banco — guardar/sacar dinero del banco\n` +
      `${prefix}trabajar — trabajar cada 1 hora\n` +
      `${prefix}diario — bono diario cada 24h\n` +
      `${prefix}transferir — enviar dinero a alguien\n` +
      `${prefix}crimen — arriesgate por dinero (cada 45 min)\n` +
      `${prefix}robar — intenta robarle a alguien (cada 1h)\n` +
      `${prefix}cazar — caza animales por dinero (cada 30 min, arriesgas vida)\n` +
      `${prefix}curar — recupera vida perdida cazando\n` +
      `${prefix}minar — excava minerales para vender (cada 20 min)\n` +
      `${prefix}matematicas — resuelve rapido y gana dinero\n` +
      `${prefix}topsaldo — ranking de los mas ricos del grupo\n\n` +
      `🎰 *CASINO*\n` +
      `${prefix}apostar — cara o cruz\n` +
      `${prefix}tragamonedas — maquina tragamonedas\n` +
      `${prefix}aventura — explora en busca de tesoros\n` +
      `${prefix}buceo — bucea por recompensas`;

    await sock.sendMessage(jid, { text: texto });
  }
};
