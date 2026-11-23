// Catalogo de regalos para tu esposa/o. Precios de $1,000 a $100,000,000.
// En "frase" se usa {de} y {para}; el comando los cambia por las etiquetas (@) reales.
// Para agregar regalos nuevos: anadelos AL FINAL (asi los numeros de la lista no cambian).

const REGALOS = [
  { id: 'rosa', emoji: '🌹', nombre: 'Rosa solitaria', precio: 1000,
    frase: '{de} corto la rosa mas bonita del jardin y se la dejo a {para} con el corazon latiendo a mil.' },
  { id: 'carta', emoji: '💌', nombre: 'Carta de amor', precio: 1500,
    frase: '{de} escribio a mano cada palabra... y {para} ya esta suspirando solo con leer el primer renglon.' },
  { id: 'paleta', emoji: '🍭', nombre: 'Paleta de caramelo', precio: 2000,
    frase: 'Dulce como {para}. {de} lo sabe, por eso llego con esta paletita y una sonrisa de oreja a oreja.' },
  { id: 'abrazo', emoji: '🤗', nombre: 'Abrazo virtual', precio: 3000,
    frase: '{de} estiro los brazos desde la pantalla y envolvio a {para} en el abrazo mas calentito del mundo.' },
  { id: 'ramo', emoji: '💐', nombre: 'Ramo de flores', precio: 5000,
    frase: 'Un ramo enorme, perfumado y lleno de colores: {de} quiere que {para} sepa que florece en su vida.' },
  { id: 'peluche', emoji: '🧸', nombre: 'Peluche de panda', precio: 7500,
    frase: '{de} le manda un pandita suave y abrazable a {para}, para que nunca duerma sin compañia.' },
  { id: 'cancion', emoji: '🎵', nombre: 'Cancion dedicada', precio: 10000,
    frase: '🎶 "Cada vez que sonrias, {para}, se me pone bonito el dia... esta cancion va para ti, de parte de {de}." 🎶' },
  { id: 'globos', emoji: '🎈', nombre: 'Globos de corazon', precio: 15000,
    frase: 'Un monton de globos en forma de corazon llenaron el cielo: todos dicen "{de} ♥ {para}".' },
  { id: 'chocolates', emoji: '🍫', nombre: 'Caja de chocolates', precio: 20000,
    frase: '{de} elegio uno por uno los chocolates favoritos de {para}... aunque se comio uno en el camino 🤭.' },
  { id: 'cena', emoji: '🕯️', nombre: 'Cena a la luz de las velas', precio: 35000,
    frase: 'Mesa para dos, velitas, musica suave y la mejor compania: {de} invita a {para} a una cena de pelicula.' },
  { id: 'pastel', emoji: '🎂', nombre: 'Pastel de aniversario', precio: 50000,
    frase: 'Un pastel de tres pisos con un "te amo" en betun. {de} no dejo ni a los meseros tocarlo. Para {para}, con todo el amor.' },
  { id: 'serenata', emoji: '🎺', nombre: 'Serenata de mariachi', precio: 75000,
    frase: '¡Ay ay ay! Llegaron los mariachis bajo la ventana de {para} cantando de parte de {de}. ¡El vecindario entero esta llorando!' },
  { id: 'peluchegigante', emoji: '🐻', nombre: 'Peluche gigante', precio: 100000,
    frase: 'Un peluche mas grande que una puerta llego a casa de {para}. {de} dice que es para que lo abrace cuando no este.' },
  { id: 'spa', emoji: '💆', nombre: 'Dia de spa', precio: 150000,
    frase: 'Mascarillas, masajes y mucho relax: {de} reservo el dia completo para que {para} se sienta como realeza.' },
  { id: 'perfume', emoji: '🧴', nombre: 'Perfume de lujo', precio: 200000,
    frase: 'Un frasco de cristal con la fragancia mas elegante. {de} quiere que {para} huela tan bien como brilla.' },
  { id: 'collar', emoji: '📿', nombre: 'Collar de plata', precio: 300000,
    frase: 'Brilla bajo la luz, pero no tanto como {para}. {de} le abrocha el collar con las manos temblando de emocion.' },
  { id: 'picnic', emoji: '🧺', nombre: 'Picnic bajo las estrellas', precio: 400000,
    frase: 'Manta, canasta, luces diminutas y un cielo lleno de estrellas. {de} y {para}, el plan perfecto.' },
  { id: 'playa', emoji: '🏖️', nombre: 'Viaje a la playa', precio: 600000,
    frase: '¡Maletas listas! {de} compro dos boletos al paraiso: sol, mar y {para}. ¿Que mas se puede pedir?' },
  { id: 'vestido', emoji: '👗', nombre: 'Atuendo de gala', precio: 800000,
    frase: 'Hecho a la medida y bordado a mano. {de} sabe que {para} va a deslumbrar a todo el salon.' },
  { id: 'globoaero', emoji: '🎑', nombre: 'Atardecer en globo aerostatico', precio: 1000000,
    frase: 'Por encima de las nubes, con el sol escondiendose... {de} susurra a {para}: "contigo toco el cielo".' },
  { id: 'concierto', emoji: '🎤', nombre: 'Concierto privado', precio: 1500000,
    frase: 'Luces, escenario y UNA sola persona en primera fila: {para}. Todo el show es regalo de {de}.' },
  { id: 'diamante', emoji: '💍', nombre: 'Anillo de diamante', precio: 2500000,
    frase: '{de} se hinca, abre la cajita y el diamante destella: "{para}, otra vez te elegiria mil veces".' },
  { id: 'crucero', emoji: '🛳️', nombre: 'Crucero romantico', precio: 4000000,
    frase: 'Siete dias de mar azul, cenas elegantes y bailes bajo la luna. {de} y {para} zarpan rumbo a la felicidad.' },
  { id: 'drones', emoji: '🛸', nombre: 'Show de drones con tu nombre', precio: 5000000,
    frase: 'Cientos de lucecitas escriben "{para}" y un corazon gigante en el cielo. Firma: {de}.' },
  { id: 'jet', emoji: '✈️', nombre: 'Jet privado', precio: 7500000,
    frase: '¡Preparen el despegue! {de} le regala a {para} un jet con destino a donde {para} quiera ir.' },
  { id: 'auto', emoji: '🏎️', nombre: 'Auto deportivo', precio: 10000000,
    frase: 'Rojo, veloz y con un moño enorme. {de} entrega las llaves y {para} no puede ni hablar.' },
  { id: 'yate', emoji: '🛥️', nombre: 'Yate de lujo', precio: 15000000,
    frase: 'Brisa, champan y un yate con el nombre de {para} en la proa. Cortesia de {de}.' },
  { id: 'isla', emoji: '🏝️', nombre: 'Isla privada', precio: 20000000,
    frase: 'Una isla entera, con palmeras y playa propia, solo para {para}. {de} puso el cartel: "Aqui manda el amor".' },
  { id: 'mansion', emoji: '🏰', nombre: 'Mansion con jardines', precio: 30000000,
    frase: '{de} abre el enorme portón: "Bienvenido a tu nuevo hogar, {para}". Hasta el mayordomo se emociono.' },
  { id: 'castillo', emoji: '🏯', nombre: 'Castillo de cuento', precio: 40000000,
    frase: 'Torres, puentes levadizos y un trono doble. {de} corona a {para} como monarca de su propio castillo.' },
  { id: 'fuegos', emoji: '🎆', nombre: 'Fuegos artificiales sobre la ciudad', precio: 50000000,
    frase: 'La ciudad entera se detuvo a mirar: el cielo explota en colores y forma "{de} + {para}". ¡Historico!' },
  { id: 'constelacion', emoji: '🌌', nombre: 'Constelacion con tu nombre', precio: 60000000,
    frase: '{de} bautizo una constelacion nueva: "{para}". Desde hoy, cada noche el universo repite su nombre.' },
  { id: 'luna', emoji: '🌙', nombre: 'Un pedacito de la Luna', precio: 70000000,
    frase: '"Te bajaria la luna": y {de} cumplio. Escritura, telescopio y un cachito lunar para {para}.' },
  { id: 'coronareina', emoji: '👑', nombre: 'Corona real', precio: 80000000,
    frase: 'Oro puro y joyas centelleantes. {de} coloca la corona sobre {para} y todo el reino se inclina.' },
  { id: 'estrella', emoji: '⭐', nombre: 'Estrella con tu nombre', precio: 90000000,
    frase: 'Una estrella de verdad, registrada con el nombre de {para}. {de}: "brillaras mas que ella, aun asi".' },
  { id: 'universo', emoji: '🌠', nombre: 'El universo entero', precio: 100000000,
    frase: 'Galaxias, planetas, estrellas, todo. {de} le entrega a {para} el universo completo... y sigue siendo poco comparado con lo que siente.' }
];

// Reacciones de quien recibe, segun lo caro del regalo (se escoge una al azar)
const REACCIONES = {
  chico: [
    '🥰 {para} se sonrojo y escondio la cara entre las manos.',
    '😊 {para} sonrie de oreja a oreja: "¡Que lindo detalle!"',
    '💕 {para} no deja de mirar el regalo con ojitos de corazon.',
    '☺️ {para} lo abrazo fuerte contra el pecho.'
  ],
  medio: [
    '😍 ¡{para} grito de la emocion y salto a abrazar a {de}!',
    '🥹 A {para} se le llenaron los ojos de lagrimas de felicidad.',
    '💖 {para} le dio un beso a {de} que se escucho hasta el otro lado del grupo.',
    '✨ {para}: "¡No me lo creo, esto es hermoso!"'
  ],
  grande: [
    '😭 ¡{para} lloro de la emocion y no puede parar de abrazar a {de}!',
    '🤩 {para} esta temblando: "¿¿En serio?? ¡¡Te pasaste!!"',
    '💘 {para} se quedo sin palabras y solo pudo decir: "Te amo".',
    '🫶 Todos aplauden mientras {para} corre a los brazos de {de}.'
  ],
  legendario: [
    '😱 ¡¡{para} casi se desmaya de la emocion!! {de} corre a sostener esa felicidad entre sus brazos.',
    '🌟 El grupo entero esta llorando: ¡esto es el regalo del siglo! {para} no puede ni hablar.',
    '💞 {para} cae de rodillas llorando de felicidad: "Nadie, NUNCA, me habia amado asi".',
    '🎇 Se escucha una ovacion mundial. {para} abraza a {de} y no se separa de {de} en toda la noche.'
  ]
};

const EFECTOS = {
  chico: '🌸 ✨ 🌸 ✨ 🌸',
  medio: '💖 ✨ 💖 ✨ 💖 ✨ 💖',
  grande: '🎉 🎊 🎉 🎊 🎉 🎊 🎉',
  legendario: '🎆 🎇 ✨ 🎆 🎇 ✨ 🎆 🎇'
};

function nivelDe(precio) {
  if (precio < 10000) return 'chico';
  if (precio < 1000000) return 'medio';
  if (precio < 20000000) return 'grande';
  return 'legendario';
}

module.exports = { REGALOS, REACCIONES, EFECTOS, nivelDe };
