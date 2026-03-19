#!/bin/bash
# ============================================================
# AI App Factory - Container Entrypoint
# Volume boşsa default prompt dosyalarını kopyalar
# ============================================================

# /factory/prompts/ boşsa default promptları kopyala
if [ -z "$(ls -A /factory/prompts/ 2>/dev/null)" ]; then
  echo "[entrypoint] /factory/prompts/ boş — default promptlar kopyalanıyor..."
  cp /app/default-prompts/*.md /factory/prompts/ 2>/dev/null
  echo "[entrypoint] $(ls /factory/prompts/ | wc -l) prompt dosyası kopyalandı."
else
  echo "[entrypoint] /factory/prompts/ zaten dolu — $(ls /factory/prompts/ | wc -l) dosya mevcut."
fi

# Node.js server'ı başlat
exec node server.js
