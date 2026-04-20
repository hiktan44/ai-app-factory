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

# --- settings.json (env var'lardan oluştur, mevcut kullanıcı ayarlarını koru) ---
# orchestrator.sh satır 28-42 bu dosyayı okur
# Docker'da API key'ler env var olarak gelir (docker-compose.yaml)
# Mevcut settings.json'dan kullanıcı ayarlarını koru (UI'dan kaydedilmiş değerler)
EXISTING_MAX_TURNS=50
EXISTING_MAX_CONCURRENT=1
EXISTING_VERCEL_TOKEN=""
EXISTING_VERCEL_TEAM_ID=""
EXISTING_GITHUB_ORG=""
EXISTING_ANTHROPIC_KEY=""
EXISTING_GEMINI_KEY=""
EXISTING_GROK_KEY=""
EXISTING_OPENROUTER_KEY=""
EXISTING_QWEN_KEY=""
EXISTING_MINIMAX_KEY=""
EXISTING_CLAUDE_OAUTH=""
if [ -f /factory/settings.json ]; then
  EXISTING_MAX_TURNS=$(jq -r '.maxTurns // 50' /factory/settings.json 2>/dev/null || echo 50)
  EXISTING_MAX_CONCURRENT=$(jq -r '.maxConcurrentRuns // 1' /factory/settings.json 2>/dev/null || echo 1)
  EXISTING_VERCEL_TOKEN=$(jq -r '.vercelToken // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_VERCEL_TEAM_ID=$(jq -r '.vercelTeamId // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_GITHUB_ORG=$(jq -r '.githubOrg // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_ANTHROPIC_KEY=$(jq -r '.anthropicApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_GEMINI_KEY=$(jq -r '.geminiApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_GROK_KEY=$(jq -r '.grokApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_OPENROUTER_KEY=$(jq -r '.openrouterApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_QWEN_KEY=$(jq -r '.qwenApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_MINIMAX_KEY=$(jq -r '.minimaxApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_CLAUDE_OAUTH=$(jq -r '.claudeOauthToken // ""' /factory/settings.json 2>/dev/null || echo "")
fi

# Env var varsa onu kullan, yoksa mevcut ayarı koru
FINAL_VERCEL_TOKEN="${VERCEL_TOKEN:-$EXISTING_VERCEL_TOKEN}"
FINAL_VERCEL_TEAM_ID="${VERCEL_TEAM_ID:-$EXISTING_VERCEL_TEAM_ID}"
FINAL_GITHUB_ORG="${GITHUB_ORG:-$EXISTING_GITHUB_ORG}"
FINAL_ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-$EXISTING_ANTHROPIC_KEY}"
FINAL_GEMINI_KEY="${GEMINI_API_KEY:-$EXISTING_GEMINI_KEY}"
FINAL_GROK_KEY="${GROK_API_KEY:-$EXISTING_GROK_KEY}"
FINAL_OPENROUTER_KEY="${OPENROUTER_API_KEY:-$EXISTING_OPENROUTER_KEY}"
FINAL_QWEN_KEY="${QWEN_API_KEY:-$EXISTING_QWEN_KEY}"
FINAL_MINIMAX_KEY="${MINIMAX_API_KEY:-$EXISTING_MINIMAX_KEY}"
FINAL_CLAUDE_OAUTH="${CLAUDE_CODE_OAUTH_TOKEN:-$EXISTING_CLAUDE_OAUTH}"

cat > /factory/settings.json <<ENDJSON
{
  "claudeOauthToken": "${FINAL_CLAUDE_OAUTH}",
  "anthropicApiKey": "${FINAL_ANTHROPIC_KEY}",
  "geminiApiKey": "${FINAL_GEMINI_KEY}",
  "grokApiKey": "${FINAL_GROK_KEY}",
  "qwenApiKey": "${FINAL_QWEN_KEY}",
  "minimaxApiKey": "${FINAL_MINIMAX_KEY}",
  "openrouterApiKey": "${FINAL_OPENROUTER_KEY}",
  "githubToken": "${GITHUB_TOKEN:-}",
  "githubOrg": "${FINAL_GITHUB_ORG}",
  "vercelToken": "${FINAL_VERCEL_TOKEN}",
  "vercelTeamId": "${FINAL_VERCEL_TEAM_ID}",
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
