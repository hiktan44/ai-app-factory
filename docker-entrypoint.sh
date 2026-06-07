#!/bin/sh
# ============================================================
# AI App Factory - Docker Entrypoint
# Container başlarken Claude kimlik doğrulamasını kurar
# ============================================================

set -e

# ─── Claude Kimlik Doğrulama Kurulumu ────────────────────────
# factory kullanıcısının home dizinini hazırla
mkdir -p /home/factory/.claude
chown -R factory:factory /home/factory 2>/dev/null || true

CLAUDE_JSON="/home/factory/.claude/claude.json"

# 1. CLAUDE_CODE_OAUTH_TOKEN varsa → claude.json oluştur
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "Claude OAuth token tespit edildi, kimlik doğrulaması kuruluyor..."
  cat > "${CLAUDE_JSON}" <<EOF
{
  "oauthToken": "${CLAUDE_CODE_OAUTH_TOKEN}",
  "hasCompletedOnboarding": true,
  "primaryApiType": "claude.ai"
}
EOF
  chown factory:factory "${CLAUDE_JSON}"
  chmod 600 "${CLAUDE_JSON}"
  echo "✓ Claude OAuth auth kuruldu (/home/factory/.claude/claude.json)"

# 2. ANTHROPIC_API_KEY varsa → claude.json'a API key olarak yaz
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Anthropic API Key tespit edildi, kimlik doğrulaması kuruluyor..."
  cat > "${CLAUDE_JSON}" <<EOF
{
  "hasCompletedOnboarding": true,
  "primaryApiType": "anthropic"
}
EOF
  chown factory:factory "${CLAUDE_JSON}"
  chmod 600 "${CLAUDE_JSON}"
  echo "✓ Claude API Key auth kuruldu (ANTHROPIC_API_KEY env üzerinden kullanılacak)"

else
  echo "UYARI: Ne CLAUDE_CODE_OAUTH_TOKEN ne de ANTHROPIC_API_KEY tanımlı."
  echo "  Pipeline Claude CLI gerektiren adımlarda Gemini/OpenRouter fallback kullanacak."
fi

# ─── Uygulama Başlat ─────────────────────────────────────────
# root olarak çalışıyorsak factory kullanıcısına geç
if [ "$(id -u)" = "0" ]; then
  exec gosu factory "$@"
else
  exec "$@"
fi
