const eco = require('../../lib/eco-anim');
const N = require('../../lib/eco-negocios');
const S = require('../../lib/eco-subasta');
const { caja, advertencia, porCategoria } = require('../../lib/estilo');
const { guardarDB, leerDB } = require('../../lib/db');

const sinAcentos = N.sinAcentos;

const fichaLinea = (n, u, db, prefix) => {
  const mio = N.propios(u).includes(n.id);
  const nivel = N.nivelDe(u, n.id);
  const dueño = n.tipo === 'exclusiva' && (db.propiedadesUnicas || {})[n.id];
  const marcas = `${n.par ? ' 💞' : ''}${n.maxNivel ? ` 🔼${n.maxNivel}` : ''}`;
  const estado = mio ? ` ✅ (tuyo${nivel ? ` · nivel ${nivel}` : ''})` : dueño ? ' 🔒 (ya tiene dueño)' : '';
  const precio = n.tipo === 'exclusiva' ? `valor ${eco.dinero(n.precio)} · solo por subasta` : eco.dinero(n.precio);
  return [`#${n.num} ${n.emoji} *${n.nombre}*${marcas}${estado}`, `   ${precio} → +${eco.dinero(n.hora)}/h`];
};

function portada(u, db, prefix) {
  const r = N.resumen(u, db);
  const lineas = [
    'Tus propiedades ganan dinero solas, aunque no estés.',
    `Se junta hasta ${N.MAX_HORAS} h y se cobra con *${prefix}recolectar*.`,
    '',
    `🏘️ Tienes *${r.cantidad}* de ${r.total} propiedades · ${eco.dinero(r.porHora)} por hora${r.mult > 1 ? ` ⚡x${Math.round(r.mult * 100) / 100}` : ''}`,
    ...(r.mult > 1 ? [`⚡ Multiplicador activo: quedan ${Math.ceil((r.multHasta - Date.now()) / 60000)} min · mira *${prefix}misiones*`] : []),
    '',
    '*Zonas* (ábrelas con el nombre):'
  ];
  for (const c of N.CATEGORIAS) {
    const lista = N.NEGOCIOS.filter((n) => n.cat === c.id);
    const mias = lista.filter((n) => N.propios(u).includes(n.id)).length;
    const minimo = Math.min(...lista.map((n) => n.precio));
    lineas.push(`${c.emoji} *${prefix}negocio ${sinAcentos(c.id)}* — ${lista.length} (desde ${eco.dinero(minimo)})${mias ? ` · tuyas ${mias}` : ''}`);
  }
  lineas.push(
    '',
    `▸ Comprar: *${prefix}negocio comprar <número o nombre>*`,
    `▸ Mejorar: *${prefix}negocio mejorar <número o nombre>*`,
    `▸ Detalles: *${prefix}negocio info <número o nombre>*`,
    `▸ Mis propiedades: *${prefix}mapa*`,
    `▸ Exclusivas: *${prefix}subasta*`,
    `▸ Pareja: *${prefix}negocio compartir* (on/off)`,
    '',
    '💞 = da x1.5 si tú y tu pareja la tienen · 🔼 = mejoras · 👑 = exclusiva'
  );
  return lineas;
}

module.exports = {
  name: 'negocio',
  aliases: ['negocios', 'empresa', 'propiedad', 'propiedades'],
  category: 'economia',
  description: 'Compra, mejora y comparte propiedades que ganan solas (100+). Cóbralas con .recolectar y míralas con .mapa',
  execute: async (sock, jid, msg, { prefix = '.', texto = '' } = {}) => {
    const estilo = porCategoria('economia');
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = String(texto).trim().split(/\s+/).slice(1).filter(Boolean);
    const sub = sinAcentos(args[0]);
    const aviso = (t) => sock.sendMessage(jid, { text: advertencia(t, { titulo: 'PROPIEDADES', estilo }) }, { quoted: msg });
    const mostrar = (lineas, titulo = 'PROPIEDADES') => sock.sendMessage(jid, { text: caja(lineas, { titulo, estilo }) }, { quoted: msg });

    { const db0 = leerDB(); if (S.resolver(db0)) guardarDB(db0); }
    const { usuario, llave } = eco.ficha(remitente);
    const dbLectura = leerDB();

    if (!sub || ['lista', 'ver', 'tienda', 'zonas'].includes(sub)) return mostrar(portada(usuario, dbLectura, prefix));

    const cat = N.buscarCategoria(sub);
    if (cat && !['comprar', 'mejorar', 'info', 'compartir', 'mis'].includes(sub)) {
      const lineas = [`${cat.emoji} *${cat.nombre}*`, ''];
      for (const n of N.NEGOCIOS.filter((x) => x.cat === cat.id)) lineas.push(...fichaLinea(n, usuario, dbLectura, prefix));
      lineas.push('', `💼 Tu saldo: *${eco.dinero(usuario.saldo)}*`, `▸ *${prefix}negocio comprar <número>*`);
      return mostrar(lineas, cat.nombre.toUpperCase());
    }

    if (['compartir', 'pareja'].includes(sub)) {
      const opcion = sinAcentos(args[1]);
      if (!usuario.pareja) return aviso('Compartir propiedades es para casados. Cásate con *' + prefix + 'casar*.');
      const r = eco.actualizar(remitente, (u, db) => {
        if (['on', 'si', 'activar', 'prender'].includes(opcion)) { N.fijar(db, u); u.negocioCompartir = true; }
        else if (['off', 'no', 'apagar', 'desactivar'].includes(opcion)) { N.fijar(db, u); u.negocioCompartir = false; }
        return { activo: u.negocioCompartir !== false, activaPareja: !!N.parejaDe(db, u) };
      });
      return mostrar([
        `💞 Compartir con tu pareja: *${r.activo ? 'ACTIVADO' : 'APAGADO'}*`,
        '',
        'Con esto activado (y si ella/él también lo tiene), los dos ganan dinero de las propiedades de ambos.',
        `Las que tienen los dos y dan 💞 ganan *x${N.BONO_PAREJA}*.`,
        r.activo && !r.activaPareja ? '\n⚠️ Tu pareja lo tiene apagado, así que por ahora no se une nada.' : '',
        '',
        `▸ *${prefix}negocio compartir on* / *off*`
      ].filter((x) => x !== ''));
    }

    if (sub === 'mis' || sub === 'mias') {
      const r = N.resumen(usuario, dbLectura);
      if (!r.cantidad) return aviso(`Todavía no tienes propiedades. Mira las zonas con *${prefix}negocio*.`);
      const lineas = [`🏘️ ${r.cantidad} propiedades · ${eco.dinero(r.porHora)}/h · 24 h: ${eco.dinero(r.en24)}`, ''];
      for (const e of r.inv.items.sort((a, b) => b.hora - a.hora).slice(0, 30)) lineas.push(`${e.n.emoji} ${e.nombre} — ${eco.dinero(e.hora)}/h${e.bono ? ' 💞x1.5' : ''}${!e.mio ? ' (de tu pareja)' : ''}`);
      if (r.cantidad > 30) lineas.push(`… y ${r.cantidad - 30} más`);
      lineas.push('', `Para verlas todas: *${prefix}mapa*`);
      return mostrar(lineas);
    }

    if (['info', 'detalle', 'detalles'].includes(sub)) {
      const n = N.buscarNegocio(args.slice(1).join(' '));
      if (!n) return aviso(`Dime cuál. Ej: *${prefix}negocio info 12* o *${prefix}negocio info pizzeria*`);
      const nivel = N.nivelDe(usuario, n.id);
      const dueño = (dbLectura.propiedadesUnicas || {})[n.id];
      const lineas = [
        `${n.emoji} *${n.nombre}* ${n.tipo === 'exclusiva' ? '👑 EXCLUSIVA' : ''}`,
        `Zona: ${N.CATEGORIAS.find((c) => c.id === n.cat).nombre}`,
        n.tipo === 'exclusiva' ? `Valor: ${eco.dinero(n.precio)} · solo por *${prefix}subasta* (arranca en ${eco.dinero(n.salida)})${dueño ? ' · ya tiene dueño 🔒' : ' · libre'}` : `Precio: ${eco.dinero(n.precio)}`,
        n.par ? `💞 Da x${N.BONO_PAREJA} si tú y tu pareja la tienen` : 'Sin bono de pareja',
        '', '*Etapas:*'
      ];
      n.etapas.forEach((e, i) => {
        lineas.push(`${i === nivel && N.propios(usuario).includes(n.id) ? '👉' : '▫️'} ${i}. ${e.nombre} — ${eco.dinero(e.hora)}/h${i ? ` (mejora: ${eco.dinero(e.costo)})` : ''}`);
      });
      if (!n.maxNivel) lineas.push('(No se puede mejorar)');
      return mostrar(lineas);
    }

    const esCompra = ['comprar', 'compra', 'buy'].includes(sub);
    const esMejora = ['mejorar', 'mejora', 'upgrade', 'subir'].includes(sub);
    if (!esCompra && !esMejora) {
      const n = N.buscarNegocio(args.join(' '));
      if (n) return module.exports.execute(sock, jid, msg, { prefix, texto: `${prefix}negocio info ${n.id}` });
      return aviso(`No entendí. Usa *${prefix}negocio* para ver las zonas, *${prefix}negocio comprar <número>* o *${prefix}negocio mejorar <número>*.`);
    }
    const negocio = N.buscarNegocio(args.slice(1).join(' '));
    if (!negocio) return aviso(`Dime cuál. Ej: *${prefix}negocio ${esCompra ? 'comprar' : 'mejorar'} 12*`);
    const titulo = `${negocio.emoji} ${negocio.nombre}`;

    if (esCompra) {
      if (negocio.tipo === 'exclusiva') return aviso(`${titulo} es exclusiva: solo se consigue ganando una *${prefix}subasta* 👑`);
      if (N.propios(usuario).includes(negocio.id)) return aviso(`Ya tienes ${titulo}.${negocio.maxNivel ? ` Mejórala con *${prefix}negocio mejorar ${negocio.num}*.` : ''}`);
      if ((Number(usuario.saldo) || 0) < negocio.precio) return aviso(`Te faltan ${eco.dinero(negocio.precio - (Number(usuario.saldo) || 0))} para comprar ${titulo} (${eco.dinero(negocio.precio)}).`);

      await eco.correr(sock, jid, msg, `negocio:${llave}`, async () => {
        const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'PROPIEDADES' });
        await anim.paso([titulo, '', '📝 Firmando el contrato...']);
        await anim.paso([titulo, '', '🏗️ Construyendo...', eco.barra(0.3)]);
        await anim.paso([titulo, '', '🏗️ Construyendo...', eco.barra(0.7)]);
        await anim.paso([titulo, '', '🎀 Cortando el listón...', eco.barra(1)]);
        const r = eco.actualizar(remitente, (u, db) => N.comprar(db, u, llave, negocio));
        if (r.error) return anim.final([titulo, '', r.error === 'ya' ? '❌ Ya tenías esta propiedad.' : '❌ Ya no te alcanza el dinero. No se cobró nada.']);
        await anim.final([
          '🎉 ¡Inauguración!', '', `${titulo} ya es tuya`,
          `💸 Pagaste: ${eco.dinero(negocio.precio)}`,
          `📈 Tus ${r.cantidad} propiedad(es) ganan ${eco.dinero(r.hora)} por hora`,
          `💼 Saldo actual: *${eco.dinero(r.saldo)}*`, '',
          negocio.maxNivel ? `🔼 Mejórala con *${prefix}negocio mejorar ${negocio.num}*` : `Cobra con *${prefix}recolectar*`
        ]);
      });
      return;
    }

    if (!N.propios(usuario).includes(negocio.id)) return aviso(`Primero necesitas tener ${titulo}.`);
    const nivel = N.nivelDe(usuario, negocio.id);
    if (!negocio.maxNivel) return aviso(`${titulo} no tiene mejoras.`);
    if (nivel >= negocio.maxNivel) return aviso(`${titulo} ya está al máximo: *${negocio.etapas[nivel].nombre}* ⭐`);
    const sig = negocio.etapas[nivel + 1];
    if ((Number(usuario.saldo) || 0) < sig.costo) return aviso(`Te faltan ${eco.dinero(sig.costo - (Number(usuario.saldo) || 0))} para mejorarla a *${sig.nombre}* (${eco.dinero(sig.costo)}).`);

    await eco.correr(sock, jid, msg, `negocio:${llave}`, async () => {
      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'MEJORA' });
      await anim.paso([`${negocio.emoji} ${negocio.etapas[nivel].nombre}`, '', '🔨 Contratando obreros...']);
      await anim.paso([`${negocio.emoji} ${negocio.etapas[nivel].nombre}`, '', '🏗️ Ampliando...', eco.barra(0.4)]);
      await anim.paso([`${negocio.emoji} ${negocio.etapas[nivel].nombre}`, '', '🏗️ Remodelando...', eco.barra(0.8)]);
      await anim.paso(['✨ ¡Casi listo!', '', eco.barra(1)]);
      const r = eco.actualizar(remitente, (u, db) => N.mejorar(db, u, llave, negocio));
      if (r.error) return anim.final([titulo, '', r.error === 'saldo' ? '❌ Ya no te alcanza el dinero. No se cobró nada.' : '❌ No se pudo mejorar. No se cobró nada.']);
      await anim.final([
        '🆙 ¡Mejora terminada!', '',
        `${negocio.emoji} ${r.anterior.nombre} ➜ *${r.etapa.nombre}*`,
        `📈 Ahora gana ${eco.dinero(r.etapa.hora)}/h (antes ${eco.dinero(r.anterior.hora)}/h)`,
        `💸 Pagaste: ${eco.dinero(r.etapa.costo)}`,
        `💼 Saldo actual: *${eco.dinero(r.saldo)}*`,
        r.nivel < negocio.maxNivel ? `🔼 Aún puedes mejorarla (${r.nivel}/${negocio.maxNivel})` : '⭐ ¡Nivel máximo!'
      ]);
    });
  }
};

// MISIONES-AVISO
