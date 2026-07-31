# ⚡ ALEPANDA BOT

Bot de WhatsApp multipropósito: descargas, economía, casino, gacha de personajes, moderación y más.

Creado por **ALEPANDITA**.

## 📱 Instalación en Termux

**1. Prepara Termux**
```bash
pkg update && pkg upgrade -y
pkg install git nodejs -y
```

**2. Descarga el bot**
```bash
git clone https://github.com/ALEPANDITA/ALEPANDA-BOT.git
cd ALEPANDA-BOT
```

**3. Instala las dependencias**
```bash
npm install
```

**4. Enciende el bot y vincula tu WhatsApp**
```bash
npm start
```
(también funciona `node index.js`, hace lo mismo)

Elige código QR o código de 8 dígitos, y vincula desde WhatsApp → Dispositivos vinculados. Cuando veas **"Bot conectado correctamente"**, ya está listo.

**5. Déjalo corriendo con PM2** (para que no se detenga al cerrar Termux)
```bash
npm install -g pm2
pm2 start index.js --name alepanda-bot
pm2 save
```

Comandos útiles:
```bash
pm2 logs alepanda-bot     # ver logs en vivo
pm2 restart alepanda-bot  # reiniciar
pm2 stop alepanda-bot     # detener
```

---

**ALEPANDA BOT** — hecho por ALEPANDITA.
