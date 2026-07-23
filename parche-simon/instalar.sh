#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "Aplicando parche de Simon..."
mkdir -p lib commands/ia
cp lib/iaAmigos.js lib/iaAmigos.js.bak 2>/dev/null || true
cp parche-simon/iaAmigos.js lib/iaAmigos.js
cp parche-simon/simonWatcher.js lib/simonWatcher.js
cp parche-simon/commands_ia/simi.js commands/ia/simi.js
cp parche-simon/commands_ia/panda.js commands/ia/panda.js
cp parche-simon/commands_ia/simon.js commands/ia/simon.js
node parche-simon/aplicar_simon.js
echo "Verificando sintaxis..."
node --check lib/iaAmigos.js
node --check lib/simonWatcher.js
node --check commands/ia/simi.js
node --check commands/ia/panda.js
node --check commands/ia/simon.js
node --check index.js
echo "Listo! Todo aplicado y verificado correctamente."
