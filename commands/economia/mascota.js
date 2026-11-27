const { leerDB, guardarDB, getUsuario, claveCanonica } = require('../../lib/db');
const { llaveRemitente, llavePersona, objetivoDe } = require('../../lib/economiaid');
const M = require('../../lib/mascotas');
const Art = require('../../lib/mascotart');

const dinero = (n) => '$' + Number(n || 0).toLocaleString('es-MX');
const tag = (id) => '@' + M.num(id);

function nombreDe(db, llave) {
  const u = db.usuarios && db.usuarios[claveCanonica(db, llave)];
  return (u && (u.perfilNombre || u.nombre || (u.registro && u.registro.nombre))) || ('+' + M.num(llave));
}
const tarjetaDe = (db, usuario, llave, m) => {
  const p = M.progreso(m);
  return Art.tarjeta({
    especie: m.especie, tono: m.tono, nombre: m.nombre, nivel: p.nivel, xpActual: p.xpActual, xpSiguiente: p.xpSiguiente,
    duenos: m.duenos.map((d) => nombreDe(db, d)), compartida: m.duenos.length > 1,
    puesta: M.mostradas(db, usuario, llave).some((x) => x.id === m.id)
  });
};
let imgTienda = null;
const tiendaImg = () => imgTienda || (imgTienda = Art.galeria(Art.ORDEN.map((k) => ({ especie: k, tono: 0, titulo: Art.ESPECIES[k].nombre, sub: dinero(Art.ESPECIES[k].precio) })), { titulo: 'TIENDA DE MASCOTAS', cols: 5 }));

module.exports = {
  name: 'mascota',
  aliases: ['mascotas', 'pet', 'pets'],
  category: 'economia',
  description: 'Mascotas para tu perfil: comprar, compartir con otra persona, alimentar y mostrarlas. Usa .mascota para ver la tienda',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const p = prefix;
    const decir = (t, mentions = []) => sock.sendMessage(jid, { text: t, mentions }, { quoted: msg });
    const foto = (buf, caption, mentions = []) => sock.sendMessage(jid, { image: buf, caption, mentions }, { quoted: msg });
    const args = String(texto || '').trim().split(/\s+/).slice(1);
    const sub = M.norm(args[0] || '');
    const resto = args.slice(1);
    const yoJid = msg.key.participant || msg.key.remoteJid;

    const db = leerDB();
    const yo = await llaveRemitente(sock, jid, db, msg);
    const usuario = getUsuario(db, yo);
    const guardar = () => guardarDB(db);

    if (!sub || ['tienda', 'lista', 'catalogo', 'shop'].includes(sub)) {
      return foto(tiendaImg(),
        `🐾 *TIENDA DE MASCOTAS*\n\n` +
        `🛒 *${p}mascota comprar <numero o especie> [nombre]*\n` +
        `👫 Comprar entre dos (cada uno paga la mitad): *${p}mascota comprar 7 Rex @persona*\n` +
        `📋 Tus mascotas: *${p}mascota mis*\n` +
        `🔗 Compartir una: *${p}mascota compartir <n> @persona*\n` +
        `🖼️ Mostrar en el perfil (hasta ${M.MAX_PERFIL}): *${p}mascota poner <n>* / *quitar <n>*\n` +
        `🍖 *${p}mascota alimentar <n>* · 🎾 *${p}mascota jugar <n>* · ✏️ *${p}mascota nombre <n> <nuevo>*\n` +
        `👋 *${p}mascota dejar <n>* (si es solo tuya te devuelven el ${Math.round(M.VENTA * 100)}%)`);
    }

    if (['mis', 'mias', 'mascotas'].includes(sub)) {
      const mias = M.misMascotas(db, yo);
      if (!mias.length) return decir(`🐾 Aun no tienes mascotas. Mira la tienda con *${p}mascota* y compra con *${p}mascota comprar <n>*.`);
      const vistas = new Set(M.mostradas(db, usuario, yo).map((x) => x.id));
      const items = mias.map((m) => ({ especie: m.especie, tono: m.tono, titulo: m.nombre, sub: `${Art.ESPECIES[m.especie].nombre} · Nv ${M.nivelDe(m.xp || 0)}`, extra: vistas.has(m.id) ? 'En tu perfil' : '', compartida: m.duenos.length > 1 }));
      const menciones = new Set();
      const lineas = mias.map((m, i) => {
        const otros = m.duenos.filter((d) => claveCanonica(db, d) !== yo && M.num(d) !== M.num(yo));
        otros.forEach((o) => menciones.add(o));
        return `${i + 1}. ${m.nombre}${otros.length ? ` — con ${otros.map(tag).join(', ')}` : ''}`;
      });
      return foto(Art.galeria(items, { titulo: 'MIS MASCOTAS' }), `🐾 *Tus mascotas* (${mias.length}/${M.MAX_MASCOTAS})\n${lineas.join('\n')}\n\nUsa el numero en los comandos: *${p}mascota ver 1*`, [...menciones]);
    }

    if (['comprar', 'adoptar', 'buy'].includes(sub)) {
      const especie = M.buscarEspecie(resto[0]);
      if (!especie) return decir(`🤔 Dime que mascota quieres: *${p}mascota comprar <numero o especie> [nombre]*\nMira los numeros con *${p}mascota*.`);
      const e = Art.ESPECIES[especie];
      const nombre = M.limpiarNombre(resto.slice(1).filter((t) => !t.startsWith('@') && !/^\d{8,}$/.test(t)).join(' ')) || e.nombre;
      const objetivo = objetivoDe(msg, args.join(' '));
      const otro = objetivo ? await llavePersona(sock, jid, db, objetivo) : null;
      const juntos = otro && otro !== yo && M.num(otro) !== M.num(yo);

      if (M.misMascotas(db, yo).length >= M.MAX_MASCOTAS) return decir(`🐾 Ya tienes ${M.MAX_MASCOTAS} mascotas, es el maximo. Suelta una con *${p}mascota dejar <n>*.`);

      if (!juntos) {
        if ((usuario.saldo || 0) < e.precio) return decir(`💸 *${e.nombre}* cuesta ${dinero(e.precio)} y en mano tienes ${dinero(usuario.saldo)}. (Saca del banco con *${p}banco sacar <monto>*)`);
        usuario.saldo -= e.precio;
        const m = M.crear(db, { especie, nombre, duenos: [yo] });
        if (Array.isArray(usuario.mascotasPerfil) && usuario.mascotasPerfil.length < M.MAX_PERFIL) usuario.mascotasPerfil.push(m.id);
        guardar();
        return foto(tarjetaDe(db, usuario, yo, m), `🎉 ${tag(yoJid)} compro a *${m.nombre}* (${e.nombre}) por ${dinero(e.precio)}\n💰 Te quedan: ${dinero(usuario.saldo)}\n\nSe ve en tu *${p}perfil*. Compartela con alguien: *${p}mascota compartir ${M.misMascotas(db, yo).findIndex((x) => x.id === m.id) + 1} @persona*`, [yoJid]);
      }

      const mitad = Math.ceil(e.precio / 2);
      if ((usuario.saldo || 0) < mitad) return decir(`💸 Tu mitad de *${e.nombre}* es ${dinero(mitad)} y en mano tienes ${dinero(usuario.saldo)}.`);
      M.guardarPropuesta(otro, { tipo: 'comprar', de: yo, deJid: yoJid, paraJid: objetivo, especie, nombre, mitad });
      return decir(`👫 ${tag(objetivo)}, ${tag(yoJid)} quiere comprar contigo a *${nombre}* (${e.nombre}, ${dinero(e.precio)}). Cada quien paga *${dinero(mitad)}* y la mascota es de los dos.\n\n✅ *${p}mascota aceptar*   ❌ *${p}mascota rechazar*\n(tienes 5 minutos)`, [objetivo, yoJid]);
    }

    if (['compartir', 'share'].includes(sub)) {
      const { m } = M.buscarMia(db, yo, resto[0]);
      if (!m) return decir(`🤔 No encontre esa mascota. Mira tus numeros con *${p}mascota mis*.\nUso: *${p}mascota compartir <n> @persona*`);
      const objetivo = objetivoDe(msg, resto.slice(1).join(' '));
      if (!objetivo) return decir(`Menciona o responde a la persona con quien quieres compartir a *${m.nombre}*: *${p}mascota compartir ${resto[0]} @persona*`);
      const otro = await llavePersona(sock, jid, db, objetivo);
      if (otro === yo || M.num(otro) === M.num(yo)) return decir('No puedes compartirla contigo mismo 😅');
      if (M.esDe(db, m, otro)) return decir(`${tag(objetivo)} ya es dueño/a de *${m.nombre}*.`, [objetivo]);
      if (m.duenos.length >= M.MAX_DUENOS) return decir(`*${m.nombre}* ya tiene ${M.MAX_DUENOS} dueños. Una mascota se comparte con hasta ${M.MAX_DUENOS} personas.`);
      if (M.misMascotas(db, otro).length >= M.MAX_MASCOTAS) return decir(`${tag(objetivo)} ya tiene ${M.MAX_MASCOTAS} mascotas, es el maximo.`, [objetivo]);
      M.guardarPropuesta(otro, { tipo: 'compartir', de: yo, deJid: yoJid, paraJid: objetivo, petId: m.id });
      return decir(`🔗 ${tag(objetivo)}, ${tag(yoJid)} quiere compartir contigo a *${m.nombre}* (${Art.ESPECIES[m.especie].nombre}). Les saldra a los dos en el perfil.\n\n✅ *${p}mascota aceptar*   ❌ *${p}mascota rechazar*\n(tienes 5 minutos)`, [objetivo, yoJid]);
    }

    if (['aceptar', 'acepto', 'si', 'rechazar', 'rechazo', 'no'].includes(sub)) {
      const prop = M.propuestaDe(yo);
      if (!prop) return decir('No tienes ninguna propuesta de mascota pendiente (duran 5 minutos).');
      if (['rechazar', 'rechazo', 'no'].includes(sub)) { M.borrarPropuesta(yo); return decir(`❌ ${tag(yoJid)} rechazo la propuesta.`, [yoJid]); }
      if (M.misMascotas(db, yo).length >= M.MAX_MASCOTAS) return decir(`🐾 Ya tienes ${M.MAX_MASCOTAS} mascotas, es el maximo.`);

      if (prop.tipo === 'compartir') {
        const m = M.tabla(db)[prop.petId];
        if (!m || !M.esDe(db, m, prop.de)) { M.borrarPropuesta(yo); return decir('Esa mascota ya no existe o ya no es de quien te la ofrecio.'); }
        if (m.duenos.length >= M.MAX_DUENOS) { M.borrarPropuesta(yo); return decir(`*${m.nombre}* ya tiene ${M.MAX_DUENOS} dueños.`); }
        m.duenos.push(yo);
        if (Array.isArray(usuario.mascotasPerfil) && usuario.mascotasPerfil.length < M.MAX_PERFIL) usuario.mascotasPerfil.push(m.id);
        M.borrarPropuesta(yo); guardar();
        return foto(tarjetaDe(db, usuario, yo, m), `💞 *${m.nombre}* ${m.duenos.length > 2 ? 'ahora tiene a ' + tag(yoJid) + ' como dueño/a (' + m.duenos.length + ' dueños en total).' : 'ahora es de ' + tag(prop.deJid) + ' y ' + tag(yoJid) + '.'}\nSale en el perfil de los dos (si no la ves, usa *${p}mascota poner <n>*).`, [prop.deJid, yoJid]);
      }

      if (prop.tipo === 'comprar') {
        const quien = getUsuario(db, prop.de);
        if ((usuario.saldo || 0) < prop.mitad) return decir(`💸 Tu mitad es ${dinero(prop.mitad)} y en mano tienes ${dinero(usuario.saldo)}.`);
        if ((quien.saldo || 0) < prop.mitad) { M.borrarPropuesta(yo); return decir(`💸 ${tag(prop.deJid)} ya no tiene ${dinero(prop.mitad)} en mano. Se cancelo la compra.`, [prop.deJid]); }
        if (M.misMascotas(db, prop.de).length >= M.MAX_MASCOTAS) { M.borrarPropuesta(yo); return decir(`${tag(prop.deJid)} ya tiene ${M.MAX_MASCOTAS} mascotas. Se cancelo la compra.`, [prop.deJid]); }
        usuario.saldo -= prop.mitad; quien.saldo -= prop.mitad;
        const m = M.crear(db, { especie: prop.especie, nombre: prop.nombre, duenos: [prop.de, yo] });
        for (const u of [usuario, quien]) if (Array.isArray(u.mascotasPerfil) && u.mascotasPerfil.length < M.MAX_PERFIL) u.mascotasPerfil.push(m.id);
        M.borrarPropuesta(yo); guardar();
        return foto(tarjetaDe(db, usuario, yo, m), `🎉 ${tag(prop.deJid)} y ${tag(yoJid)} compraron juntos a *${m.nombre}* (${Art.ESPECIES[m.especie].nombre}).\n💸 Cada uno pago ${dinero(prop.mitad)}.`, [prop.deJid, yoJid]);
      }
      return;
    }

    const necesitaMascota = ['ver', 'nombre', 'renombrar', 'poner', 'quitar', 'dejar', 'soltar', 'alimentar', 'comer', 'jugar'];
    if (!necesitaMascota.includes(sub)) return decir(`🐾 No entendi. Usa *${p}mascota* para ver la tienda y los comandos.`);
    const { m } = M.buscarMia(db, yo, resto[0]);
    if (!m) return decir(`🤔 No encontre esa mascota. Mira tus numeros con *${p}mascota mis*.`);
    const idx = M.misMascotas(db, yo).findIndex((x) => x.id === m.id) + 1;

    if (sub === 'ver') return foto(tarjetaDe(db, usuario, yo, m), `🐾 *${m.nombre}*${m.duenos.length > 1 ? ' (compartida)' : ''}`);

    if (sub === 'nombre' || sub === 'renombrar') {
      const nuevo = M.limpiarNombre(resto.slice(1).join(' '));
      if (!nuevo) return decir(`Uso: *${p}mascota nombre ${idx} <nuevo nombre>* (hasta 16 letras).`);
      m.nombre = nuevo; guardar();
      return decir(`✏️ Ahora se llama *${nuevo}*.`);
    }

    if (sub === 'poner') {
      const actuales = M.mostradas(db, usuario, yo).map((x) => x.id);
      if (actuales.includes(m.id)) return decir(`*${m.nombre}* ya sale en tu perfil.`);
      if (actuales.length >= M.MAX_PERFIL) return decir(`Ya tienes ${M.MAX_PERFIL} mascotas en el perfil. Quita una con *${p}mascota quitar <n>*.`);
      M.fijarPerfil(db, usuario, yo, [...actuales, m.id]); guardar();
      return decir(`🖼️ *${m.nombre}* ya sale en tu *${p}perfil*.`);
    }
    if (sub === 'quitar') {
      const actuales = M.mostradas(db, usuario, yo).map((x) => x.id);
      if (!actuales.includes(m.id)) return decir(`*${m.nombre}* no estaba en tu perfil.`);
      M.fijarPerfil(db, usuario, yo, actuales.filter((x) => x !== m.id)); guardar();
      return decir(`📤 *${m.nombre}* ya no sale en tu perfil (sigue siendo tuya).`);
    }

    if (sub === 'dejar' || sub === 'soltar') {
      if (m.duenos.length > 1) {
        m.duenos = m.duenos.filter((d) => claveCanonica(db, d) !== yo && M.num(d) !== M.num(yo));
        if (Array.isArray(usuario.mascotasPerfil)) usuario.mascotasPerfil = usuario.mascotasPerfil.filter((x) => x !== m.id);
        guardar();
        return decir(`👋 Dejaste de ser dueño/a de *${m.nombre}*. Se queda con ${m.duenos.length > 3 ? m.duenos.length + ' dueños' : m.duenos.map(tag).join(' y ')}.`, m.duenos);
      }
      const dev = Math.floor(Art.ESPECIES[m.especie].precio * M.VENTA);
      usuario.saldo = (usuario.saldo || 0) + dev;
      delete M.tabla(db)[m.id];
      if (Array.isArray(usuario.mascotasPerfil)) usuario.mascotasPerfil = usuario.mascotasPerfil.filter((x) => x !== m.id);
      guardar();
      return decir(`👋 *${m.nombre}* encontro otro hogar. Te devolvieron ${dinero(dev)}.\n💰 Tienes: ${dinero(usuario.saldo)}`);
    }

    const accion = sub === 'jugar' ? 'jugar' : 'alimentar';
    const ahora = Date.now(); const ult = (m.ult && m.ult[accion]) || 0; const espera = M.COOLDOWN[accion] - (ahora - ult);
    if (espera > 0) return decir(`⏳ *${m.nombre}* ${accion === 'jugar' ? 'esta cansado/a de jugar' : 'aun no tiene hambre'}. Vuelve en ${Math.ceil(espera / 60000)} min.`);
    if (accion === 'alimentar') {
      if ((usuario.saldo || 0) < M.COSTO_ALIMENTAR) return decir(`💸 La comida cuesta ${dinero(M.COSTO_ALIMENTAR)} y en mano tienes ${dinero(usuario.saldo)}.`);
      usuario.saldo -= M.COSTO_ALIMENTAR;
    }
    const antes = M.nivelDe(m.xp || 0);
    m.xp = (m.xp || 0) + (accion === 'jugar' ? 6 : 14);
    m.ult = { ...(m.ult || {}), [accion]: ahora };
    const despues = M.nivelDe(m.xp);
    guardar();
    const pr = M.progreso(m);
    return foto(tarjetaDe(db, usuario, yo, m), `${accion === 'jugar' ? '🎾 Jugaste con' : '🍖 Alimentaste a'} *${m.nombre}*${accion === 'alimentar' ? ` (-${dinero(M.COSTO_ALIMENTAR)})` : ''}\n⭐ XP ${pr.xpActual}/${pr.xpSiguiente}${despues > antes ? `\n🎉 *¡Subio al nivel ${despues}!*` : ''}`);
  }
};

// MASCOTAS-NUEVAS

// MASCOTAS-DUENOS
