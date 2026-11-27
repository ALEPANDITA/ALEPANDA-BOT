// Negocios extra: 3 categorías nuevas (Deportes, Arte y Medios, Ciencia y Salud), 22 exclusivas nuevas y 3 SÚPER exclusivas
// que dan más dinero por hora que cualquier otra propiedad. Se agregan AL FINAL de la lista (los números de las
// propiedades que ya existen no cambian). Se conecta con 3 líneas en lib/eco-negocios.js
const CATEGORIAS = [
  { id: 'deportes', emoji: '🏅', nombre: 'Deportes', color: '#fb7185' },
  { id: 'arte', emoji: '🎨', nombre: 'Arte y Medios', color: '#fb923c' },
  { id: 'ciencia', emoji: '🔬', nombre: 'Ciencia y Salud', color: '#22d3ee' }
];

// [categoria, id, emoji, nombre, precio, 'mejora 1|mejora 2']
const DATOS = [
  ['deportes', 'canchafut', '⚽', 'Cancha de fut rápido', 4200, 'Complejo Deportivo'],
  ['deportes', 'tiendadeporte', '🏀', 'Tienda deportiva', 6800, 'Megatienda Deportiva'],
  ['deportes', 'alberca', '🏊', 'Alberca pública', 11000, 'Club Acuático'],
  ['deportes', 'padel', '🎾', 'Canchas de pádel', 19000, 'Club de Tenis y Pádel'],
  ['deportes', 'boxeo', '🥊', 'Gimnasio de box', 27000, 'Academia de Campeones'],
  ['deportes', 'pistakarts', '🏁', 'Pista de karts', 46000, 'Autódromo Local|Autódromo Internacional'],
  ['deportes', 'arenalucha', '🤼', 'Arena de lucha libre', 85000, 'Arena Mundial'],
  ['deportes', 'ligaesports', '🎮', 'Liga de esports', 210000, 'Liga Profesional|Liga Mundial'],
  ['deportes', 'estadiobeis', '⚾', 'Estadio de béisbol', 480000, 'Liga Mayor'],
  ['deportes', 'complejoolimp', '🏆', 'Complejo olímpico', 2500000, 'Villa Olímpica'],

  ['arte', 'galeria', '🖼️', 'Galería de arte', 5200, 'Galería Internacional'],
  ['arte', 'tatuajes', '🖋️', 'Estudio de tatuajes', 7800, 'Estudio de Autor'],
  ['arte', 'imprenta', '🖨️', 'Imprenta', 13000, 'Editorial'],
  ['arte', 'radio', '📻', 'Estación de radio', 24000, 'Cadena de Radio'],
  ['arte', 'fotografia', '📷', 'Estudio fotográfico', 33000, 'Agencia de Fotografía'],
  ['arte', 'grabacion', '🎹', 'Estudio de grabación', 58000, 'Disquera'],
  ['arte', 'periodico', '📰', 'Periódico local', 95000, 'Grupo Periodístico'],
  ['arte', 'productora', '🎞️', 'Productora de cine', 330000, 'Estudio de Hollywood'],
  ['arte', 'orquesta', '🎻', 'Orquesta sinfónica', 620000, 'Sala de Conciertos Mundial'],
  ['arte', 'conciertos', '🎤', 'Promotora de conciertos', 1800000, 'Gira Mundial'],

  ['ciencia', 'dentista', '🦷', 'Consultorio dental', 6000, 'Clínica Dental Premium'],
  ['ciencia', 'optica', '👓', 'Óptica', 8500, 'Cadena de Ópticas'],
  ['ciencia', 'labclinico', '🧪', 'Laboratorio clínico', 17000, 'Laboratorio Nacional'],
  ['ciencia', 'fisio', '🩺', 'Centro de fisioterapia', 26000, 'Centro de Rehabilitación'],
  ['ciencia', 'nutricion', '🥗', 'Centro de nutrición', 34000, 'Clínica del Bienestar'],
  ['ciencia', 'planetario', '🪐', 'Planetario', 72000, 'Museo de Ciencias'],
  ['ciencia', 'cirugia', '🏥', 'Clínica de cirugía estética', 150000, 'Hospital de Especialidades'],
  ['ciencia', 'biotech', '🧬', 'Startup biotecnológica', 410000, 'Farmacéutica Local'],
  ['ciencia', 'investigacion', '🔭', 'Centro de investigación', 900000, 'Instituto Nacional'],
  ['ciencia', 'genetica', '🧫', 'Laboratorio genético', 4000000, 'Centro de Longevidad']
];

// [id, emoji, '5 nombres (el 1.º y 4 mejoras)', precio]
const EXCLUSIVAS = [
  ['cafeteriaoro', '☕', 'Café Dorado|Cafetería de Autor|Tostadores Reales|Cadena Cafetera Mundial|Imperio del Café', 1.5e9],
  ['acuario', '🐠', 'Acuario Mágico|Acuario Nacional|Oceanario Mundial|Reino Marino|Imperio Oceánico', 1.8e9],
  ['circo', '🎪', 'Circo Ambulante|Gran Circo|Circo del Sol Naciente|Gira Mundial|Imperio del Espectáculo', 2.2e9],
  ['biblioteca', '📚', 'Biblioteca Antigua|Biblioteca Mayor|Archivo Eterno|Red de Bibliotecas|Biblioteca Infinita', 2.8e9],
  ['carnaval', '🎭', 'Carnaval Local|Carnaval Nacional|Gran Festival|Festival Mundial|Capital del Carnaval', 3.5e9],
  ['observatorio', '🔭', 'Observatorio|Gran Observatorio|Red de Telescopios|Centro Astronómico|Ojo del Universo', 4.5e9],
  ['faro', '🗼', 'Faro Antiguo|Faro Real|Torre de Señales|Gran Puerto de Luz|Guardián de los Mares', 5.5e9],
  ['dojo', '🥋', 'Dojo del Barrio|Academia Marcial|Escuela de Maestros|Orden Marcial|Templo Supremo', 7e9],
  ['jardinbotanico', '🌺', 'Jardín Botánico|Jardín Nacional|Parque de Orquídeas|Paraíso Floral|Edén Botánico', 8.5e9],
  ['tesoropirata', '🏴‍☠️', 'Barco Pirata|Flota Pirata|Isla del Tesoro|Reino Pirata|Imperio Corsario', 1e10],
  ['templo', '⛩️', 'Templo Sagrado|Santuario Mayor|Monasterio Eterno|Orden Sagrada|Capital Espiritual', 1.2e10],
  ['volcan', '🌋', 'Volcán Turístico|Parque Volcánico|Geoparque Mundial|Reserva Ígnea|Corazón de la Tierra', 1.4e10],
  ['ruinas', '🏺', 'Excavación Antigua|Museo Arqueológico|Gran Expedición|Instituto de Misterios|Legado Ancestral', 1.7e10],
  ['sellomusical', '🎼', 'Sello Independiente|Disquera Mayor|Sello Mundial|Imperio Musical|Dueño de la Música', 2e10],
  ['zeppelin', '🎈', 'Globo Aerostático|Flota de Dirigibles|Aerolínea de Zepelines|Armada de los Cielos|Ciudad Flotante', 2.4e10],
  ['palaciohielo', '❄️', 'Palacio de Hielo|Ciudad Polar|Reino Polar|Imperio Glacial|Trono de Hielo', 2.9e10],
  ['mundoanime', '🎌', 'Tienda Otaku|Convención Anime|Estudio Anime|Imperio del Anime|Universo Anime', 3.5e10],
  ['selva', '🌴', 'Reserva Selvática|Parque Amazónico|Pulmón del Planeta|Imperio Verde|Jardín del Edén', 4.2e10],
  ['piramide', '🔺', 'Pirámide Moderna|Gran Pirámide|Complejo Faraónico|Reino Faraónico|Eternidad Dorada', 5.2e10],
  ['estrellapop', '🎤', 'Escuela de Talentos|Agencia de Estrellas|Industria Pop|Imperio del Pop|Dueño de la Fama', 6.5e10],
  ['platillos', '🛸', 'Taller de Platillos|Base Alienígena|Puerto Extraterrestre|Embajada Cósmica|Alianza Galáctica', 8e10],
  ['guaridadragon', '🐉', 'Cueva del Dragón|Guarida Draconiana|Reino de Dragones|Imperio Draconiano|Trono del Dragón', 1.1e11]
];

// Las 3 SÚPER exclusivas: al nivel máximo dan más por hora que cualquier otra propiedad (se calcula solo)
const SUPER = [
  ['manantial', '💠', 'Cofre Misterioso|Cofre Real|Tesoro Eterno|Fuente de Riquezas|Manantial Infinito', 1.5e12, 1.03],
  ['midas', '🏆', 'Toque Dorado|Mano de Midas|Reino Dorado|Imperio de Midas|Rey Midas Eterno', 2.5e12, 1.08],
  ['singularidad', '🕳️', 'Anomalía|Agujero Dorado|Horizonte de Sucesos|Singularidad Económica|Fin de la Escasez', 4e12, 1.15]
];

const horaMax = (n, bono) => n.etapas[n.maxNivel].hora * (n.par ? bono : 1);

// armar = la función armar() de eco-negocios; previos = todas las propiedades que ya existen; bono = BONO_PAREJA
function construir(armar, previos, bono) {
  const normales = DATOS.map((d, i) => armar({
    id: d[1], cat: d[0], emoji: d[2], nombres: [d[3], ...(d[5] ? d[5].split('|') : [])], precio: d[4], tipo: 'normal',
    par: i % 5 === 0 || i % 5 === 2
  }));
  const comunes = EXCLUSIVAS.map((d) => armar({ id: d[0], cat: 'exclusivas', emoji: d[1], nombres: d[2].split('|'), precio: d[3], tipo: 'exclusiva', par: false }));
  const techo = Math.max(...[...previos, ...normales, ...comunes].map((n) => horaMax(n, bono)));
  const supers = SUPER.map((d) => {
    const objetivo = Math.ceil(techo * d[4]);
    return armar({ id: d[0], cat: 'exclusivas', emoji: d[1], nombres: d[2].split('|'), precio: d[3], horaFija: Math.ceil(objetivo / 4), tipo: 'exclusiva', par: false });
  });
  return [...normales, ...comunes, ...supers];
}

module.exports = { CATEGORIAS, DATOS, EXCLUSIVAS, SUPER, construir };
