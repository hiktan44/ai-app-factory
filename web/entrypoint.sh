#!/bin/bash
# ============================================================
# AI App Factory - Container Entrypoint
# Volume boşsa default dosyaları kopyalar, settings.json oluşturur
# ============================================================

# --- Prompts ---
echo "[entrypoint] /factory/prompts/ default promptlar ile senkronize ediliyor..."
cp /app/default-prompts/*.md /factory/prompts/ 2>/dev/null
echo "[entrypoint] $(ls /factory/prompts/ | wc -l) prompt dosyası hazır."

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
EXISTING_ZAI_KEY=""
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
  EXISTING_ZAI_KEY=$(jq -r '.zaiApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_GROK_KEY=$(jq -r '.grokApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_OPENROUTER_KEY=$(jq -r '.openrouterApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_QWEN_KEY=$(jq -r '.qwenApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_MINIMAX_KEY=$(jq -r '.minimaxApiKey // ""' /factory/settings.json 2>/dev/null || echo "")
  EXISTING_CLAUDE_OAUTH=$(jq -r '.claudeOauthToken // ""' /factory/settings.json 2>/dev/null || echo "")
fi

# Env var varsa VE maskeli değilse onu kullan, yoksa mevcut ayarı koru
# Coolify API bazen maskelenmiş değerler döndürebilir (● karakteri içerir)
is_valid_key() {
  local val="$1"
  # Boş veya ● (BLACK CIRCLE U+25CF) içeriyorsa geçersiz
  if [ -z "$val" ] || echo "$val" | grep -q "●"; then
    return 1
  fi
  return 0
}

if is_valid_key "${VERCEL_TOKEN:-}"; then FINAL_VERCEL_TOKEN="$VERCEL_TOKEN"; else FINAL_VERCEL_TOKEN="$EXISTING_VERCEL_TOKEN"; fi
if is_valid_key "${VERCEL_TEAM_ID:-}"; then FINAL_VERCEL_TEAM_ID="$VERCEL_TEAM_ID"; else FINAL_VERCEL_TEAM_ID="$EXISTING_VERCEL_TEAM_ID"; fi
FINAL_GITHUB_ORG="${GITHUB_ORG:-$EXISTING_GITHUB_ORG}"
if is_valid_key "${ANTHROPIC_API_KEY:-}"; then FINAL_ANTHROPIC_KEY="$ANTHROPIC_API_KEY"; else FINAL_ANTHROPIC_KEY="$EXISTING_ANTHROPIC_KEY"; fi
if is_valid_key "${ZAI_API_KEY:-}"; then FINAL_ZAI_KEY="$ZAI_API_KEY"; else FINAL_ZAI_KEY="$EXISTING_ZAI_KEY"; fi
if is_valid_key "${GROK_API_KEY:-}"; then FINAL_GROK_KEY="$GROK_API_KEY"; else FINAL_GROK_KEY="$EXISTING_GROK_KEY"; fi
if is_valid_key "${OPENROUTER_API_KEY:-}"; then FINAL_OPENROUTER_KEY="$OPENROUTER_API_KEY"; else FINAL_OPENROUTER_KEY="$EXISTING_OPENROUTER_KEY"; fi
if is_valid_key "${QWEN_API_KEY:-}"; then FINAL_QWEN_KEY="$QWEN_API_KEY"; else FINAL_QWEN_KEY="$EXISTING_QWEN_KEY"; fi
if is_valid_key "${MINIMAX_API_KEY:-}"; then FINAL_MINIMAX_KEY="$MINIMAX_API_KEY"; else FINAL_MINIMAX_KEY="$EXISTING_MINIMAX_KEY"; fi
if is_valid_key "${CLAUDE_CODE_OAUTH_TOKEN:-}"; then FINAL_CLAUDE_OAUTH="$CLAUDE_CODE_OAUTH_TOKEN"; else FINAL_CLAUDE_OAUTH="$EXISTING_CLAUDE_OAUTH"; fi

cat > /factory/settings.json <<ENDJSON
{
  "claudeOauthToken": "${FINAL_CLAUDE_OAUTH}",
  "anthropicApiKey": "${FINAL_ANTHROPIC_KEY}",
  "zaiApiKey": "${FINAL_ZAI_KEY}",
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

# --- Claude CLI credentials kurulumu (Refresh token ve persistent saklama desteği) ---
CLAUDE_DIR="/factory/.claude"
mkdir -p "$CLAUDE_DIR"

if [ -n "${FINAL_CLAUDE_OAUTH:-}" ]; then
  echo "[entrypoint] Claude OAuth token tespit edildi, credentials dosyaları hazırlanıyor..."
  
  if echo "${FINAL_CLAUDE_OAUTH}" | grep -q "^[[:space:]]*{"; then
    # Zaten JSON formatında (Keychain'den alınan tam çıktı)
    CRED_JSON="${FINAL_CLAUDE_OAUTH}"
    echo "[entrypoint] OAuth JSON formatında yüklendi (Refresh Token desteği aktif)"
  else
    # Düz token string'i, JSON sarmalına al
    CRED_JSON="{\"claudeAiOauth\": {\"accessToken\": \"${FINAL_CLAUDE_OAUTH}\", \"expiresAt\": 1999999999999}}"
    echo "[entrypoint] UYARI: OAuth düz text formatında yüklendi (Refresh Token desteği yok)"
  fi
  
  # Birden fazla olası path için dosyaları hazırla (CLI sürüm esnekliği)
  echo "${CRED_JSON}" > "$CLAUDE_DIR/.credentials.json"
  echo "${CRED_JSON}" > "$CLAUDE_DIR.json"
  echo "${CRED_JSON}" > "$CLAUDE_DIR/claude.json"
  chmod 600 "$CLAUDE_DIR/.credentials.json" "$CLAUDE_DIR.json" "$CLAUDE_DIR/claude.json" 2>/dev/null || true
  
  echo "[entrypoint] ✓ Claude credentials dosyaları yazıldı ($CLAUDE_DIR/.credentials.json)"
fi

# --- /factory dizini izinleri (factory kullanıcısı Claude CLI için gerekli) ---
chown -R factory:factory /factory 2>/dev/null || true
echo "[entrypoint] /factory izinleri factory kullanıcısına verildi."

# Node.js server'ı başlat
exec node server.js
