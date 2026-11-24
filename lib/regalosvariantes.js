const FRASES = {
  rosa: [
    '{para} encontró una rosa sobre la almohada con una notita: "Para ti, de {de}". Se le olvidó hasta cómo respirar.',
    'Una sola rosa, roja como un latido. {de} la entregó con la mano temblando y {para} supo que valía más que un jardín entero.',
    'Entre las espinas y los pétalos viajó un "te quiero" que {de} no se atrevía a decir. {para} ya lo escuchó fuerte y claro.'
  ],
  carta: [
    'Tres hojas, tinta azul y una sola idea: {para}. {de} no tachó ni una palabra.',
    '{para} abrió el sobre perfumado y leyó en voz baja... cada línea de {de} le subió el color a las mejillas.',
    'La carta decía: "Si el amor fuera una carta, sería esta". Firma: {de}. {para} la guardó junto al corazón.'
  ],
  paleta: [
    '{de} llegó con una paleta gigante y un "no me derrito si estoy contigo, {para}". Cursi, pero funciona.',
    'Sabor favorito de {para}, envoltura de corazones y una sonrisa de {de}. El dulce más fácil de aceptar.',
    'Una paleta arcoíris para quien le pinta los días de colores a {de}. ¡Gracias, {para}!'
  ],
  abrazo: [
    'Sin trenes ni aviones: {de} mandó un abrazo que cruza pantallas y llega directo al pecho de {para}.',
    '{para} cerró los ojos y casi sintió los brazos de {de} rodeándole. Un abrazo de esos que arreglan el día.',
    'Abrazo de oso panda, con crujido de espalda incluido. {de} no suelta a {para} ni con grúa.'
  ],
  ramo: [
    'Tulipanes, girasoles y rosas: {de} vació la florería para {para}. El vendedor aplaudió.',
    'El ramo era tan grande que {para} tuvo que pedir ayuda para cargarlo. {de} sonríe con orgullo desde atrás.',
    'Cada flor es un motivo por el que {de} quiere a {para}. Faltaron flores.'
  ],
  peluche: [
    '{para} abrazó al pandita y juró no soltarlo jamás... excepto para abrazar a {de}.',
    'Un peluche con moño que dice "{de} te cuida". {para} ya lo bautizó "Bambú".',
    'Suave, redondito y con ojitos tiernos: se parece a {de} cuando se hace el dormido. {para} lo adoptó al instante.'
  ],
  cancion: [
    '🎶 "Eres mi canción favorita, {para}, la que repito sin cansarme". Dedicada con cariño por {de}. 🎶',
    '{de} grabó una canción con voz de karaoke y mucho corazón. {para} la puso en repetir toda la noche.',
    'La melodía sonó suave y la letra decía "{para}" en cada verso. {de} desafinó, pero nadie lo notó.'
  ],
  globos: [
    'Cien globos rojos subieron al cielo con un mensaje: "{para}, te quiero". Firma {de}. El grupo se derritió.',
    '{para} abrió la puerta y la casa estaba llena de globos con corazones. {de} apareció detrás con una sonrisa traviesa.',
    'Globos con helio, globos con confeti, globos con frases de amor... {de} lo planeó todo para {para}.'
  ],
  chocolates: [
    'Cada chocolate trae una nota: "porque eres dulce", "porque me haces reír"... {de} le escribió 12 razones a {para}.',
    'Caja dorada, listón rojo y chocolates rellenos de fresa: {para} ya negoció con {de} quién se queda con la mitad.',
    '{para} probó uno, cerró los ojos y dijo: "esto sabe a ti". {de} casi se desmaya de ternura.'
  ],
  cena: [
    'Velas, copas y un violinista que {de} contrató por sorpresa. {para} no sabe si reír o llorar de la emoción.',
    'La mesa estaba lista y el menú tenía el nombre de {para} en cada platillo. {de} sirvió con la servilleta en el brazo.',
    'Cena para dos con postre compartido y miradas largas. {de} y {para}, la mejor mesa del restaurante.'
  ],
  pastel: [
    'Tres pisos, fresas y una vela que dice "contigo, todos los días son aniversario". {para} sopló y pidió el mismo deseo de siempre: {de}.',
    '{de} horneó el pastel con sus propias manos (y un poquito de ayuda de la pastelería). {para} lo aprecia igual.',
    'El pastel decía "TE AMO" en betún rosa, un poco chueco. {para} lo prefiere mil veces antes que uno perfecto.'
  ],
  serenata: [
    'Trompetas, guitarrón y "Cielito lindo" a todo pulmón. {de} dirigió el mariachi y {para} se asomó al balcón en pijama.',
    'Los vecinos aplauden, los perros ladran y {para} llora de risa: ¡qué serenata la de {de}!',
    'El mariachi tocó la favorita de {para} y {de} se animó a cantar el coro. Desafinó, pero con todo el amor del mundo.'
  ],
  peluchegigante: [
    'El peluche no cupo por la puerta. {para} y {de} lo metieron por la ventana entre risas.',
    '{para} se acostó encima del oso gigante y dijo: "Aquí vivo ahora". {de} aceptó compartir sofá con el peluche.',
    'Un oso del tamaño de un coche con listón al cuello y una tarjeta: "Abrázame cuando extrañes a {de}".'
  ],
  spa: [
    'Albornoz, velas aromáticas y música de olas. {de} dejó a {para} en modo relajación absoluta.',
    'Masaje, mascarilla de pepino y té helado: {para} salió del spa flotando. Gracias, {de}.',
    'Un día completo de mimos que {de} reservó en secreto. {para} no quiere volver a la realidad.'
  ],
  perfume: [
    'Notas de jazmín, vainilla y un toque misterioso. {para} se roció una gota y {de} se quedó con cara de enamorado.',
    'El frasco brilla como cristal fino. {para} lo abrió y toda la sala olió a elegancia. Elección perfecta de {de}.',
    '{de} escogió el aroma durante tres horas en la perfumería. {para} dijo: "huele a nosotros".'
  ],
  collar: [
    'Plata fina con un dije de corazón grabado: "{de} & {para}". {para} lo acarició con los ojos brillosos.',
    '{de} abrochó el collar con cuidado y lo miraron juntos en el espejo: "te queda como si lo hubieran hecho para ti".',
    'Plata pulida, cadena delicada y una promesa: no se lo quitará nunca, dice {para}. {de} sonríe.'
  ],
  picnic: [
    'Sándwiches, fresas con crema y una manta a cuadros bajo las estrellas. {de} y {para} no necesitan nada más.',
    'Luciérnagas, jugo de uva y una playlist suave. {de} armó el picnic y {para} puso la mejor compañía.',
    'Bajo el cielo estrellado, {de} señaló la Osa Mayor y le dijo a {para}: "esa soy yo cuidándote".'
  ],
  playa: [
    'Arena tibia, sombrilla y un atardecer que parece pintado. {de} y {para} dejaron huellas juntas en la orilla.',
    '{de} reservó el bungalow frente al mar. {para} ya empacó el bloqueador y las ganas de no hacer nada.',
    'Olas, coco helado y cero preocupaciones: {de} le regaló a {para} la mejor semana del año.'
  ],
  vestido: [
    'Telas finas, costuras perfectas y un brillo que no pasa desapercibido. {para} se lo probó y el salón se quedó en silencio. {de} solo sonrió.',
    'El diseñador dijo que jamás vio algo igual. {de} lo eligió pensando en {para}, y se nota.',
    'Un atuendo de gala con detalles bordados: {para} dio una vuelta frente al espejo y {de} aplaudió.'
  ],
  globoaero: [
    'La canasta sube lento, el sol se pone y {de} le pregunta a {para}: "¿ves esa nube con forma de corazón?"',
    'Desde las alturas el mundo se ve chiquito y lo único grande es lo que {de} siente por {para}.',
    'Un globo de mil colores, una botella de champaña y el silencio del cielo. {para} se quedó sin palabras.'
  ],
  concierto: [
    'Telón arriba: el artista favorito de {para} apareció solo para ellos. {de} sonrió desde el asiento de al lado.',
    'Luces de neón, bajos retumbando y una canción dedicada a {para} de parte de {de}. La mejor noche del año.',
    'El show privado terminó con un "¡Esto va por {para}!" y una lluvia de confeti. {de} lo planeó todo.'
  ],
  diamante: [
    'El diamante brilló con la luz de la lámpara y {para} se tapó la boca con las dos manos. {de} se arrodilló.',
    'Una cajita de terciopelo, un anillo eterno y una promesa nueva: "Contigo, siempre". {para} dijo sí otra vez.',
    'Tan brillante que {para} tuvo que entrecerrar los ojos. {de}: "Aun así no brilla tanto como tú".'
  ],
  crucero: [
    'Camarote con balcón, bufet infinito y un amanecer en alta mar. {de} y {para} no quieren volver a tierra firme.',
    'El capitán anunció por el altavoz: "Este viaje es cortesía de {de} para {para}". Aplausos en toda la cubierta.',
    'Islas, puertos y bailes bajo la luna. {de} y {para} zarparon rumbo a la aventura.'
  ],
  drones: [
    '500 drones, un solo mensaje: "{para}, ¿otra vez te casarías conmigo?" Firma: {de}. El cielo entero contuvo el aliento.',
    'Los drones formaron un panda gigante con un corazón. {para} grabó video y se lo mostró al mundo entero.',
    'Luces azules y doradas bailaron en el cielo y escribieron "{de} ♥ {para}". Nadie parpadeó.'
  ],
  jet: [
    'Alfombra roja hasta la escalerilla, azafatas con champaña y destino sorpresa. {de} y {para} despegaron riendo.',
    'El piloto saludó: "Bienvenidos a bordo, {para}". {de} lo había planeado todo. Cielo despejado y corazón lleno.',
    'Sillones de cuero, ventanas panorámicas y nubes de algodón. {para} pidió el primer destino: "contigo, a donde sea".'
  ],
  auto: [
    'El motor rugió y {para} no lo podía creer. {de} le lanzó las llaves: "Maneja tú, yo pongo la música".',
    'Rojo brillante, techo abierto y un moño gigante. {para} dio la primera vuelta a la cuadra con {de} de copiloto.',
    'De cero a cien en tres segundos, igual que el corazón de {para} al verlo. Cortesía de {de}.'
  ],
  yate: [
    'Proa afilada, cubierta de madera y un chef a bordo. {de} y {para} brindaron con vista al horizonte.',
    'En el casco brillaba el nombre de {para} en letras doradas. {de} lo presentó con la mano en el pecho.',
    'Brisa salada, champaña y un atardecer dorado. {para} se acomodó en la cubierta y miró a {de}: "esto es vida".'
  ],
  isla: [
    'Palmeras, arena blanca y un cartel en la orilla: "Propiedad de {para}". {de} lo plantó con sus propias manos.',
    'Agua turquesa, hamaca y silencio: la isla de {para} tiene un solo vecino, {de}. Y le cae muy bien.',
    'Una isla, dos hamacas y el mar de testigo. {de} le entregó la escritura a {para} y todo el grupo lloró.'
  ],
  mansion: [
    'Cincuenta habitaciones, alberca y un jardín de película. {para} recorrió la casa de la mano de {de}.',
    'El mayordomo abrió el portón: "Bienvenidos a casa, {para}". {de} dio un paso atrás para ver su cara.',
    'Chimenea, biblioteca y una cocina enorme. {para} eligió la habitación más soleada y {de} firmó las escrituras.'
  ],
  castillo: [
    'Almenas, estandartes y un foso con cisnes. {de} entregó la llave de oro: "Este castillo es tuyo, {para}".',
    'En la sala del trono había dos asientos con sus nombres grabados: {para} y {de}. Reinado compartido.',
    'Dragones de bambú custodian las puertas. {para} se coronó y {de} le juró lealtad eterna.'
  ],
  fuegos: [
    'Cada estallido pintó un corazón distinto y la ciudad entera lo vio. {para} abrazó a {de} bajo el cielo en llamas.',
    'Un cielo de oro, rojo y azul, y un mensaje gigante: "{para}, gracias por existir". Firma: {de}. Histórico.',
    'Las campanas sonaron, la gente aplaudió y {para} lloró de emoción. {de} le apretó la mano con fuerza.'
  ],
  constelacion: [
    'Un telescopio apuntó al cielo y {de} dijo: "Esa nueva constelación se llama {para}". El universo asintió.',
    'Siete estrellas, siete deseos y un nombre: {para}. {de} lo registró en el catálogo estelar con un beso.',
    'Desde esta noche, cada vez que {para} mire arriba verá su nombre escrito con estrellas. Cortesía de {de}.'
  ],
  luna: [
    '"{para} ahora tiene su propio rinconcito en la Luna". Certificado firmado por {de}.',
    'Telescopio, mapa lunar y una bandera con el nombre de {para}. {de} cumplió la promesa de bajarle la luna.',
    'La Luna brilló un poquito más esa noche: ya tiene dueño. {para} la saludó desde el balcón.'
  ],
  coronareina: [
    'Una corona de oro con rubíes y esmeraldas. {de} la colocó con ambas manos y todo el reino se inclinó ante {para}.',
    'Trompetas reales, alfombra roja y un cetro a juego. {para} recibió la corona y un largo aplauso de la corte. Larga vida, dice {de}.',
    'El joyero real tardó un año en pulirla. Cada gema brilla por una razón: {para}. Ofrenda de {de}.'
  ],
  estrella: [
    'Registrada en el catálogo estelar con un certificado dorado: "Estrella {para}". {de} la señaló en el cielo con una sonrisa.',
    'Una estrella a miles de años luz que lleva su nombre. {de} le dijo a {para}: "cuando me extrañes, mírala".',
    'El observatorio dio la noticia: "La estrella {para} ya brilla oficialmente". {de} no podía dejar de sonreír.'
  ],
  universo: [
    'Planetas, soles y galaxias con un solo dueño: {para}. {de} firmó el acta del universo y la selló con un beso.',
    'El cosmos entero se detuvo para escuchar a {de} decir: "Todo esto es tuyo, {para}". Las estrellas aplaudieron.',
    'Agujeros negros, nebulosas y todo lo que existe: regalo de {de} a {para}. Y aún sobra amor para llenar otro universo.'
  ]
};

const REACCIONES_EXTRA = {
  chico: [
    '🥰 {para} sonríe sin poder disimular: "Qué detalle tan bonito, {de}".',
    '😳 Las mejillas de {para} se pusieron rojas como tomate.',
    '🫶 {para} le dio un abrazo corto y muy sincero a {de}.',
    '💗 {para} guardó el regalo como si fuera un tesoro.',
    '😊 {para} le mandó un beso volado a {de}.',
    '🌸 {para} dijo "gracias" con una voz chiquita y mil mariposas en el estómago.',
    '🤭 {para} se rió bajito y se tapó la sonrisa con la mano.',
    '💕 {para} no dejaba de repetir: "¡Qué lindo!".'
  ],
  medio: [
    '😍 {para} se llevó las manos al corazón y no pudo contener las lágrimas.',
    '🥰 {para} le dio un abrazo a {de} que duró más de lo normal.',
    '💞 {para}: "No hacía falta, pero me encanta".',
    '✨ {para} giró de alegría y casi tira todo lo que tenía en las manos.',
    '😘 {para} le llenó la mejilla de besos a {de}.',
    '🥹 {para} susurró: "Eres lo mejor que me ha pasado".',
    '🎶 {para} empezó a tararear de pura felicidad.',
    '💖 El grupo entero hizo "aaaaw" al ver la reacción de {para}.'
  ],
  grande: [
    '🤯 {para} se quedó helado por tres segundos y luego gritó de alegría.',
    '😭 {para} lloró, rió y volvió a llorar. Todo en el mismo minuto.',
    '🫨 Las manos de {para} no paraban de temblar: "¡¿Es en serio, {de}?!"',
    '🥳 {para} bailó por toda la sala y {de} lo siguió con los brazos en alto.',
    '💘 {para} abrazó a {de} tan fuerte que se escuchó un crujido de cariño.',
    '👏 Todo el grupo se puso de pie para aplaudir a {de}.',
    '😮‍💨 {para} tuvo que sentarse para procesar tanta emoción.',
    '❤️‍🔥 {para} mirando a {de}: "Nadie me había querido así".'
  ],
  legendario: [
    '🤯 {para} se quedó sin aire y {de} corrió a abanicarle con un sombrero.',
    '😭 El grupo entero lloró a mares: ¡{de} acaba de hacer historia con {para}!',
    '🌋 La emoción de {para} fue tan grande que tembló el grupo completo.',
    '🏆 {de} acaba de ganar el premio al mejor regalo de la historia. {para} lo confirma con lágrimas.',
    '🌠 {para} miró a {de} y solo pudo decir: "Eres mi universo".',
    '🥂 Todos brindaron por {de} y {para}. Un amor de leyenda.',
    '🔥 {para} gritó tan fuerte que los vecinos preguntaron si todo estaba bien. ¡Más que bien!',
    '👑 {para} abrió los brazos al cielo: "¡Gracias, {de}, por tanto!"'
  ]
};

const ENCABEZADOS = {
  chico: ['🌸 *¡SORPRESA!* 🌸', '💗 *¡UN DETALLITO!* 💗', '🎀 *¡PARA TI!* 🎀', '✨ *¡MIRA LO QUE LLEGÓ!* ✨', '🌷 *¡CON CARIÑO!* 🌷'],
  medio: ['💖 *¡REGALO DE AMOR!* 💖', '💝 *¡UN REGALO CON CORAZÓN!* 💝', '💞 *¡SORPRESA ESPECIAL!* 💞', '🌹 *¡TODO PARA TI!* 🌹', '✨ *¡AMOR EN UNA CAJA!* ✨'],
  grande: ['🎉 *¡REGALAZO DE LUJO!* 🎉', '🎊 *¡NO LO PUEDO CREER!* 🎊', '🥳 *¡SE PASÓ DE GENEROSO!* 🥳', '💥 *¡ESTO ES ENORME!* 💥', '🏅 *¡REGALO DE CAMPEONATO!* 🏅'],
  legendario: ['👑 *¡¡REGALO LEGENDARIO!!* 👑', '🌟 *¡¡HISTORIA PURA!!* 🌟', '🎆 *¡¡EL REGALO DEL SIGLO!!* 🎆', '💎 *¡¡NADIE LO HABÍA HECHO!!* 💎', '🚀 *¡¡FUERA DE ESTE MUNDO!!* 🚀']
};

const PREPARACION = [
  ['Preparando...', 'Envolviendo el regalo...', 'Poniendo el moño...'],
  ['Buscando el regalo perfecto...', 'Escribiendo la tarjetita...', 'Guardando el secreto...'],
  ['Conspirando en silencio...', 'Atando el listón...', 'Revisando que todo brille...']
];

module.exports = { FRASES, REACCIONES_EXTRA, ENCABEZADOS, PREPARACION };
