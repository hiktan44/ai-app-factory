#!/bin/bash
# ============================================================
# AI App Factory - Container Entrypoint
# Volume boşsa default dosyaları kopyalar, settings.json oluşturur
# ============================================================

# --- Prompts ---
if [ -z "$(ls -A /factory/prompts/ 2>/dev/null)" ]; then
  echo "[entrypoint] /factory/prompts/ boş — default promptlar kopyalanıyor..."
  cp /app/default-prompts/*.md /factory/prompts/ 2>/dev/null
  echo "[entrypoint] $(ls /factory/prompts/ | wc -l) prompt dosyası kopyalandı."
else
  echo "[entrypoint] /factory/prompts/ zaten dolu — $(ls /factory/prompts/ | wc -l) dosya mevcut."
fi

# --- orchestrator.sh (her zaman güncelle — image'daki en yeni versiyon) ---
cp /app/default-orchestrator.sh /factory/orchestrator.sh
chmod +x /factory/orchestrator.sh
echo "[entrypoint] orchestrator.sh güncellendi."

# --- validate-run.sh ---
cp /app/default-validate-run.sh /factory/validate-run.sh
chmod +x /factory/validate-run.sh
echo "[entrypoint] validate-run.sh güncellendi."

# --- CLAUDE.md ---
cp /app/default-CLAUDE.md /factory/CLAUDE.md
echo "[entrypoint] CLAUDE.md güncellendi."

# --- learnings.json (sadece yoksa kopyala — mevcut öğrenmeleri koru) ---
if [ ! -f /factory/learnings.json ]; then
  cp /app/default-learnings.json /factory/learnings.json
  echo "[entrypoint] learnings.json kopyalandı."
else
  echo "[entrypoint] learnings.json zaten mevcut — korunuyor."
fi

# --- settings.json (env var'lardan oluştur, mevcut ayarları koru) ---
# orchestrator.sh satır 28-42 bu dosyayı okur
# Docker'da API key'ler env var olarak gelir (docker-compose.yaml)
# Mevcut settings.json'dan maxTurns ve maxConcurrentRuns gibi kullanıcı ayarlarını koru
EXISTING_MAX_TURNS=50
EXISTING_MAX_CONCURRENT=1
if [ -f /factory/settings.json ]; then
  EXISTING_MAX_TURNS=$(cat /factory/settings.json | jq -r '.maxTurns // 50' 2>/dev/null || echo 50)
  EXISTING_MAX_CONCURRENT=$(cat /factory/settings.json | jq -r '.maxConcurrentRuns // 1' 2>/dev/null || echo 1)
fi

cat > /factory/settings.json <<ENDJSON
{
  "claudeOauthToken": "${CLAUDE_CODE_OAUTH_TOKEN:-}",
  "anthropicApiKey": "${ANTHROPIC_API_KEY:-}",
  "geminiApiKey": "${GEMINI_API_KEY:-}",
  "grokApiKey": "${GROK_API_KEY:-}",
  "qwenApiKey": "${QWEN_API_KEY:-}",
  "minimaxApiKey": "${MINIMAX_API_KEY:-}",
  "openrouterApiKey": "${OPENROUTER_API_KEY:-}",
  "githubToken": "${GITHUB_TOKEN:-}",
  "githubOrg": "${GITHUB_ORG:-}",
  "coolifyApiUrl": "${COOLIFY_API_URL:-}",
  "coolifyApiToken": "${COOLIFY_API_TOKEN:-}",
  "coolifyServerUuid": "${COOLIFY_SERVER_UUID:-}",
  "coolifyProjectUuid": "${COOLIFY_PROJECT_UUID:-}",
  "maxTurns": ${EXISTING_MAX_TURNS},
  "maxConcurrentRuns": ${EXISTING_MAX_CONCURRENT}
}
ENDJSON
echo "[entrypoint] settings.json env'den oluşturuldu (maxTurns=${EXISTING_MAX_TURNS}, maxConcurrent=${EXISTING_MAX_CONCURRENT})."

# --- /factory dizini izinleri (factory kullanıcısı Claude CLI için gerekli) ---
chown -R factory:factory /factory 2>/dev/null || true
echo "[entrypoint] /factory izinleri factory kullanıcısına verildi."

# Node.js server'ı başlat
exec node server.js
