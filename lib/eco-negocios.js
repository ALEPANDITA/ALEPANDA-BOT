const { claveCanonica } = require('./db');

const MAX_HORAS = 24;
const BONO_PAREJA = 1.5;

const CATEGORIAS = [
  { id: 'comida', emoji: '🍽️', nombre: 'Comida', color: '#f08a3c' },
  { id: 'comercio', emoji: '🛍️', nombre: 'Comercio', color: '#3cb4f0' },
  { id: 'servicios', emoji: '🔧', nombre: 'Servicios', color: '#4ade80' },
  { id: 'diversion', emoji: '🎮', nombre: 'Diversión', color: '#e879f9' },
  { id: 'turismo', emoji: '🏝️', nombre: 'Turismo', color: '#2dd4bf' },
  { id: 'industria', emoji: '🏭', nombre: 'Industria', color: '#a1a1aa' },
  { id: 'tecnologia', emoji: '💻', nombre: 'Tecnología', color: '#818cf8' },
  { id: 'transporte', emoji: '🚚', nombre: 'Transporte', color: '#facc15' },
  { id: 'finanzas', emoji: '🏦', nombre: 'Finanzas', color: '#34d399' },
  { id: 'capital', emoji: '🏙️', nombre: 'Gran Capital', color: '#f472b6' },
  { id: 'elite', emoji: '🌌', nombre: 'Élite Mundial', color: '#a78bfa' },
  { id: 'exclusivas', emoji: '👑', nombre: 'Exclusivas', color: '#fbbf24' }
];

const DATOS = [
  ['comida', 'tacos', '🌮', 'Puesto de tacos', 1500, 'Taquería|Taquería Gourmet', 50],
  ['comida', 'cafeteria', '☕', 'Cafetería', 6000, 'Café Boutique', 210],
  ['comida', 'nieves', '🍦', 'Carrito de nieves', 900, 'Nevería'],
  ['comida', 'elotes', '🌽', 'Puesto de elotes', 1200, 'Esquites Gourmet'],
  ['comida', 'hotdogs', '🌭', 'Carrito de hot dogs', 2200, 'Hot Dog Truck|Franquicia de Dogs'],
  ['comida', 'panaderia', '🥖', 'Panadería', 4500, 'Pastelería Fina'],
  ['comida', 'foodtruck', '🍟', 'Food truck', 7000, 'Flota de Food Trucks'],
  ['comida', 'pizzeria', '🍕', 'Pizzería', 9000, 'Pizzería Napolitana'],
  ['comida', 'cantina', '🍺', 'Cantina', 11000, 'Cervecería Artesanal'],
  ['comida', 'hamburguesas', '🍔', 'Hamburguesería', 14000, 'Burger Gourmet|Cadena de Burgers'],
  ['comida', 'sushi', '🍣', 'Sushi bar', 28000, 'Restaurante Omakase'],
  ['comida', 'restaurante', '🍽️', 'Restaurante', 55000, 'Restaurante de Autor|Restaurante Estrella'],
  ['comida', 'buffet', '🥘', 'Buffet', 90000, 'Buffet Internacional'],
  ['comida', 'pollos', '🍗', 'Pollos fritos', 320000, 'Franquicia Nacional|Franquicia Mundial'],

  ['comercio', 'tiendita', '🏪', 'Tiendita', 2500, 'Minisúper|Supermercado'],
  ['comercio', 'papeleria', '📚', 'Papelería', 3200, 'Librería'],
  ['comercio', 'floreria', '💐', 'Florería', 3800, 'Florería de Bodas'],
  ['comercio', 'carniceria', '🥩', 'Carnicería', 5200, 'Carnes Selectas'],
  ['comercio', 'mascotas', '🐾', 'Tienda de mascotas', 6000, 'Pet Center'],
  ['comercio', 'ropa', '👕', 'Tienda de ropa', 7500, 'Boutique|Tienda Departamental'],
  ['comercio', 'zapateria', '👟', 'Zapatería', 8500, 'Tienda de Sneakers'],
  ['comercio', 'ferreteria', '🔩', 'Ferretería', 12000, 'Home Center'],
  ['comercio', 'muebleria', '🛋️', 'Mueblería', 18000, 'Galería de Muebles'],
  ['comercio', 'farmacia', '💊', 'Farmacia', 24000, 'Farmacia 24 h|Cadena de Farmacias'],
  ['comercio', 'electronica', '📺', 'Tienda de electrónica', 32000, 'Mega Electrónica'],
  ['comercio', 'joyeria', '💍', 'Joyería', 45000, 'Joyería de Lujo|Casa de Diamantes'],
  ['comercio', 'supermercado', '🛒', 'Supermercado', 70000, 'Hipermercado'],
  ['comercio', 'plaza', '🏬', 'Plaza comercial', 260000, 'Mall'],

  ['servicios', 'lavanderia', '🧺', 'Lavandería', 2800, 'Lavandería Express'],
  ['servicios', 'barberia', '💈', 'Barbería', 3500, 'Estética de Lujo'],
  ['servicios', 'autolavado', '🚿', 'Autolavado', 6500, 'Autolavado Premium'],
  ['servicios', 'taller', '🔧', 'Taller mecánico', 9500, 'Taller Especializado|Agencia de Servicio'],
  ['servicios', 'guarderia', '🧸', 'Guardería', 13000, 'Colegio Infantil'],
  ['servicios', 'gimnasio', '🏋️', 'Gimnasio', 15000, 'Gimnasio Premium|Centro Deportivo', 560],
  ['servicios', 'veterinaria', '🐶', 'Veterinaria', 16000, 'Hospital Veterinario'],
  ['servicios', 'escuela', '🏫', 'Escuela de idiomas', 20000, 'Academia Internacional'],
  ['servicios', 'spa', '💆', 'Spa', 36000, 'Spa de Lujo'],
  ['servicios', 'despacho', '⚖️', 'Despacho legal', 52000, 'Bufete Internacional'],
  ['servicios', 'clinica', '🏥', 'Clínica', 80000, 'Hospital|Hospital Especializado'],
  ['servicios', 'notaria', '📜', 'Notaría', 95000, 'Notaría Mayor'],

  ['diversion', 'billar', '🎱', 'Billar', 5000, 'Club de Billar'],
  ['diversion', 'escape', '🔐', 'Cuarto de escape', 6500, 'Escape Park'],
  ['diversion', 'karaoke', '🎤', 'Karaoke', 7000, 'Karaoke Bar|Teatro Musical'],
  ['diversion', 'arcade', '🕹️', 'Arcade', 8000, 'Salón de Videojuegos|Mega Arcade'],
  ['diversion', 'paintball', '🎯', 'Campo de paintball', 14000, 'Parque de Aventura'],
  ['diversion', 'boliche', '🎳', 'Boliche', 22000, 'Boliche Neón'],
  ['diversion', 'teatro', '🎭', 'Teatro', 38000, 'Gran Teatro'],
  ['diversion', 'discoteca', '🪩', 'Discoteca', 48000, 'Club Nocturno|Megaclub'],
  ['diversion', 'cine', '🎬', 'Cine', 60000, 'Cine Premium|Complejo de Cines'],
  ['diversion', 'casino', '🎰', 'Casino', 150000, 'Casino de Lujo|Casino Resort'],
  ['diversion', 'parquediver', '🎡', 'Parque de diversiones', 420000, 'Parque Temático|Resort Temático'],
  ['diversion', 'estadio', '🏟️', 'Estadio', 900000, 'Estadio Olímpico'],

  ['turismo', 'camping', '⛺', 'Camping', 3000, 'Glamping'],
  ['turismo', 'hostal', '🛏️', 'Hostal', 7000, 'Hotel Boutique'],
  ['turismo', 'cabanas', '🏕️', 'Cabañas', 16000, 'Resort de Montaña'],
  ['turismo', 'agencia', '✈️', 'Agencia de viajes', 25000, 'Operadora Turística'],
  ['turismo', 'museo', '🏛️', 'Museo', 70000, 'Museo Nacional'],
  ['turismo', 'hotel', '🏨', 'Hotel', 100000, 'Hotel 5 Estrellas|Hotel Resort', 4100],
  ['turismo', 'hotelplaya', '🏖️', 'Hotel de playa', 250000, 'Resort Todo Incluido'],
  ['turismo', 'acuatico', '🌊', 'Parque acuático', 320000, 'Mega Parque Acuático'],
  ['turismo', 'zoologico', '🦁', 'Zoológico', 380000, 'Safari Park'],
  ['turismo', 'crucero', '🚢', 'Crucero', 650000, 'Crucero de Lujo|Mega Crucero'],

  ['industria', 'carpinteria', '🪚', 'Carpintería', 5500, 'Fábrica de Muebles'],
  ['industria', 'invernadero', '🌱', 'Invernadero', 9000, 'Agricultura Vertical'],
  ['industria', 'granja', '🐄', 'Granja', 12000, 'Rancho Ganadero|Agroindustria'],
  ['industria', 'ladrillera', '🧱', 'Ladrillera', 17000, 'Cementera'],
  ['industria', 'pesquera', '🎣', 'Pesquera', 30000, 'Flota Pesquera'],
  ['industria', 'textil', '🧵', 'Fábrica textil', 38000, 'Corporativo Textil'],
  ['industria', 'embotelladora', '🥤', 'Embotelladora', 85000, 'Planta Refresquera|Multinacional de Bebidas'],
  ['industria', 'mina', '⛏️', 'Mina', 140000, 'Mina Profunda|Complejo Minero'],
  ['industria', 'acereria', '🏭', 'Acería', 280000, 'Siderúrgica'],
  ['industria', 'refineria', '🛢️', 'Refinería', 520000, 'Complejo Petroquímico'],

  ['tecnologia', 'cibercafe', '🖥️', 'Cibercafé', 3500, 'Gaming Center'],
  ['tecnologia', 'celulares', '📱', 'Reparación de celulares', 6000, 'Tienda Tech'],
  ['tecnologia', 'apps', '📲', 'Estudio de apps', 40000, 'Software House|Startup Unicornio'],
  ['tecnologia', 'hosting', '🌐', 'Hosting', 75000, 'Centro de Datos'],
  ['tecnologia', 'ciberseguridad', '🛡️', 'Ciberseguridad', 110000, 'Gigante de Seguridad'],
  ['tecnologia', 'videojuegos', '👾', 'Estudio de videojuegos', 160000, 'Estudio AAA|Publisher Mundial'],
  ['tecnologia', 'streaming', '📡', 'Plataforma de streaming', 220000, 'Streaming Global'],
  ['tecnologia', 'robotica', '🤖', 'Laboratorio de robótica', 350000, 'Corporativo de Robótica'],
  ['tecnologia', 'ia', '🧠', 'Laboratorio de IA', 600000, 'Megacorp de IA'],
  ['tecnologia', 'satelites', '🛰️', 'Empresa satelital', 800000, 'Constelación Satelital'],

  ['transporte', 'bicitaxis', '🛺', 'Bicitaxis', 2000, 'Mototaxis'],
  ['transporte', 'taxis', '🚕', 'Taxis', 10000, 'Flota de Taxis|Empresa de Movilidad'],
  ['transporte', 'camiones', '🚛', 'Transportista', 34000, 'Logística Nacional'],
  ['transporte', 'gasolinera', '⛽', 'Gasolinera', 40000, 'Estación Premium|Complejo de Servicios', 1550],
  ['transporte', 'paqueteria', '📦', 'Paquetería', 48000, 'Mensajería Express|Logística Global'],
  ['transporte', 'autobuses', '🚌', 'Autobuses', 65000, 'Autobuses Foráneos'],
  ['transporte', 'tren', '🚆', 'Ferrocarril', 400000, 'Tren Bala'],
  ['transporte', 'puerto', '⚓', 'Puerto', 550000, 'Puerto Comercial'],
  ['transporte', 'aerolinea', '🛩️', 'Aerolínea pequeña', 700000, 'Aerolínea Regional|Aerolínea Internacional'],

  ['finanzas', 'empeno', '🪙', 'Casa de empeño', 9000, 'Financiera'],
  ['finanzas', 'cambio', '💱', 'Casa de cambio', 20000, 'Casa de Cambio Internacional'],
  ['finanzas', 'inmobiliaria', '🏘️', 'Inmobiliaria', 65000, 'Grupo Inmobiliario|Desarrolladora Mundial'],
  ['finanzas', 'seguros', '📋', 'Aseguradora', 85000, 'Aseguradora Global'],
  ['finanzas', 'cripto', '₿', 'Mina de cripto', 120000, 'Exchange de Cripto'],
  ['finanzas', 'bancolocal', '🏦', 'Banco local', 300000, 'Banco Nacional|Banco Internacional'],
  ['finanzas', 'bolsa', '📈', 'Casa de bolsa', 480000, 'Fondo de Inversión'],
  ['finanzas', 'holding', '💼', 'Fondo de capital', 750000, 'Holding Global'],

  ['capital', 'isla', '🏝️', 'Isla privada', 180000000, 'Isla Resort'],
  ['capital', 'rascacielos', '🏙️', 'Rascacielos', 220000000, 'Torre Corporativa|Complejo de Torres'],
  ['capital', 'megamall', '🛍️', 'Mega Mall Internacional', 260000000, 'Mall de Mega Marcas'],
  ['capital', 'aeropuerto', '🛫', 'Aeropuerto privado', 320000000, 'Hub Aéreo Mundial'],
  ['capital', 'puertomundial', '🚢', 'Puerto Mundial', 410000000, 'Puerto Global'],
  ['capital', 'espacial', '🚀', 'Programa espacial', 600000000, 'Base Lunar|Colonia Marciana'],
  ['capital', 'ciudad', '🌆', 'Ciudad inteligente', 800000000, 'Metrópoli'],
  ['capital', 'conglomerado', '🏢', 'Conglomerado', 1200000000, 'Conglomerado Mundial']
];

const EXCLUSIVAS = [
  ['jugueteria', '🧸', 'Tienda de Juguetes|Juguetería Grande|Mega Juguetería|Parque de Juguetes|Imperio del Juguete', 60000000],
  ['tiendabarrio', '🏪', 'Tienda del Barrio|Minisúper|Supermercado|Hipermercado|Corporativo Comercial', 45000000],
  ['fondalegendaria', '🍲', 'Fonda Legendaria|Restaurante Legendario|Restaurante Michelin|Cadena Michelin|Imperio Gastronómico', 90000000],
  ['cinedeluxe', '🎬', 'Cine de Barrio|Complejo de Cines|Estudio de Cine|Productora Global|Imperio del Cine', 180000000],
  ['hotelmirador', '🏨', 'Hotel Mirador|Hotel de Lujo|Gran Resort|Hotel Palacio|Palacio Real', 250000000],
  ['casinodorado', '🎰', 'Casino Dorado|Casino Resort|Mega Resort|Ciudad del Juego|Capital del Juego', 300000000],
  ['clubfutbol', '⚽', 'Club Local|Club Profesional|Club de Primera|Club Campeón|Club Galáctico', 350000000],
  ['santuariopanda', '🐼', 'Santuario Panda|Reserva de Pandas|Parque Nacional Panda|Imperio Panda|Reino Panda Mundial', 400000000],
  ['castillo', '🏰', 'Castillo Antiguo|Castillo Restaurado|Castillo-Hotel|Reino Turístico|Reino Eterno', 500000000],
  ['minadiamantes', '💎', 'Mina de Diamantes|Mina Profunda|Complejo Diamantino|Corporación Diamantina|Imperio de Diamantes', 700000000],
  ['pozopetrolero', '🛢️', 'Pozo Petrolero|Campo Petrolero|Refinería Estatal|Holding Petrolero|Emirato del Petróleo', 800000000],
  ['cohetes', '🌠', 'Taller de Cohetes|Agencia Espacial|Puerto Espacial|Base Interplanetaria|Colonia Marciana', 1000000000]
];


// PARCHE-ELITE: 50 negocios mucho más caros que la Gran Capital (de 2 mil millones a 450 mil millones)
const DATOS_ELITE = [
  ['archipielago', '🏝️', 'Archipiélago Privado|Archipiélago Resort|Nación Isleña', 2.0],
  ['esqui', '⛷️', 'Resort de Esquí Alpino|Complejo Alpino|Capital Invernal', 2.4],
  ['yates', '🛥️', 'Astillero de Yates|Flota de Megayates|Imperio Naval', 2.8],
  ['vinedos', '🍷', 'Viñedos Reales|Bodegas Mundiales|Imperio Vinícola', 3.3],
  ['parquetech', '🔬', 'Parque Tecnológico|Valle Tecnológico Propio|Capital Tecnológica', 3.8],
  ['biomedica', '💉', 'Farmacéutica Global|Laboratorios Mundiales|Corporativo Biomédico', 4.4],
  ['escuderia', '🏎️', 'Escudería de Fórmula 1|Campeonato Mundial de Autos|Imperio del Motor', 5.0],
  ['canal', '🚢', 'Canal Interoceánico|Red de Canales|Ruta Marítima Mundial', 5.7],
  ['hidroelectrica', '⚡', 'Hidroeléctrica|Red Eléctrica Nacional|Gigante Energético', 6.5],
  ['solar', '☀️', 'Granja Solar|Desierto Solar|Matriz Energética Global', 7.5],
  ['reactor', '☢️', 'Central Nuclear|Complejo Nuclear Avanzado|Red Nuclear Mundial', 8.5],
  ['universidad', '🎓', 'Universidad Privada|Red de Universidades|Imperio Educativo', 10],
  ['hospitales', '🏥', 'Red de Hospitales|Sistema de Salud Privado|Corporación Médica Mundial', 11],
  ['tvglobal', '📺', 'Cadena de TV|Red de Medios Global|Imperio Mediático', 12.5],
  ['olimpiadas', '🥇', 'Comité Deportivo|Juegos Mundiales|Organización Olímpica', 14],
  ['bancoprivado', '🏛️', 'Banco Privado|Banca Mayor Internacional|Reserva Mundial', 16],
  ['moda', '👗', 'Casa de Moda|Grupo de Lujo|Imperio del Lujo', 18],
  ['automotriz', '🚗', 'Fábrica de Autos|Automotriz Global|Gigante Automotriz', 22],
  ['aviones', '🛩️', 'Fábrica de Aviones|Aeroespacial Mundial|Imperio Aeronáutico', 25],
  ['hyperloop', '🚄', 'Red de Trenes Magnéticos|Hyperloop Continental|Red Hyperloop Mundial', 28],
  ['telecom', '📡', 'Telecomunicaciones|Operador Global|Red Telecom Planetaria', 31],
  ['redsocial', '📱', 'Red Social Global|Metaverso|Universo Digital', 35],
  ['chips', '🔌', 'Fábrica de Chips|Gigafábrica de Semiconductores|Monopolio de Chips', 39],
  ['cuantica', '🧬', 'Centro de IA Cuántica|Supercomputadora Cuántica|Cerebro Global', 43],
  ['boveda', '🪙', 'Reservas de Oro|Bóveda Mundial|Tesoro Planetario', 48],
  ['litio', '🔋', 'Minas de Litio|Gigafábrica de Baterías|Imperio de Baterías', 53],
  ['agua', '💧', 'Desalinizadora|Red Hídrica|Dueño del Agua', 58],
  ['granero', '🌾', 'Agroindustria Continental|Granero Mundial|Imperio Alimentario', 64],
  ['navieras', '🛳️', 'Flota de Cruceros|Naviera Mundial|Imperio Marítimo', 70],
  ['parquesmundo', '🎢', 'Parques Mundiales|Reino de la Diversión|Imperio del Entretenimiento', 76],
  ['hotellunar', '🌙', 'Hotel Lunar|Ciudad Lunar|Colonia Lunar Próspera', 83],
  ['asteroides', '☄️', 'Minería de Asteroides|Flota Minera Espacial|Imperio Cósmico', 90],
  ['orbital', '🛰️', 'Estación Orbital|Hub Orbital|Ciudad Orbital', 98],
  ['marte', '🔴', 'Base Marciana|Ciudad Marciana|Planeta Propio', 107],
  ['bancomundial', '💰', 'Banco Mundial Privado|Sistema Financiero Propio|Sistema Financiero Global', 117],
  ['drones', '🚁', 'Logística Aérea Autónoma|Red Global de Drones|Cielo Automatizado', 128],
  ['submarina', '🌊', 'Ciudad Submarina|Metrópoli Oceánica|Atlántida Moderna', 140],
  ['fusion', '🌞', 'Planta de Fusión|Red de Fusión Global|Sol Artificial', 153],
  ['ascensor', '🛗', 'Ascensor Espacial|Anillo Orbital|Puerta a las Estrellas', 167],
  ['terraforma', '🌍', 'Terraformación|Ingeniería Planetaria|Arquitectos de Mundos', 182],
  ['dyson', '🌟', 'Enjambre Solar|Mega Estructura Solar|Esfera Cósmica', 198],
  ['puertoestelar', '⭐', 'Puerto Estelar|Flota Interestelar|Imperio Estelar', 216],
  ['galactico', '🌌', 'Corporación Galáctica|Federación Comercial|Imperio Galáctico', 236],
  ['dimensional', '🌀', 'Laboratorio Dimensional|Portal Dimensional|Multiverso Corp', 258],
  ['tiempo', '⏳', 'Instituto Temporal|Banco del Tiempo|Señor del Tiempo', 282],
  ['cumulo', '🪐', 'Cúmulo de Planetas|Sistema Estelar|Galaxia Privada', 310],
  ['infinito', '♾️', 'Fondo Infinito|Fondo Eterno|Tesoro del Infinito', 340],
  ['omega', '🔱', 'Consorcio Omega|Dominio Omega|Trono Omega', 375],
  ['cosmos', '🌠', 'Dueño del Cosmos|Arquitecto del Universo|Soberano del Cosmos', 410],
  ['absoluto', '👑', 'Poder Absoluto|Monarquía Cósmica|Dominio Absoluto', 450]
];

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ratio = (precio) => 26 + 5 * Math.max(0, Math.log10(precio / 1e4));

const PLAN_NORMAL = { 1: [{ costo: 0.7, mult: 1.7 }], 2: [{ costo: 0.6, mult: 1.6 }, { costo: 1.0, mult: 2.4 }] };
const PLAN_EXCLUSIVA = [{ costo: 0.5, mult: 1.5 }, { costo: 0.8, mult: 2.1 }, { costo: 1.2, mult: 2.9 }, { costo: 2.0, mult: 4.0 }];

function armar({ id, cat, emoji, nombres, precio, horaFija, tipo, par }) {
  const hora0 = horaFija || Math.max(1, Math.round(precio / ratio(precio)));
  const plan = tipo === 'exclusiva' ? PLAN_EXCLUSIVA : (PLAN_NORMAL[nombres.length - 1] || []);
  const etapas = [{ nombre: nombres[0], hora: hora0, costo: 0 }];
  plan.forEach((p, i) => etapas.push({ nombre: nombres[i + 1], hora: Math.round(hora0 * p.mult), costo: Math.round(precio * p.costo) }));
  return {
    id, cat, emoji, nombre: nombres[0], tipo, precio, par: !!par,
    salida: tipo === 'exclusiva' ? Math.round(precio * 0.5) : precio,
    hora: hora0, etapas, maxNivel: etapas.length - 1
  };
}

const normales = DATOS.map((d, i) => armar({
  id: d[1], cat: d[0], emoji: d[2], nombres: [d[3], ...(d[5] ? d[5].split('|') : [])], precio: d[4], horaFija: d[6], tipo: 'normal',
  par: i % 5 === 0 || i % 5 === 2
}));
const exclusivas = EXCLUSIVAS.map((d) => armar({ id: d[0], cat: 'exclusivas', emoji: d[1], nombres: d[2].split('|'), precio: d[3], tipo: 'exclusiva', par: false }));

const ANTIGUAS = ['tacos', 'cafeteria', 'gimnasio', 'gasolinera', 'hotel'];

const elite = DATOS_ELITE.map((d, i) => armar({
  id: d[0], cat: 'elite', emoji: d[1], nombres: d[2].split('|'), precio: Math.round(d[3] * 1e9), tipo: 'normal', par: i % 5 === 0 || i % 5 === 2
}));
// MISIONES-EXTRA: 3 categorías, 22 exclusivas y 3 súper exclusivas al FINAL (los números viejos no cambian)
const EXTRA = require('./negocios-extra');
CATEGORIAS.push(...EXTRA.CATEGORIAS);
const NEGOCIOS_BASE = [
  ...ANTIGUAS.map((id) => normales.find((n) => n.id === id)),
  ...normales.filter((n) => !ANTIGUAS.includes(n.id)),
  ...exclusivas,
  ...elite
];
const NEGOCIOS = [...NEGOCIOS_BASE, ...EXTRA.construir(armar, NEGOCIOS_BASE, BONO_PAREJA)];
NEGOCIOS.forEach((n, i) => { n.num = i + 1; });
const POR_ID = Object.fromEntries(NEGOCIOS.map((n) => [n.id, n]));

const propios = (u) => (Array.isArray(u.negocios) ? [...new Set(u.negocios.filter((id) => POR_ID[id]))] : []);
const nivelDe = (u, id) => {
  const n = POR_ID[id];
  const v = Number(u && u.negocioNiveles && u.negocioNiveles[id]) || 0;
  return n ? Math.max(0, Math.min(n.maxNivel, v)) : 0;
};

function parejaDe(db, u) {
  if (!db || !db.usuarios || !u || !u.pareja) return null;
  const s = db.usuarios[claveCanonica(db, u.pareja)];
  if (!s || !s.pareja) return null;
  if (u.negocioCompartir === false || s.negocioCompartir === false) return null;
  return s;
}

function inventario(u, db) {
  const s = parejaDe(db, u);
  const mapa = new Map();
  for (const id of propios(u)) mapa.set(id, { n: POR_ID[id], nivel: nivelDe(u, id), mio: true, suyo: false });
  if (s) {
    for (const id of propios(s)) {
      const e = mapa.get(id);
      const nv = nivelDe(s, id);
      if (e) { e.suyo = true; e.nivel = Math.max(e.nivel, nv); } else mapa.set(id, { n: POR_ID[id], nivel: nv, mio: false, suyo: true });
    }
  }
  const items = [...mapa.values()].map((e) => {
    const ambos = e.mio && e.suyo;
    const bono = ambos && e.n.par;
    const base = e.n.etapas[e.nivel].hora;
    return { ...e, ambos, bono, base, hora: Math.round(base * (bono ? BONO_PAREJA : 1)), nombre: e.n.etapas[e.nivel].nombre };
  });
  return { items, compartido: !!s, pareja: s };
}

const ingresoPorHora = (u, db) => inventario(u, db).items.reduce((t, e) => t + e.hora, 0);

// ---- Multiplicadores: u.multiplicadores = [{ mult, desde, hasta, fuente }] y db.multiplicadorGlobal = { mult, desde, hasta }
// Valen solo desde que se activan (no cambian lo ya juntado) y se multiplican entre sí.
function eventosMult(db, u) {
  const l = Array.isArray(u && u.multiplicadores) ? u.multiplicadores.slice() : [];
  const g = db && db.multiplicadorGlobal;
  if (g && g.mult) l.push(g);
  return l.filter((e) => e && Number(e.mult) > 0 && Number(e.hasta) > Number(e.desde));
}
function multEn(eventos, t) {
  let m = 1;
  for (const e of eventos) if (e.desde <= t && t < e.hasta) m *= Number(e.mult);
  return Math.min(m, 1e6);
}
function horasEfectivas(db, u, desde, hasta) {
  if (!(hasta > desde)) return 0;
  const ev = eventosMult(db, u);
  const pts = new Set([desde, hasta]);
  for (const e of ev) { if (e.desde > desde && e.desde < hasta) pts.add(e.desde); if (e.hasta > desde && e.hasta < hasta) pts.add(e.hasta); }
  const o = [...pts].sort((a, b) => a - b);
  let h = 0;
  for (let i = 0; i < o.length - 1; i++) h += ((o[i + 1] - o[i]) / 3600000) * multEn(ev, (o[i] + o[i + 1]) / 2);
  return h;
}
const multiplicadorAhora = (db, u, ahora = Date.now()) => multEn(eventosMult(db, u), ahora);
const multiplicadorHasta = (db, u, ahora = Date.now()) => {
  const act = eventosMult(db, u).filter((e) => e.desde <= ahora && ahora < e.hasta && Number(e.mult) !== 1);
  return act.length ? Math.max(...act.map((e) => e.hasta)) : 0;
};
function podarMult(u, ahora = Date.now()) {
  if (!Array.isArray(u.multiplicadores)) return;
  const corte = Math.min(Number(u.negocioCobro) || ahora, ahora);
  u.multiplicadores = u.multiplicadores.filter((e) => e && Number(e.hasta) > corte);
}

function porCobrar(u, db, ahora = Date.now()) {
  const desde = Number(u.negocioCobro) || ahora;
  const fin = Math.min(ahora, desde + MAX_HORAS * 3600000);
  return Math.floor((Number(u.negocioPendiente) || 0) + horasEfectivas(db, u, desde, fin) * ingresoPorHora(u, db));
}

function fijar(db, u, ahora = Date.now()) {
  const s = parejaDe(db, u);
  for (const x of [u, s]) {
    if (!x) continue;
    x.negocioPendiente = porCobrar(x, db, ahora);
    x.negocioCobro = ahora;
  }
}

function buscarNegocio(texto) {
  const t = sinAcentos(texto);
  if (!t) return null;
  if (/^\d+$/.test(t)) return NEGOCIOS[Number(t) - 1] || null;
  return NEGOCIOS.find((n) => n.id === t)
    || NEGOCIOS.find((n) => n.etapas.some((e) => sinAcentos(e.nombre) === t))
    || NEGOCIOS.find((n) => sinAcentos(n.nombre).includes(t) || n.etapas.some((e) => sinAcentos(e.nombre).includes(t)))
    || null;
}

function buscarCategoria(texto) {
  const t = sinAcentos(texto);
  if (!t) return null;
  if (['exclusiva', 'exclusivas', 'subasta', 'subastas'].includes(t)) return CATEGORIAS.find((c) => c.id === 'exclusivas');
  if (['elite', 'élite', 'mundial', 'elitemundial', 'elite mundial', 'imperio', 'imperios'].includes(t)) return CATEGORIAS.find((c) => c.id === 'elite');
  if (['capital', 'gran', 'grancapital', 'gran capital', 'caras'].includes(t)) return CATEGORIAS.find((c) => c.id === 'capital');
  return CATEGORIAS.find((c) => c.id === t || sinAcentos(c.nombre) === t || sinAcentos(c.nombre).startsWith(t)) || null;
}

function comprar(db, u, llave, n, ahora = Date.now()) {
  if (n.tipo === 'exclusiva') return { error: 'exclusiva' };
  if (propios(u).includes(n.id)) return { error: 'ya' };
  const saldo = Number(u.saldo) || 0;
  if (saldo < n.precio) return { error: 'saldo', saldo };
  fijar(db, u, ahora);
  u.negocios = [...propios(u), n.id];
  u.saldo = saldo - n.precio;
  return { saldo: u.saldo, hora: ingresoPorHora(u, db), cantidad: propios(u).length };
}

function mejorar(db, u, llave, n, ahora = Date.now()) {
  if (!propios(u).includes(n.id)) return { error: 'noTienes' };
  if (n.tipo === 'exclusiva' && (db.propiedadesUnicas || {})[n.id] !== llave && !(Array.isArray(u.negocioCopias) && u.negocioCopias.includes(n.id))) return { error: 'noTienes' }; // PARCHE-COPIAS
  const nivel = nivelDe(u, n.id);
  if (nivel >= n.maxNivel) return { error: 'maximo', nivel };
  const etapa = n.etapas[nivel + 1];
  const saldo = Number(u.saldo) || 0;
  if (saldo < etapa.costo) return { error: 'saldo', saldo, costo: etapa.costo };
  fijar(db, u, ahora);
  u.negocioNiveles = { ...(u.negocioNiveles || {}), [n.id]: nivel + 1 };
  u.saldo = saldo - etapa.costo;
  return { saldo: u.saldo, nivel: nivel + 1, etapa, anterior: n.etapas[nivel], hora: ingresoPorHora(u, db) };
}

function resumen(u, db, ahora = Date.now()) {
  const inv = inventario(u, db);
  const base = inv.items.reduce((t, e) => t + e.hora, 0);
  const mult = multiplicadorAhora(db, u, ahora);
  const porHora = Math.round(base * mult);
  return {
    inv, porHora, base, mult, multHasta: multiplicadorHasta(db, u, ahora), en24: Math.floor(porHora * MAX_HORAS), porCobrar: porCobrar(u, db, ahora),
    bonos: inv.items.filter((e) => e.bono).length, cantidad: inv.items.length, total: NEGOCIOS.length
  };
}

module.exports = {
  NEGOCIOS, CATEGORIAS, POR_ID, MAX_HORAS, BONO_PAREJA, propios, nivelDe, parejaDe, inventario, ingresoPorHora, porCobrar, fijar, horasEfectivas, multiplicadorAhora, multiplicadorHasta, podarMult,
  buscarNegocio, buscarCategoria, comprar, mejorar, resumen, sinAcentos
};

// MISIONES-EXTRA
