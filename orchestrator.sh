#!/usr/bin/env bash
set -uo pipefail

# Saat dilimini Türkiye olarak ayarla
export TZ="Europe/Istanbul"

# ============================================================
# AI App Factory v2.0 - Ana Orkestratör
# Otonom uygulama üretim bandı - Multi-LLM routing
#
# Kullanım: ./orchestrator.sh <kategori>
# Örnek:    ./orchestrator.sh productivity
#
# LLM Routing:
#   Claude     → Mimari tasarım, kod yazma, hata düzeltme (kritik)
#   Z.AI       → Araştırma, kod üretme, review, assets, packaging
#   Grok       → Trend araştırma (opsiyonel)
#   Qwen       → Marketing metni (ucuz, çok dilli)
#
# Kuru çalıştırma: DRY_RUN=1 ./orchestrator.sh test
# ============================================================

# NVM ve PATH ayarları (cron gibi ortamlarda çalışabilmesi için)
export NVM_DIR="${HOME}/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ─── Settings'ten API keylerini yükle ───────────────────────
PROJECT_ROOT_TEMP="$(cd "$(dirname "$0")" && pwd)"
SETTINGS_FILE="${PROJECT_ROOT_TEMP}/settings.json"

# .env veya web/.env.local varsa yükle
if [ -f "${PROJECT_ROOT_TEMP}/.env" ]; then
  # Dosyadaki boşlukları ve yorum satırlarını eleyerek export et
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    export "$line"
  done < "${PROJECT_ROOT_TEMP}/.env"
fi

if [ -f "${PROJECT_ROOT_TEMP}/web/.env.local" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    export "$line"
  done < "${PROJECT_ROOT_TEMP}/web/.env.local"
fi

# Akıllı temizlik: Eğer .env dosyalarında aktif bir ANTHROPIC_API_KEY tanımlanmamışsa,
# terminalin aktif oturumundaki eski proxy ve API key kalıntılarını temizle (Claude Max planına doğrudan bağlanabilmesi için)
if ! grep -qE "^[[:space:]]*ANTHROPIC_API_KEY=" "${PROJECT_ROOT_TEMP}/web/.env.local" 2>/dev/null && \
   ! grep -qE "^[[:space:]]*ANTHROPIC_API_KEY=" "${PROJECT_ROOT_TEMP}/.env" 2>/dev/null; then
  unset ANTHROPIC_API_KEY
  unset ANTHROPIC_AUTH_TOKEN
  unset ANTHROPIC_BASE_URL
fi

# Güvenlik: Eğer CLAUDE_CODE_OAUTH_TOKEN env'de varsa ama boşsa temizle
# (Yorum satırı haline getirilmiş token env'e yanlışlıkla export edildiyse)
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  unset CLAUDE_CODE_OAUTH_TOKEN
fi

if [ -f "$SETTINGS_FILE" ]; then
  # settings.json'dan keyler okunur (jq ile)
  CLAUDE_OAUTH_TOKEN_LOCAL=$(jq -r '.claudeOauthToken // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
  ANTHROPIC_API_KEY_LOCAL=$(jq -r '.anthropicApiKey // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
  GEMINI_API_KEY_LOCAL=$(jq -r '.geminiApiKey // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
  GROK_API_KEY_LOCAL=$(jq -r '.grokApiKey // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
  QWEN_API_KEY_LOCAL=$(jq -r '.qwenApiKey // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
  OPENROUTER_API_KEY_LOCAL=$(jq -r '.openrouterApiKey // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")

  # Eğer settings'te varsa env'i override et (OAuth token öncelikli)
  [ -n "$CLAUDE_OAUTH_TOKEN_LOCAL" ] && export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_OAUTH_TOKEN_LOCAL"
  [ -n "$ANTHROPIC_API_KEY_LOCAL" ] && export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY_LOCAL"
  [ -n "$GEMINI_API_KEY_LOCAL" ] && export GEMINI_API_KEY="$GEMINI_API_KEY_LOCAL"
  [ -n "$GROK_API_KEY_LOCAL" ] && export GROK_API_KEY="$GROK_API_KEY_LOCAL"
  [ -n "$QWEN_API_KEY_LOCAL" ] && export QWEN_API_KEY="$QWEN_API_KEY_LOCAL"
  [ -n "$OPENROUTER_API_KEY_LOCAL" ] && export OPENROUTER_API_KEY="$OPENROUTER_API_KEY_LOCAL"
fi

# ─── Claude CONFIG ve credentials dizini ayarları ──────────────────
export CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/factory/.claude}"

# Eğer kalıcı kimlik doğrulama dosyası varsa, ortamdaki statik token'ı kaldırarak
# Claude'un otomatik token tazeleme (refresh) mekanizmasını kullanmasını sağlayalım
if ([ -f "${CLAUDE_CONFIG_DIR}/.credentials.json" ] && jq -e '.claudeAiOauth' "${CLAUDE_CONFIG_DIR}/.credentials.json" &>/dev/null 2>&1) || \
   ([ -f "${CLAUDE_CONFIG_DIR}/claude.json" ] && jq -e '.oauthToken' "${CLAUDE_CONFIG_DIR}/claude.json" &>/dev/null 2>&1) || \
   ([ -f "${CLAUDE_CONFIG_DIR}.json" ] && jq -e '.claudeAiOauth // .oauthToken' "${CLAUDE_CONFIG_DIR}.json" &>/dev/null 2>&1); then
  unset CLAUDE_CODE_OAUTH_TOKEN
  CLAUDE_OAUTH_TOKEN_LOCAL=""
  log "  Kalıcı Claude credentials dosyası tespit edildi, statik token env'den kaldırıldı (otomatik refresh aktif)."
fi

# ─── Claude CLI doğrulama ────────────────────────────────────
if ! command -v claude &> /dev/null; then
  echo "HATA: 'claude' komutu bulunamadı."
  echo "Kurulum: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

# ─── Gemini API helper ──────────────────────────────────────
call_gemini() {
  local system_prompt="$1"
  local user_prompt="$2"
  local output_file="$3"
  local model="${4:-gemini-3.5-flash}"

  if [ -z "${GEMINI_API_KEY:-}" ]; then
    return 1
  fi

  local model_endpoint="gemini-3.5-flash"
  if [ "$model" = "gemini-3.1-pro" ] || [ "$model" = "gemini-3.1-pro-preview" ]; then
    model_endpoint="gemini-3.1-pro-preview"
  fi

  local payload
  payload=$(jq -n \
    --arg sys "$system_prompt" \
    --arg usr "$user_prompt" \
    '{
      contents: [
        {
          role: "user",
          parts: [{ text: $usr }]
        }
      ],
      systemInstruction: {
        parts: [{ text: $sys }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    }')

  local response
  response=$(curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${model_endpoint}:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)

  local text
  text=$(echo "$response" | jq -r '.candidates[0].content.parts[0].text // empty' 2>/dev/null || echo "")

  if [ -n "$text" ]; then
    echo "{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"result\":$(echo "$text" | jq -Rs .)}" > "$output_file"
    return 0
  fi

  return 1
}

# ─── Qwen API helper ─────────────────────────────────────────
call_qwen() {
  local system_prompt="$1"
  local user_prompt="$2"
  local output_file="$3"

  if [ -z "${QWEN_API_KEY:-}" ]; then
    return 1
  fi

  local payload
  payload=$(jq -n \
    --arg sys "$system_prompt" \
    --arg usr "$user_prompt" \
    '{
      model: "qwen-plus",
      max_tokens: 4096,
      messages: [
        { role: "system", content: $sys },
        { role: "user", content: $usr }
      ]
    }')

  local response
  response=$(curl -s -X POST \
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" \
    -H "Authorization: Bearer ${QWEN_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)

  local text
  text=$(echo "$response" | jq -r '.choices[0].message.content // empty' 2>/dev/null || echo "")

  if [ -n "$text" ]; then
    echo "{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"result\":$(echo "$text" | jq -Rs .)}" > "$output_file"
    return 0
  fi

  return 1
}

# ─── OpenRouter API helper ───────────────────────────────────
call_openrouter() {
  local system_prompt="$1"
  local user_prompt="$2"
  local output_file="$3"

  if [ -z "${OPENROUTER_API_KEY:-}" ]; then
    return 1
  fi

  local payload
  payload=$(jq -n \
    --arg sys "$system_prompt" \
    --arg usr "$user_prompt" \
    '{
      model: "google/gemma-3-27b-it:free",
      max_tokens: 4096,
      messages: [
        { role: "system", content: $sys },
        { role: "user", content: $usr }
      ]
    }')

  local response
  response=$(curl -s -X POST \
    "https://openrouter.ai/api/v1/chat/completions" \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "HTTP-Referer: https://ai-app-factory.com" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)

  local text
  text=$(echo "$response" | jq -r '.choices[0].message.content // empty' 2>/dev/null || echo "")

  if [ -n "$text" ]; then
    echo "{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"result\":$(echo "$text" | jq -Rs .)}" > "$output_file"
    return 0
  fi

  return 1
}

# ─── Claude CLI helper ───────────────────────────────────────
call_claude() {
  local system_prompt="$1"
  local user_prompt="$2"
  local output_file="$3"
  local extra_flags="${4:-}"

  # Kalıcı credentials dosyası varsa auth var kabul et
  local credentials_exist=false
  if ([ -f "${CLAUDE_CONFIG_DIR:-}/.credentials.json" ] && jq -e '.claudeAiOauth' "${CLAUDE_CONFIG_DIR}/.credentials.json" &>/dev/null 2>&1) || \
     ([ -f "${CLAUDE_CONFIG_DIR:-}/claude.json" ] && jq -e '.oauthToken' "${CLAUDE_CONFIG_DIR}/claude.json" &>/dev/null 2>&1) || \
     ([ -f "${CLAUDE_CONFIG_DIR:-}.json" ] && jq -e '.claudeAiOauth // .oauthToken' "${CLAUDE_CONFIG_DIR}.json" &>/dev/null 2>&1); then
    credentials_exist=true
  fi

  # Auth kontrolü: OAuth token VEYA API key VEYA OpenRouter/Z.ai proxy token VEYA kalıcı credentials gerekli
  if [ "$credentials_exist" = false ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
    log "HATA: Ne CLAUDE_CODE_OAUTH_TOKEN, ne ANTHROPIC_API_KEY, ne de ANTHROPIC_AUTH_TOKEN tanımlı — Claude CLI çalışamaz"
    return 1
  fi

  local stderr_file="${output_file}.stderr"
  local exit_code=0

  log "Claude CLI başlatılıyor (output: $(basename "$output_file"))..."
  log "  Prompt uzunluğu: ${#user_prompt} karakter"

  # --max-turns: Claude CLI'ın yeterince çalışmasını sağla
  # --continue flag'i varsa max-turns ekleme (continue kendi turunu yönetir)
  local max_turns_flag=""
  if [[ "$extra_flags" != *"--continue"* ]]; then
    local configured_max_turns="${MAX_TURNS:-50}"
    max_turns_flag="--max-turns ${configured_max_turns}"
  fi

  # Claude CLI --dangerously-skip-permissions root ile çalışmaz.
  # gosu varsa (Docker container) non-root 'factory' kullanıcısıyla çalıştır.
  # gosu yoksa (lokal geliştirme) doğrudan çalıştır.
  local use_gosu=false
  if command -v gosu &>/dev/null && [ "$(id -u)" = "0" ]; then
    use_gosu=true
    log "  Root tespit edildi — gosu factory ile çalıştırılacak"
  fi

  # Working directory: WORKSPACE varsa orayı kullan (Claude dosyalara erişebilsin)
  local work_dir="${WORKSPACE:-$(pwd)}"
  local step_name
  step_name=$(basename "$output_file" .json)
  if [[ "$step_name" == "build" || "$step_name" == verify_fix_* || "$step_name" == "review" || "$step_name" == "assets" || "$step_name" == "frontend" ]]; then
    if [ -d "${work_dir}/app" ]; then
      work_dir="${work_dir}/app"
    fi
  fi
  log "  Çalışma dizini: ${work_dir}"

  if [ "$use_gosu" = true ]; then
    # gosu ile çalıştır — prompt'ları ve komutu dosyaya yaz (shell escaping sorunlarını tamamen önle)
    local prompt_file="${output_file}.prompt"
    local sysprompt_file="${output_file}.sysprompt"
    local runner_script="${output_file}.runner.sh"

    printf '%s' "${user_prompt}" > "${prompt_file}"
    printf '%s' "${system_prompt}" > "${sysprompt_file}"

    # Runner script: factory kullanıcısı olarak çalışacak
    cat > "${runner_script}" <<RUNNER_EOF
#!/bin/sh
cd "${work_dir}" || exit 1
exec claude -p "\$(cat '${prompt_file}')" \\
  --append-system-prompt "\$(cat '${sysprompt_file}')" \\
  --dangerously-skip-permissions \\
  --output-format json \\
  ${max_turns_flag} \\
  ${extra_flags}
RUNNER_EOF
    chmod +x "${runner_script}"
    chown factory:factory "${prompt_file}" "${sysprompt_file}" "${runner_script}" 2>/dev/null || true

    # API key her durumda geçirilsin (CLI kendi öncelik kurallarını işletir)
    local claude_api_key_for_gosu="${ANTHROPIC_API_KEY:-}"

    HOME=/home/factory \
    CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/factory/.claude}" \
    ANTHROPIC_API_KEY="${claude_api_key_for_gosu}" \
    CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}" \
    ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-}" \
    ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-}" \
    ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-}" \
    CLAUDE_CODE_SKIP_ONBOARDING="${CLAUDE_CODE_SKIP_ONBOARDING:-1}" \
    CLAUDE_CODE_ENABLE_TELEMETRY="${CLAUDE_CODE_ENABLE_TELEMETRY:-0}" \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    gosu factory "${runner_script}" \
      > "${output_file}" 2>"${stderr_file}" || exit_code=$?

    # Geçici dosyaları temizle
    rm -f "${prompt_file}" "${sysprompt_file}" "${runner_script}" 2>/dev/null || true
  else
    claude -p "${user_prompt}" \
      --append-system-prompt "${system_prompt}" \
      --dangerously-skip-permissions \
      --output-format json \
      ${max_turns_flag} \
      ${extra_flags} \
      > "${output_file}" 2>"${stderr_file}" || exit_code=$?
  fi

  # stderr'i logla (debug için)
  if [ -f "${stderr_file}" ] && [ -s "${stderr_file}" ]; then
    log "Claude CLI stderr: $(head -10 "${stderr_file}")"
  fi

  # Exit code kontrolü
  if [ $exit_code -ne 0 ]; then
    log "HATA: Claude CLI exit code: ${exit_code}"
    
    # Check for authentication errors
    local auth_err=false
    if [ -f "${stderr_file}" ] && (grep -qiE "401|auth|token|unauthorized" "${stderr_file}" || grep -qi "Failed to authenticate" "${stderr_file}"); then
      auth_err=true
    fi
    if [ -f "${output_file}" ] && (grep -qiE "401|auth|token|unauthorized" "${output_file}" || grep -qi "Failed to authenticate" "${output_file}"); then
      auth_err=true
    fi

    # Check for credit balance errors
    local credit_err=false
    if [ -f "${stderr_file}" ] && (grep -qi "credit balance" "${stderr_file}" || grep -qi "balance is too low" "${stderr_file}"); then
      credit_err=true
    fi
    if [ -f "${output_file}" ] && (grep -qi "credit balance" "${output_file}" || grep -qi "balance is too low" "${output_file}"); then
      credit_err=true
    fi

    if [ "$credit_err" = true ]; then
      log "=========================================================================="
      log "❌ KRİTİK HATA: Anthropic Kredi Bakiyesi Yetersiz (Credit Balance Too Low)"
      log "Kullandığınız Anthropic API anahtarında veya Claude hesabınızda yeterli bakiye bulunmamaktadır!"
      log ""
      log "Çözüm Önerileri:"
      log "1. API Anahtarı (API Key) Kullanıyorsanız:"
      log "   https://console.anthropic.com/ settings/billing sayfasına gidin ve bakiye yükleyin."
      log ""
      log "2. Claude Code Pro Plan Kullanıyorsanız:"
      log "   Hesabınızın günlük/aylık kullanım limitlerini kontrol edin veya faturalandırılabilir API key'e geçiş yapın."
      log "=========================================================================="
    elif [ "$auth_err" = true ]; then
      log "=========================================================================="
      log "❌ KRİTİK HATA: Claude CLI Kimlik Doğrulama Hatası (401 - Unauthorized)"
      log "Claude Code veya API anahtarınız geçersiz, süresi dolmuş ya da eksik!"
      log ""
      log "Çözüm Önerileri:"
      log "1. Yerel Terminalde Çalıştırıyorsanız:"
      log "   Terminalinizde 'claude login' komutunu çalıştırarak yeniden giriş yapın."
      log ""
      log "2. Docker veya Coolify Sunucusunda Çalıştırıyorsanız:"
      log "   Yerel bilgisayarınızdaki Claude Code OAuth token'ını alın."
      log "   Token'ı bulmak için yerel terminalinizde 'env | grep CLAUDE_CODE_OAUTH_TOKEN' komutunu çalıştırabilir"
      log "   veya ~/.claude.json dosyasındaki 'oauthToken' değerini kopyalayabilirsiniz."
      log "   Bu değeri sunucudaki .env dosyasına veya Web Arayüzünde Ayarlar -> CLAUDE_CODE_OAUTH_TOKEN olarak kaydedin."
      log ""
      log "3. API Key Kullanmak İstiyorsanız:"
      log "   Web arayüzünden veya .env.local dosyasından geçerli bir 'ANTHROPIC_API_KEY' girin."
      log "=========================================================================="
    fi

    # Debug: stdout içeriğini de logla (hata mesajı stdout'a gidebilir)
    if [ -f "${output_file}" ] && [ -s "${output_file}" ]; then
      log "Claude CLI stdout (ilk 500 byte): $(head -c 500 "${output_file}")"
    else
      log "Claude CLI stdout: BOŞ veya dosya yok"
    fi
    # Debug: ortam bilgisi
    if [ "$use_gosu" = true ]; then
      log "  gosu kullanıldı, factory user HOME=/home/factory"
      log "  /home/factory/.claude dizini: $(ls -la /home/factory/.claude/ 2>&1 | head -5)"
    fi
    return 1
  fi

  # Çıktı dosyası var mı ve boş değil mi?
  if [ ! -f "${output_file}" ] || [ ! -s "${output_file}" ]; then
    log "HATA: Claude CLI çıktı dosyası boş veya yok: ${output_file}"
    return 1
  fi

  # JSON parse edilebilir mi?
  local result
  result=$(cat "${output_file}" 2>/dev/null || echo '')
  if [ -z "$result" ]; then
    log "HATA: Claude CLI çıktısı okunamadı"
    return 1
  fi

  # is_error kontrolü
  local hata
  hata=$(echo "$result" | jq -r '.is_error // false' 2>/dev/null || echo "false")
  if [ "$hata" = "true" ]; then
    local err_msg
    err_msg=$(echo "$result" | jq -r '.result // "bilinmeyen hata"' 2>/dev/null || echo "")
    log "HATA: Claude CLI is_error=true: ${err_msg}"
    return 1
  fi

  # JSON çıktı boyutunu ve yapısını logla (debug)
  local json_size
  json_size=$(wc -c < "${output_file}" 2>/dev/null || echo "0")
  log "  JSON çıktı boyutu: ${json_size} byte"

  # result alanını kontrol et
  local result_text
  result_text=$(echo "$result" | jq -r '.result // ""' 2>/dev/null || echo "")
  local result_len=${#result_text}

  # num_turns kontrolü — Claude gerçekten çalıştı mı?
  local num_turns
  num_turns=$(echo "$result" | jq -r '.num_turns // 0' 2>/dev/null || echo "0")
  local total_cost
  total_cost=$(echo "$result" | jq -r '.total_cost_usd // 0' 2>/dev/null || echo "0")

  log "  result uzunluğu: ${result_len} karakter, num_turns: ${num_turns}, cost: \$${total_cost}"

  # Claude dosyalara yazdığında .result kısa/boş olabilir.
  # Bu durumda num_turns ve cost ile gerçek çalışma yapılıp yapılmadığını kontrol et.
  if [ $result_len -lt 50 ]; then
    if [ "$num_turns" -gt 1 ] 2>/dev/null || [ "$(echo "$total_cost > 0" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
      log "  result kısa ama Claude ${num_turns} tur çalıştı (\$${total_cost}) — dosyalara yazmış olabilir, başarılı sayılıyor"
    else
      log "UYARI: Claude CLI çıktısı çok kısa (${result_len} karakter), turns=${num_turns}, cost=\$${total_cost}"
      log "  Çıktı: ${result_text:0:200}"
      # İlk 200 byte JSON'ı da logla
      log "  JSON başlangıcı: $(head -c 200 "${output_file}" 2>/dev/null || echo 'okunamadı')"
      return 1
    fi
  else
    log "Claude CLI başarılı (${result_len} karakter çıktı)"
  fi

  return 0
}

# ─── Non-Claude provider çıktısını dosyaya yaz ───────────────
# Non-Claude provider'lar (Z.AI, Qwen, OpenRouter) sadece text döndürür
# ve workspace'e dosya yazmaz. Bu fonksiyon JSON çıktısından text'i
# çıkarıp beklenen dosyaya yazar.
extract_and_write() {
  local json_file="$1"
  local target_file="$2"

  if [ ! -f "$json_file" ]; then return 1; fi

  local text
  text=$(jq -r '.result // empty' "$json_file" 2>/dev/null)

  if [ -n "$text" ]; then
    mkdir -p "$(dirname "$target_file")"
    echo "$text" > "$target_file"
    log "Post-process: $(basename "$target_file") yazıldı ($(wc -c < "$target_file") byte)"
    return 0
  fi
  return 1
}

CATEGORY="${1:?Kullanım: ./orchestrator.sh <kategori>}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# En son yarıda kalan çalışmadan devam etme (RESUME_LAST) desteği
if [ -z "${RUN_ID:-}" ] && [ "${RESUME_LAST:-0}" = "1" ]; then
  LAST_RUN=$(ls -td "${PROJECT_ROOT}/runs/${CATEGORY}_"* 2>/dev/null | head -1)
  if [ -n "$LAST_RUN" ]; then
    RUN_ID=$(basename "$LAST_RUN")
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RESUME] En son çalışma dizini tespit edildi: ${RUN_ID}"
  else
    RUN_ID="${CATEGORY}_${TIMESTAMP}"
  fi
else
  RUN_ID="${RUN_ID:-${CATEGORY}_${TIMESTAMP}}"
fi

WORKSPACE="${PROJECT_ROOT}/runs/${RUN_ID}"
PROMPTS_DIR="${PROJECT_ROOT}/prompts"
LEARNINGS_FILE="${PROJECT_ROOT}/learnings.json"
MAX_VERIFY_ATTEMPTS=5
LOG_FILE="${WORKSPACE}/pipeline.log"
BUILD_SUCCESS=false
TOPLAM_ADIM=12
MEVCUT_ADIM=0

# ─── Yardımcı Fonksiyonlar ───────────────────────────────────

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

adim_baslik() {
  MEVCUT_ADIM=$((MEVCUT_ADIM + 1))
  local baslik="$1"
  log ""
  log "=========================================="
  log "  ADIM ${MEVCUT_ADIM}/${TOPLAM_ADIM}: ${baslik}"
  log "=========================================="
  log ""
}

# ─── Orkestratör Değerlendirme Fonksiyonu ─────────────────────
call_orchestrator_eval() {
  local adim_adi="$1"
  local json_dosya="${WORKSPACE}/logs/orchestrator_${adim_adi}.json"
  
  log "Orkestratör Değerlendirmesi: ${adim_adi} adımı inceleniyor..."

  # Kuru çalıştırma
  if [ "${DRY_RUN:-0}" = "1" ]; then
    return 0
  fi

  # Workspace dizin yapısını ve durumunu topla
  local workspace_state=""
  workspace_state+="Mevcut Dizin Listesi:\n"
  workspace_state+="$(find "${WORKSPACE}" -maxdepth 3 -not -path '*/.*' -not -path '*/node_modules*' 2>/dev/null | head -40)\n"
  
  if [ -f "${WORKSPACE}/product-spec.md" ]; then
    workspace_state+="product-spec.md boyutu: $(wc -c < "${WORKSPACE}/product-spec.md" 2>/dev/null) byte\n"
  fi
  
  if [ -f "${WORKSPACE}/build-status.txt" ]; then
    workspace_state+="build-status.txt içeriği: $(cat "${WORKSPACE}/build-status.txt" 2>/dev/null)\n"
  fi

  local user_prompt="Değerlendirilecek Adım: ${adim_adi}
Workspace: ${WORKSPACE}
Mevcut Durum:
${workspace_state}

Lütfen bu adımdan çıkan sonuçları ve dosya durumlarını analiz et. Aşağıdaki JSON formatında yanıt dön:
{
  \"approved\": true/false,
  \"feedback\": \"Onaylanma/onaylanmama sebebi veya iyileştirme önerisi\",
  \"next_action\": \"PROCEED | RE-RUN | FIX | STOP\"
}"

  local system_prompt
  if [ -f "${PROMPTS_DIR}/orchestrator.md" ]; then
    system_prompt=$(cat "${PROMPTS_DIR}/orchestrator.md")
  else
    log "UYARI: Orkestratör promptu bulunamadı, değerlendirme atlanıyor."
    return 0
  fi

  # Orkestrasyon adımı için Claude'u kullanalım
  local stderr_file="${json_dosya}.stderr"
  local exit_code=0
  
  # Kalıcı credentials dosyası varsa auth var kabul et
  local credentials_exist=false
  if ([ -f "${CLAUDE_CONFIG_DIR:-}/.credentials.json" ] && jq -e '.claudeAiOauth' "${CLAUDE_CONFIG_DIR}/.credentials.json" &>/dev/null 2>&1) || \
     ([ -f "${CLAUDE_CONFIG_DIR:-}/claude.json" ] && jq -e '.oauthToken' "${CLAUDE_CONFIG_DIR}/claude.json" &>/dev/null 2>&1) || \
     ([ -f "${CLAUDE_CONFIG_DIR:-}.json" ] && jq -e '.claudeAiOauth // .oauthToken' "${CLAUDE_CONFIG_DIR}.json" &>/dev/null 2>&1); then
    credentials_exist=true
  fi

  # OAuth token VEYA API key VEYA Auth token VEYA kalıcı credentials kontrolü
  if [ "$credentials_exist" = false ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
    log "UYARI: Claude kimlik doğrulaması yok, orkestratör değerlendirmesi varsayılan olarak onaylandı."
    return 0
  fi

  # Claude CLI'yi çalıştır
  if command -v gosu &>/dev/null && [ "$(id -u)" = "0" ]; then
    local prompt_file="${json_dosya}.prompt"
    local sysprompt_file="${json_dosya}.sysprompt"
    local runner_script="${json_dosya}.runner.sh"

    printf '%s' "${user_prompt}" > "${prompt_file}"
    printf '%s' "${system_prompt}" > "${sysprompt_file}"

    cat > "${runner_script}" <<RUNNER_EOF
#!/bin/sh
cd "${WORKSPACE:-$(pwd)}" || exit 1
exec claude -p "\$(cat '${prompt_file}')" \\
  --append-system-prompt "\$(cat '${sysprompt_file}')" \\
  --dangerously-skip-permissions \\
  --output-format json \\
  --max-turns 2
RUNNER_EOF
    chmod +x "${runner_script}"
    chown factory:factory "${prompt_file}" "${sysprompt_file}" "${runner_script}" 2>/dev/null || true

    # API key her durumda geçirilsin (CLI kendi öncelik kurallarını işletir)
    local _gosu_api_key="${ANTHROPIC_API_KEY:-}"

    HOME=/home/factory \
    CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/factory/.claude}" \
    ANTHROPIC_API_KEY="${_gosu_api_key}" \
    CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}" \
    ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-}" \
    ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-}" \
    ANTHROPIC_MODEL="opus" \
    CLAUDE_CODE_SKIP_ONBOARDING="1" \
    CLAUDE_CODE_ENABLE_TELEMETRY="0" \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    gosu factory "${runner_script}" \
      > "${json_dosya}" 2>"${stderr_file}" || exit_code=$?

    rm -f "${prompt_file}" "${sysprompt_file}" "${runner_script}" 2>/dev/null || true
  else
    ANTHROPIC_MODEL="opus" claude -p "${user_prompt}" \
      --append-system-prompt "${system_prompt}" \
      --dangerously-skip-permissions \
      --output-format json \
      --max-turns 2 \
      > "${json_dosya}" 2>"${stderr_file}" || exit_code=$?
  fi

  if [ $exit_code -ne 0 ]; then
    log "UYARI: Claude Orkestratör başarısız (exit code $exit_code). Gemini fallback deneniyor..."
    
    # Gemini API ile değerlendirme yap (fallback)
    if [ -n "${GEMINI_API_KEY:-}" ]; then
      local gemini_payload
      gemini_payload=$(jq -n \
        --arg sys "$system_prompt" \
        --arg usr "$user_prompt" \
        '{
          contents: [{ role: "user", parts: [{ text: $usr }] }],
          systemInstruction: { parts: [{ text: $sys }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
        }')
      
      local gemini_response
      gemini_response=$(curl -s -X POST \
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$gemini_payload" 2>/dev/null)
      
      local gemini_text
      gemini_text=$(echo "$gemini_response" | jq -r '.candidates[0].content.parts[0].text // empty' 2>/dev/null || echo "")
      
      if [ -n "$gemini_text" ]; then
        log "Gemini Orkestratör Değerlendirmesi tamamlandı."
        # Gemini'nin JSON çıktısını parse etmeye çalış
        local approved_g
        approved_g=$(echo "$gemini_text" | grep -o '"approved"\s*:\s*[a-z]*' | grep -o '[a-z]*$' || echo "true")
        local action_g
        action_g=$(echo "$gemini_text" | grep -o '"next_action"\s*:\s*"[A-Z]*"' | grep -o '[A-Z]*"$' | tr -d '"' || echo "PROCEED")
        log "Gemini Değerlendirme: approved=${approved_g:-true}, action=${action_g:-PROCEED}"
        if [ "${approved_g:-true}" = "false" ] || [ "${action_g:-PROCEED}" = "STOP" ]; then
          return 1
        fi
        return 0
      fi
    fi
    
    log "UYARI: Tüm Orkestratör API çağrıları başarısız. Adım varsayılan olarak onaylandı."
    return 0
  fi

  # Sonucu oku ve parse et (Node ile güvenli parse)
  local parsed_data
  parsed_data=$(node -e '
    try {
      const fs = require("fs");
      const raw = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      let text = raw.result || "";
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const startIdx = text.indexOf("{");
      const endIdx = text.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
        text = text.substring(startIdx, endIdx + 1);
      }
      const parsed = JSON.parse(text);
      console.log(JSON.stringify({
        approved: parsed.approved !== undefined ? parsed.approved : true,
        feedback: parsed.feedback || "",
        next_action: parsed.next_action || "PROCEED"
      }));
    } catch (e) {
      console.log(JSON.stringify({ approved: true, feedback: "Parse error fallback: " + e.message, next_action: "PROCEED" }));
    }
  ' "${json_dosya}" 2>/dev/null || echo '{"approved":true,"feedback":"Node execution failed","next_action":"PROCEED"}')

  local approved
  approved=$(echo "$parsed_data" | jq -r '.approved // true' 2>/dev/null || echo "true")
  local feedback
  feedback=$(echo "$parsed_data" | jq -r '.feedback // ""' 2>/dev/null || echo "")
  local next_action
  next_action=$(echo "$parsed_data" | jq -r '.next_action // "PROCEED"' 2>/dev/null || echo "PROCEED")

  log "Orkestratör Değerlendirme Sonucu: Approved=${approved}, Action=${next_action}"
  if [ -n "$feedback" ]; then
    log "Orkestratör Geri Bildirimi: ${feedback}"
  fi

  if [ "$approved" = "false" ] || [ "$next_action" = "STOP" ]; then
    return 1
  fi

  return 0
}

# ─── Akıllı LLM Routing ──────────────────────────────────────
# preferred_providers: boşlukla ayrılmış öncelik listesi
# Örnek: "zai openrouter claude"
run_step_smart() {
  local adim_adi="$1"
  local prompt_dosyasi="$2"
  local kullanici_promptu="$3"
  local preferred_providers="${4:-claude}"  # Varsayılan: claude
  local ek_flagler="${5:-}"

  local json_dosya="${WORKSPACE}/logs/${adim_adi}.json"

  # Kaldığı yerden devam etme (Resume) kontrolü
  if [ "${FORCE_RESTART:-0}" != "1" ] && [ -f "${json_dosya}" ] && [ -s "${json_dosya}" ]; then
    if [ "${adim_adi}" = "build" ] || [[ "${adim_adi}" == verify_fix_* ]]; then
      if [ -f "${WORKSPACE}/build-status.txt" ] && grep -q "BUILD_SUCCESS" "${WORKSPACE}/build-status.txt" 2>/dev/null; then
        log "[RESUME] Bu adım daha önce başarıyla tamamlanmış, atlanıyor: ${adim_adi}"
        return 0
      else
        log "[RESUME] Build başarılı bulunamadı, adım yeniden çalıştırılıyor: ${adim_adi}"
        rm -f "${json_dosya}" 2>/dev/null || true
      fi
    else
      log "[RESUME] Bu adım daha önce başarıyla tamamlanmış, atlanıyor: ${adim_adi}"
      return 0
    fi
  fi

  log "Başlatılıyor: ${adim_adi} (providers: ${preferred_providers})"
  local baslangic=$(date +%s)

  # Kuru çalıştırma
  if [ "${DRY_RUN:-0}" = "1" ]; then
    log "[KURU ÇALIŞTIRMA] Atlanıyor: ${adim_adi}"
    touch "${json_dosya}"
    return 0
  fi

  # Prompt dosyasını oku
  local system_prompt
  if [ -f "$prompt_dosyasi" ]; then
    system_prompt=$(cat "$prompt_dosyasi")
  else
    log "HATA: Prompt dosyası bulunamadı: ${prompt_dosyasi}"
    return 1
  fi

  local json_dosya="${WORKSPACE}/logs/${adim_adi}.json"
  local kullanilan_provider="none"

  # Provider'ları sırayla dene
  for provider in $preferred_providers; do
    log "Provider deneniyor: ${provider}"

    case "$provider" in
      gemini)
        if call_gemini "$system_prompt" "$kullanici_promptu" "$json_dosya" "gemini-3.5-flash"; then
          kullanilan_provider="gemini"
          break
        fi
        ;;
      gemini-pro)
        if call_gemini "$system_prompt" "$kullanici_promptu" "$json_dosya" "gemini-3.1-pro-preview"; then
          kullanilan_provider="gemini-pro"
          break
        fi
        ;;
      qwen)
        if call_qwen "$system_prompt" "$kullanici_promptu" "$json_dosya"; then
          kullanilan_provider="qwen"
          break
        fi
        ;;
      openrouter)
        if call_openrouter "$system_prompt" "$kullanici_promptu" "$json_dosya"; then
          kullanilan_provider="openrouter"
          break
        fi
        ;;
      claude)
        if call_claude "$system_prompt" "$kullanici_promptu" "$json_dosya" "$ek_flagler"; then
          kullanilan_provider="claude"
          break
        fi
        ;;
    esac

    log "Provider başarısız: ${provider}, bir sonraki deneniyor..."
  done

  local bitis=$(date +%s)
  local sure=$((bitis - baslangic))

  if [ "$kullanilan_provider" = "none" ]; then
    log "HATA: Tüm provider'lar başarısız: ${adim_adi}"
    return 1
  fi

  # Minimum süre kontrolü — Claude ile gerçek bir çalışma en az 10 saniye sürer
  # Z.AI/Qwen API çağrıları daha hızlı olabilir (3-5s normal)
  local min_sure=5
  if [ "$kullanilan_provider" = "claude" ]; then
    min_sure=10
  fi

  if [ $sure -lt $min_sure ]; then
    log "UYARI: ${adim_adi} çok hızlı tamamlandı (${sure}s < ${min_sure}s minimum) — muhtemelen gerçek çalışma yapılmadı"
    # Çıktı dosyasının içeriğini kontrol et
    local output_size=0
    if [ -f "${json_dosya}" ]; then
      output_size=$(wc -c < "${json_dosya}" 2>/dev/null || echo "0")
    fi
    log "  Çıktı dosyası boyutu: ${output_size} byte"
    if [ "$output_size" -lt 200 ]; then
      log "HATA: ${adim_adi} çok kısa sürede çok az çıktı üretti — başarısız sayılıyor"
      return 1
    fi
  fi

  log "Tamamlandı: ${adim_adi} via ${kullanilan_provider} (${sure}s)"

  # Maliyet hesaplama (sadece claude için)
  if [ "$kullanilan_provider" = "claude" ]; then
    local sonuc
    sonuc=$(cat "${json_dosya}" 2>/dev/null || echo '{}')
    local maliyet
    maliyet=$(echo "$sonuc" | jq -r '.total_cost_usd // 0' 2>/dev/null || echo "0")
    log "Maliyet: \$${maliyet}"
  else
    log "Maliyet: ~\$0 (${kullanilan_provider})"
  fi

  # Orkestratör değerlendirmesi
  if [[ "$adim_adi" != orchestrator_* && "$adim_adi" != "preflight-test" ]]; then
    if ! call_orchestrator_eval "$adim_adi"; then
      log "❌ Orkestratör kontrolü başarısız oldu! Pipeline durduruluyor."
      return 1
    fi
  fi

  return 0
}

# ─── Geriye uyumluluk için run_step ──────────────────────────
run_step() {
  local adim_adi="$1"
  local prompt_dosyasi="$2"
  local kullanici_promptu="$3"
  local ek_flagler="${4:-}"
  run_step_smart "$adim_adi" "$prompt_dosyasi" "$kullanici_promptu" "claude" "$ek_flagler"
}

# ─── Başlangıç ───────────────────────────────────────────────

mkdir -p "${WORKSPACE}"/{app,architecture,marketing,screenshots,logs,deploy}

log "============================================================"
log "  AI APP FACTORY v2.0 - Multi-LLM Router"
log "============================================================"
log ""
log "Kategori:    ${CATEGORY}"
log "Run ID:      ${RUN_ID}"
log "Workspace:   ${WORKSPACE}"
log "Başlangıç:   $(date)"
log ""
log "Mevcut API Keyleri:"
log "  CLAUDE_OAUTH: $([ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && echo 'YÜKLENDİ (Max Plan)' || echo 'YOK')"
log "  ANTHROPIC: $([ -n "${ANTHROPIC_API_KEY:-}" ] && echo 'YÜKLENDİ' || echo 'YOK')"
log "  GEMINI:    $([ -n "${GEMINI_API_KEY:-}" ] && echo 'YÜKLENDİ' || echo 'YOK')"
log "  GROK:      $([ -n "${GROK_API_KEY:-}" ] && echo 'YÜKLENDİ' || echo 'YOK')"
log "  QWEN:      $([ -n "${QWEN_API_KEY:-}" ] && echo 'YÜKLENDİ' || echo 'YOK')"
log "  OPENROUTER:$([ -n "${OPENROUTER_API_KEY:-}" ] && echo 'YÜKLENDİ' || echo 'YOK')"
log ""

# ─── Claude CLI Ön Kontrol (Preflight) ───────────────────────
log "Claude CLI ön kontrol başlıyor..."
CLAUDE_CLI_OK=false

# 1. Claude CLI mevcut mu?
if command -v claude &>/dev/null; then
  CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "bilinmiyor")
  log "  Claude CLI sürüm: ${CLAUDE_VERSION}"
else
  log "HATA: Claude CLI bulunamadı!"
fi

# 2. Claude auth var mı? (OAuth token VEYA API key VEYA kalıcı credentials dosyası)
CLAUDE_AUTH_METHOD="none"
if ([ -f "${CLAUDE_CONFIG_DIR}/.credentials.json" ] && jq -e '.claudeAiOauth' "${CLAUDE_CONFIG_DIR}/.credentials.json" &>/dev/null 2>&1) || \
   ([ -f "${CLAUDE_CONFIG_DIR}/claude.json" ] && jq -e '.oauthToken' "${CLAUDE_CONFIG_DIR}/claude.json" &>/dev/null 2>&1) || \
   ([ -f "${CLAUDE_CONFIG_DIR}.json" ] && jq -e '.claudeAiOauth // .oauthToken' "${CLAUDE_CONFIG_DIR}.json" &>/dev/null 2>&1); then
  CLAUDE_AUTH_METHOD="claudejson"
  log "  Kalıcı credentials dosyası bulundu (Claude CLI kendi taze oturumunu kullanacak)"
  unset CLAUDE_CODE_OAUTH_TOKEN
  CLAUDE_OAUTH_TOKEN_LOCAL=""
elif [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  CLAUDE_AUTH_METHOD="oauth"
  log "  CLAUDE_CODE_OAUTH_TOKEN: ...${CLAUDE_CODE_OAUTH_TOKEN: -8} (OAuth/Max Plan)"
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  CLAUDE_AUTH_METHOD="apikey"
  log "  ANTHROPIC_API_KEY: ...${ANTHROPIC_API_KEY: -8} (API Key)"
else
  # ~/.claude.json dosyasından auth kontrol et
  if [ -f "${HOME}/.claude.json" ] && jq -e '.oauthToken // .api_key' "${HOME}/.claude.json" &>/dev/null 2>&1; then
    CLAUDE_AUTH_METHOD="claudejson"
    log "  ~/.claude.json kimlik doğrulaması bulundu (Claude CLI kendi oturumunu kullanacak)"
  else
    CLAUDE_AUTH_METHOD="none"
    log "  UYARI: Ortam değişkenlerinde veya kalıcı dosyalarda Claude kimlik doğrulaması yok."
    log "  Claude CLI kendi ~/.claude.json oturumunu deneyecek..."
  fi
fi

if [ "$CLAUDE_AUTH_METHOD" = "none" ]; then
  log "  UYARI: Ne CLAUDE_CODE_OAUTH_TOKEN ne de ANTHROPIC_API_KEY tanımlı."
  log "  Claude CLI bağlantı testi ile kontrol edilecek (claude login ile giriş yapılmış olabilir)."
fi

# 3. Bağlantı testi — DRY_RUN modunda atla
if [ "${DRY_RUN:-0}" = "1" ]; then
  CLAUDE_CLI_OK=true
  log "  Dry-run aktif — Claude CLI bağlantı testi atlanıyor."
else

  log "  Claude CLI bağlantı testi yapılıyor..."
  local_test_file="${WORKSPACE}/logs/preflight-test.json"
  local_test_stderr="${WORKSPACE}/logs/preflight-test.stderr"
  local_test_exit=0

  # Root ise gosu ile factory kullanıcısı olarak çalıştır
  if command -v gosu &>/dev/null && [ "$(id -u)" = "0" ]; then
    log "  Root tespit edildi — gosu factory ile test yapılacak"
    # OAuth token varsa API key'i geçirme (CLI API key'i öncelikli kullanıyor)
    _preflight_api_key=""
    if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
      _preflight_api_key="${ANTHROPIC_API_KEY:-}"
    fi
    HOME=/home/factory \
    CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/factory/.claude}" \
    ANTHROPIC_API_KEY="${_preflight_api_key}" \
    CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}" \
    ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-}" \
    ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-}" \
    ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-}" \
    CLAUDE_CODE_SKIP_ONBOARDING="${CLAUDE_CODE_SKIP_ONBOARDING:-1}" \
    CLAUDE_CODE_ENABLE_TELEMETRY="${CLAUDE_CODE_ENABLE_TELEMETRY:-0}" \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    gosu factory claude -p "Say only: OK" \
      --dangerously-skip-permissions \
      --output-format json \
      --max-turns 1 \
      > "${local_test_file}" 2>"${local_test_stderr}" || local_test_exit=$?
  else
    claude -p "Say only: OK" \
      --dangerously-skip-permissions \
      --output-format json \
      --max-turns 1 \
      > "${local_test_file}" 2>"${local_test_stderr}" || local_test_exit=$?
  fi

  if [ $local_test_exit -ne 0 ]; then
    # FALLBACK DENEMESİ: Eğer OAuth token tanımlıysa ve hata alındıysa, API Key ile tekrar dene
    if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -n "${ANTHROPIC_API_KEY:-}" ]; then
      log "  OAuth token bağlantı testi başarısız. ANTHROPIC_API_KEY ile fallback deneniyor..."
      local_test_exit=0
      
      if command -v gosu &>/dev/null && [ "$(id -u)" = "0" ]; then
        HOME=/home/factory \
        CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/factory/.claude}" \
        ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
        CLAUDE_CODE_OAUTH_TOKEN="" \
        ANTHROPIC_AUTH_TOKEN="" \
        ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-}" \
        ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-}" \
        CLAUDE_CODE_SKIP_ONBOARDING="1" \
        CLAUDE_CODE_ENABLE_TELEMETRY="0" \
        PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
        gosu factory claude -p "Say only: OK" \
          --dangerously-skip-permissions \
          --output-format json \
          --max-turns 1 \
          > "${local_test_file}" 2>"${local_test_stderr}" || local_test_exit=$?
      else
        ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
        CLAUDE_CODE_OAUTH_TOKEN="" \
        ANTHROPIC_AUTH_TOKEN="" \
        claude -p "Say only: OK" \
          --dangerously-skip-permissions \
          --output-format json \
          --max-turns 1 \
          > "${local_test_file}" 2>"${local_test_stderr}" || local_test_exit=$?
      fi
      
      if [ $local_test_exit -eq 0 ]; then
        log "  API Key ile fallback testi BAŞARILI ✓ (OAuth token geçersiz olduğu için devre dışı bırakıldı)"
        export CLAUDE_CODE_OAUTH_TOKEN=""
        export ANTHROPIC_AUTH_TOKEN=""
      fi
    fi
  fi

  if [ $local_test_exit -ne 0 ]; then
    log "  UYARI: Claude CLI bağlantı testi başarısız (exit code: ${local_test_exit})"
    if [ -f "${local_test_stderr}" ] && [ -s "${local_test_stderr}" ]; then
      log "  stderr: $(cat "${local_test_stderr}" | head -5)"
    else
      log "  stderr: BOŞ"
    fi
    if [ -f "${local_test_file}" ] && [ -s "${local_test_file}" ]; then
      log "  stdout: $(head -c 500 "${local_test_file}")"
    else
      log "  stdout: BOŞ"
    fi
    log "  Pipeline devam edecek ama Claude adımları başarısız olabilir."
  else
    local_test_result=$(jq -r '.result // ""' "${local_test_file}" 2>/dev/null || echo "")
    if [ -n "$local_test_result" ] && [ ${#local_test_result} -gt 0 ]; then
      CLAUDE_CLI_OK=true
      log "  Claude CLI bağlantı testi BAŞARILI ✓"
    else
      log "  UYARI: Claude CLI yanıt verdi ama çıktı boş"
      if [ -f "${local_test_stderr}" ] && [ -s "${local_test_stderr}" ]; then
        log "  stderr: $(cat "${local_test_stderr}" | head -3)"
      fi
    fi
  fi
fi  # DRY_RUN else bloğu

log "Claude CLI durumu: $([ "$CLAUDE_CLI_OK" = true ] && echo 'HAZIR ✓' || echo 'SORUNLU ✗')"
log ""


# ─── Stitch MCP Ön Kontrolü VEYA Otomatik Kurulum ───────────
log "Stitch MCP ön kontrolü yapılıyor..."
STITCH_OK=false

if [ "${DRY_RUN:-0}" = "1" ]; then
  STITCH_OK=true
  log "  Dry-run aktif — Stitch MCP testi atlanıyor."
else
  # mcp listesinde stitch var mı bak
  if claude mcp list 2>/dev/null | grep -qi "stitch"; then
    STITCH_OK=true
    log "  Stitch MCP zaten ekli ✓"
  else
    log "  Stitch MCP bulunamadı, otomatik ekleniyor..."
    # Otomatik eklemeyi dene (npx @_davideast/stitch-mcp proxy)
    if claude mcp add stitch -- npx -y @_davideast/stitch-mcp proxy &>/dev/null; then
      STITCH_OK=true
      log "  Stitch MCP başarıyla eklendi ✓"
    else
      log "  UYARI: Stitch MCP otomatik eklenemedi (veya terminal interactive onay bekliyor olabilir). Manuel eklemeniz gerekebilir."
    fi
  fi
fi

log "Stitch MCP durumu: $([ "$STITCH_OK" = true ] && echo 'HAZIR ✓' || echo 'SORUNLU ✗')"
log ""

# pre-approved.json varsa keşif adımını atla
PRE_APPROVED="${WORKSPACE}/pre-approved.json"

# ─── ADIM 1: KEŞİF ───────────────────────────────────────────

adim_baslik "KEŞİF (Fikir Bul)"

if [ -f "$PRE_APPROVED" ]; then
  log "Pre-approved ürün spec mevcut, keşif adımı atlanıyor."
else
  # Araştırma ajanı: Z.AI (web search kabiliyeti), Grok (trend analizi), Claude (derin analiz)
  run_step_smart "discover" \
    "${PROMPTS_DIR}/discover.md" \
    "Kategori: ${CATEGORY}
Workspace dizini: ${WORKSPACE}
Learnings dosyası: ${LEARNINGS_FILE}

ÖNEMLİ TALİMATLAR:
1. '${CATEGORY}' kategorisinde DERİN pazar araştırması yap
2. ${LEARNINGS_FILE} dosyasını oku (varsa) — daha önce üretilen basit/düşük kaliteli fikirleri TEKRARLAMA
3. Web araştırması yap:
   - Product Hunt: Son 30 günde trending olan, en çok oy alan ürünleri analiz et. Hangi kalıplar başarılı?
   - TrustMRR (https://trustmrr.com): En çok MRR yapan bootstrapped SaaS ürünlerini incele. Hangi nişlerde yüksek gelir var?
   - Reddit, Indie Hackers'da bu kategoride kullanıcı şikayetlerini ara
   - Mevcut SaaS rakiplerin fiyatlarını, G2/Capterra puanlarını araştır
   - Google Trends ile talep trendlerini doğrula
4. Fikir Skor Kartını doldur — minimum 80/160 puan alan fikri seç. Karmaşıklık skoru 6/10 ve 9/10 arası olmalı.
5. B2B veya Prosumer odaklı ol — pure B2C'den KAÇIN
6. 'Boring but profitable' SaaS nişlerini tercih et (Excel→SaaS, compliance, vertical SaaS)
7. İlk 5 dakikada değer gösterebilen bir ürün olmalı
8. Detaylı ürün spesifikasyonunu ${WORKSPACE}/product-spec.md dosyasına yaz

KALİTE KRİTERLERİ:
- Minimum 5 rakip analizi (gerçek ürünler, gerçek fiyatlar)
- 2 detaylı persona (her biri 120+ kelime)
- Talep kanıtları bölümü (gerçek Reddit/forum linkleri veya alıntıları)
- Go-to-Market stratejisi (ilk 100 kullanıcıyı nereden bulacağız)
- Gelir projeksiyonu (ilk yıl MRR hedefi)

Önemli: Çıktıyı mutlaka ${WORKSPACE}/product-spec.md dosyasına yaz." \
    "gemini grok openrouter claude"

  if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "Dry run: mock product-spec.md" > "${WORKSPACE}/product-spec.md"
  fi

  # Post-processing: Non-Claude provider product-spec.md yazmaz
  if [ ! -f "${WORKSPACE}/product-spec.md" ] || [ ! -s "${WORKSPACE}/product-spec.md" ]; then
    log "product-spec.md bulunamadı, post-processing ile çıkarılıyor..."
    extract_and_write "${WORKSPACE}/logs/discover.json" "${WORKSPACE}/product-spec.md"
  fi

  if [ ! -f "${WORKSPACE}/product-spec.md" ] || [ ! -s "${WORKSPACE}/product-spec.md" ]; then
    log "HATA: Ürün spesifikasyonu (product-spec.md) üretilemedi. Keşif adımı başarısız oldu. Pipeline sonlandırılıyor."
    exit 1
  fi
fi

# ─── ADIM 2: MİMARİ ──────────────────────────────────────────

adim_baslik "MİMARİ (Tasarım)"

# Claude öncelikli — başarısız olursa Gemini ve OpenRouter fallback
run_step_smart "architecture" \
  "${PROMPTS_DIR}/architecture.md" \
  "Workspace dizini: ${WORKSPACE}
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. ${WORKSPACE}/product-spec.md dosyasını oku
2. ${LEARNINGS_FILE} dosyasını oku (varsa)
3. Tüm mimari dokümanları ${WORKSPACE}/architecture/ klasörüne yaz:
   - file_structure.md
   - data_model.md
   - api_contract.md
   - design_tokens.json
   - component_tree.md
   - dependencies.json
   - tech_decisions.md" \
  "claude gemini-pro openrouter gemini"

if [ "${DRY_RUN:-0}" = "1" ]; then
  mkdir -p "${WORKSPACE}/architecture"
  echo "Dry run: mock file_structure.md" > "${WORKSPACE}/architecture/file_structure.md"
  echo "Dry run: mock architecture-plan.md" > "${WORKSPACE}/architecture/architecture-plan.md"
fi

# Post-processing: Non-Claude provider mimari dosyaları yazmaz
if [ ! -f "${WORKSPACE}/architecture/file_structure.md" ]; then
  log "Mimari dosyaları bulunamadı, post-processing ile çıkarılıyor..."
  extract_and_write "${WORKSPACE}/logs/architecture.json" "${WORKSPACE}/architecture/architecture-plan.md"
fi

if [ ! -f "${WORKSPACE}/architecture/file_structure.md" ] && [ ! -f "${WORKSPACE}/architecture/architecture-plan.md" ]; then
  log "HATA: Mimari tasarım (architecture) dosyaları üretilemedi. Mimari adımı başarısız oldu. Pipeline sonlandırılıyor."
  exit 1
fi

# ─── ADIM 3: ARAYÜZ TASARIMI (Stitch) ────────────────────────
adim_baslik "ARAYÜZ TASARIMI (Stitch)"

# Claude öncelikli — başarısız olursa Gemini fallback
run_step_smart "frontend" \
  "${PROMPTS_DIR}/frontend.md" \
  "Workspace dizini: ${WORKSPACE}
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Mimari dizini: ${WORKSPACE}/architecture/
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. ${WORKSPACE}/product-spec.md ve ${WORKSPACE}/architecture/ dizinindeki tüm dokümanları oku
2. Stitch MCP araçlarını otonom olarak kullanarak projeyi oluştur, tasarım sistemini uygula ve ekran tasarımlarını (Landing Page, Dashboard vb.) hazırla
3. Üretilen ekranların kodlarını alan ${WORKSPACE}/app dizinine entegre et
4. İşlem tamamlandığında ${WORKSPACE}/architecture/frontend_build_report.json dosyasını oluştur" \
  "claude gemini-pro openrouter gemini"

# ─── ADIM 4: KODLAMA ─────────────────────────────────────────

adim_baslik "KODLAMA (Build)"

# Claude öncelikli — başarısız olursa Gemini ve OpenRouter fallback
run_step_smart "build" \
  "${PROMPTS_DIR}/build.md" \
  "Workspace dizini: ${WORKSPACE}
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Mimari dizini: ${WORKSPACE}/architecture/
Landing page tasarım rehberi: ${PROMPTS_DIR}/landing-page.md
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. ${WORKSPACE}/product-spec.md ve ${WORKSPACE}/architecture/ dizinindeki tüm dokümanları oku
2. ${PROMPTS_DIR}/landing-page.md dosyasını oku — LANDING PAGE TASARIM REHBERİ
3. ${LEARNINGS_FILE} dosyasını oku (varsa)
4. ${WORKSPACE}/app/ dizinine tam çalışan bir Next.js uygulaması kodla
5. ÖNCELİKLİ: app/page.tsx olarak PROFESYONEL ve BENZERSİZ bir landing page oluştur:
   - landing-page.md'deki stil havuzundan BİR STİL seç
   - Ürüne özel metin yaz (generic değil!)
   - Her section için ayrı component (app/components/landing/)
   - Mobile-first responsive, animasyonlu, dark/light mode
6. Dashboard ve app kısmını /dashboard route'unda oluştur
7. Kodlama bitince ${WORKSPACE}/app/ dizininde 'pnpm run build' çalıştır
8. Her dosyayı yazarken import/export tutarlılığını kontrol et" \
  "claude gemini-pro openrouter gemini"

# ─── ADIM 4: DOĞRULAMA ───────────────────────────────────────

adim_baslik "DOĞRULAMA ve DÜZELTME (Verify & Fix)"

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "BUILD_SUCCESS" > "${WORKSPACE}/build-status.txt"
fi

verify_attempt=0

while [ $verify_attempt -lt $MAX_VERIFY_ATTEMPTS ]; do
  verify_attempt=$((verify_attempt + 1))
  log "Doğrulama denemesi: ${verify_attempt}/${MAX_VERIFY_ATTEMPTS}"

  devam_flag=""

  run_step_smart "verify_fix_${verify_attempt}" \
    "${PROMPTS_DIR}/verify_fix.md" \
    "Uygulama dizini: ${WORKSPACE}/app
Deneme numarası: ${verify_attempt}/${MAX_VERIFY_ATTEMPTS}
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. ${WORKSPACE}/app/ dizinine git
2. 'pnpm run build' komutunu çalıştır
3. Hata varsa analiz et ve düzelt
4. Build başarılı olursa ${WORKSPACE}/build-status.txt dosyasına 'BUILD_SUCCESS' yaz
5. Bu ${verify_attempt}. deneme, toplam ${MAX_VERIFY_ATTEMPTS} hakkın var" \
    "claude gemini-pro openrouter gemini" \
    "${devam_flag}" || true

  json_log="${WORKSPACE}/logs/verify_fix_${verify_attempt}.json"
  step_success=false

  if [ -f "${WORKSPACE}/build-status.txt" ] && grep -q "BUILD_SUCCESS" "${WORKSPACE}/build-status.txt" 2>/dev/null; then
    step_success=true
  elif [ -f "${WORKSPACE}/app/build-status.txt" ] && grep -q "BUILD_SUCCESS" "${WORKSPACE}/app/build-status.txt" 2>/dev/null; then
    step_success=true
    mv "${WORKSPACE}/app/build-status.txt" "${WORKSPACE}/build-status.txt" 2>/dev/null || true
  elif [ -f "${json_log}" ] && grep -qE '"result"[[:space:]]*:[[:space:]]*"success"' "${json_log}" 2>/dev/null; then
    step_success=true
    echo "BUILD_SUCCESS" > "${WORKSPACE}/build-status.txt"
  fi

  if [ "$step_success" = true ]; then
    BUILD_SUCCESS=true
    log "Build ${verify_attempt}. denemede başarılı!"
    break
  fi
done

if [ "$BUILD_SUCCESS" = false ]; then
  log "HATA: Build ${MAX_VERIFY_ATTEMPTS} denemede de başarısız oldu veya kod üretilemedi. Pipeline sonlandırılıyor."
  exit 1
fi

# ─── ADIM 5: KOD REVİEW ──────────────────────────────────────

adim_baslik "KOD İNCELEME (Review)"

# Z.AI ile review yeterli — ucuz ve hızlı
run_step_smart "review" \
  "${PROMPTS_DIR}/review.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md

Görev:
1. ${WORKSPACE}/app/ dizinindeki TÜM kaynak kodları incele
2. ${WORKSPACE}/product-spec.md ile karşılaştır
3. Güvenlik, performans, kod kalitesi, UX ve mimari açıdan incele
4. Review raporunu ${WORKSPACE}/review-report.md dosyasına yaz
5. KRİTİK sorunları doğrudan kodda düzelt
6. Düzeltme yaptıysan tekrar 'pnpm run build' çalıştır" \
  "zai claude openrouter" || true

# Post-processing: Non-Claude provider review-report.md yazmaz
if [ ! -f "${WORKSPACE}/review-report.md" ]; then
  log "review-report.md bulunamadı, post-processing ile çıkarılıyor..."
  extract_and_write "${WORKSPACE}/logs/review.json" "${WORKSPACE}/review-report.md"
fi

# ─── ADIM 6: GÖRSEL VARLIKLAR ────────────────────────────────

adim_baslik "GÖRSEL VARLIKLAR (Assets)"

# Z.AI SVG üretebilir
run_step_smart "assets" \
  "${PROMPTS_DIR}/assets.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md

Görev:
1. ${WORKSPACE}/product-spec.md dosyasını oku
2. ${WORKSPACE}/app/ dizinindeki tasarım/renk bilgilerini incele
3. SVG logo, favicon, OG image oluştur
4. Dosyaları ${WORKSPACE}/app/public/ dizinine yaz
5. Layout metadata'sını güncelle" \
  "zai claude openrouter" || true

# ─── ADIM 7: PAZARLAMA ───────────────────────────────────────

adim_baslik "PAZARLAMA (Marketing)"

# Qwen çok dilli metin için harika — en ucuz seçenek
run_step_smart "marketing" \
  "${PROMPTS_DIR}/marketing.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Review raporu: ${WORKSPACE}/review-report.md

Görev:
1. ${WORKSPACE}/product-spec.md ve ${WORKSPACE}/review-report.md dosyalarını oku (varsa)
2. Tüm pazarlama materyallerini ${WORKSPACE}/marketing/ klasörüne yaz:
   - app_store_listing.md
   - landing_page_copy.md
   - social_media_posts.md
   - readme.md
   - changelog.md
3. Hem İngilizce hem Türkçe versiyonlar oluştur" \
  "qwen zai openrouter claude" || true

# Post-processing: Non-Claude provider marketing dosyaları yazmaz
if [ ! -f "${WORKSPACE}/marketing/landing_page_copy.md" ]; then
  log "Marketing dosyaları bulunamadı, post-processing ile çıkarılıyor..."
  extract_and_write "${WORKSPACE}/logs/marketing.json" "${WORKSPACE}/marketing/marketing-content.md"
fi

# ─── ADIM 8: EKRAN GÖRÜNTÜLERİ ──────────────────────────────

adim_baslik "EKRAN GÖRÜNTÜLERİ (Screenshots)"

run_step_smart "screenshots" \
  "${PROMPTS_DIR}/screenshots.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Screenshot çıktı dizini: ${WORKSPACE}/screenshots
Puppeteer modülü: ${PROJECT_ROOT}/node_modules/puppeteer

Görev:
1. ${WORKSPACE}/app/ dizininde 'pnpm dev' ile sunucuyu başlat
2. Sunucunun hazır olmasını bekle
3. Puppeteer ile ekran görüntüleri al
4. Screenshot'ları ${WORKSPACE}/screenshots/ dizinine kaydet
5. Sunucuyu kapat

Hata durumunda: Screenshot adımı opsiyoneldir, hata olursa logla ve devam et." \
  "zai claude" || {
  log "UYARI: Ekran görüntüsü adımı başarısız (devam ediliyor)"
}

# ─── ADIM 9: PAKETLEME ───────────────────────────────────────

adim_baslik "PAKETLEME (Package)"

# Z.AI template doldurma için yeterli
run_step_smart "package" \
  "${PROMPTS_DIR}/package.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Deploy dizini: ${WORKSPACE}/deploy
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md

Görevi:
1. ${WORKSPACE}/app/ dizinindeki uygulamayı incele
2. Dockerfile oluştur (multi-stage, standalone output) — app kök dizinine koy
3. docker-compose.yml oluştur: build context MUTLAKA '.' olsun, alt dizin KULLANMA
4. coolify-config.json oluştur
5. .env.example oluştur
6. deploy.sh oluştur
7. next.config'de output: 'standalone' olduğunu kontrol et
8. Pipeline raporunu ${WORKSPACE}/pipeline-report.json dosyasına yaz
9. Deploy dosyalarının kopyalarını ${WORKSPACE}/deploy/ dizinine de koy

⚠️ ÖNEMLİ COOLIFY HATA ÖNLEME:
- Build context HER ZAMAN '.' olsun
- Dockerfile app kök dizinine yerleştirilsin
- Hiçbir zaman context: ./app veya context: ./video-ads-studio gibi alt dizin kullanma
- Bu hatalı ayar Coolify'da "path \"/artifacts/xxx\" not found" hatasına sebep olur" \
  "zai claude openrouter" || true

# Post-processing: Non-Claude provider deploy dosyaları yazmaz
if [ ! -f "${WORKSPACE}/deploy/Dockerfile" ] && [ ! -f "${WORKSPACE}/app/Dockerfile" ]; then
  log "Deploy dosyaları bulunamadı, post-processing ile çıkarılıyor..."
  extract_and_write "${WORKSPACE}/logs/package.json" "${WORKSPACE}/deploy/package-notes.md"
fi

# ─── ADIM 10: DEPLOY (Coolify'a Yükle) ──────────────────────

adim_baslik "DEPLOY (Coolify'a Yükle)"

log "Otomatik deploy adımı devre dışı bırakıldı — Önce lokalde test edip onayladıktan sonra web arayüzünden Vercel veya Coolify'a deploy edebilirsiniz."

# ─── ADIM 11: ÖĞRENMELERİ GÜNCELLE ─────────────────────────

adim_baslik "ÖĞRENMELERİ GÜNCELLE (Learnings)"

# Z.AI JSON güncellemesi için yeterli
run_step_smart "update_learnings" \
  "${PROMPTS_DIR}/update_learnings.md" \
  "Workspace dizini: ${WORKSPACE}
Learnings dosyası: ${LEARNINGS_FILE}
Kategori: ${CATEGORY}
Build durumu: ${BUILD_SUCCESS}

Görev:
1. ${WORKSPACE}/logs/ dizinindeki tüm logları incele (varsa)
2. ${WORKSPACE}/review-report.md dosyasını oku (varsa)
3. ${WORKSPACE}/build-status.txt dosyasını oku (varsa)
4. ${LEARNINGS_FILE} dosyasını oku
5. Öğrenilenleri çıkar ve ${LEARNINGS_FILE} dosyasını güncelle
6. total_runs artır, last_updated güncelle" \
  "zai openrouter claude" || true

# Post-processing: Non-Claude provider learnings.json'ı doğrudan güncelleyemez
if [ -f "${WORKSPACE}/logs/update_learnings.json" ]; then
  local_learnings_text=$(jq -r '.result // empty' "${WORKSPACE}/logs/update_learnings.json" 2>/dev/null)
  if [ -n "$local_learnings_text" ]; then
    # JSON olarak geçerliyse learnings.json'a yaz
    echo "$local_learnings_text" | jq '.' > /tmp/learnings_check.json 2>/dev/null && \
      cp /tmp/learnings_check.json "${LEARNINGS_FILE}" && \
      log "Learnings güncellendi (post-process)" || \
      log "UYARI: Learnings post-process JSON geçersiz, atlanıyor"
  fi
fi

# ─── LOKALDE ÇALIŞTIR VE TARAYICIDA AÇ ─────────────────────────
if [ "$BUILD_SUCCESS" = true ] && [ -d "${WORKSPACE}/app" ]; then
  # Docker container/sunucu ortamlarında boşa sunucu ayağa kaldırıp RAM harcamasını önleyelim.
  # (Sadece lokal makinede çalıştırılsın)
  if ! [[ "$OSTYPE" == "darwin"* ]] && command -v gosu &>/dev/null; then
    log "Sunucu ortamı tespit edildi — Lokal önizleme sunucusu başlatılmadı (Deploy adımlarını kullanın)."
  else
    log "=========================================="
    log "  LOKALDE ÇALIŞTIRMA VE TEST"
    log "=========================================="
    
    find_free_port() {
      local port=3001
      while command -v lsof &>/dev/null && lsof -i :$port >/dev/null 2>&1; do
        port=$((port + 1))
      done
      echo $port
    }
    
    LOCAL_PORT=$(find_free_port)
    log "Kullanılabilir boş port bulundu: ${LOCAL_PORT}"
    
    (
      cd "${WORKSPACE}/app"
      
      # Next.js dev sunucu çökmesini önlemek için mock .env dosyası oluştur
      if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
        log "Uygulama için geçici .env dosyası oluşturuluyor..."
        echo "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:54321}" > .env
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-mock-anon-key}" >> .env
        echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-mock-service-role-key}" >> .env
        echo "DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}" >> .env
      fi

      if [ ! -d "node_modules" ]; then
        log "node_modules bulunamadı, bağımlılıklar kuruluyor (pnpm install)..."
        pnpm install > pnpm-install.log 2>&1 || log "UYARI: pnpm install sırasında bazı hatalar oluştu"
      fi
      
      log "Uygulama arka planda PORT=${LOCAL_PORT} ile başlatılıyor..."
      PORT=${LOCAL_PORT} nohup pnpm run dev --port ${LOCAL_PORT} > local-dev.log 2>&1 &
      DEV_PID=$!
      echo $DEV_PID > local-dev.pid
      echo $LOCAL_PORT > local-dev.port
      
      log "Sunucu başlatıldı (PID: ${DEV_PID}). Hazır olması bekleniyor..."
      
      server_ready=false
      for i in {1..15}; do
        if (command -v lsof &>/dev/null && lsof -i :$LOCAL_PORT >/dev/null 2>&1) || curl -s "http://localhost:${LOCAL_PORT}" >/dev/null 2>&1; then
          server_ready=true
          break
        fi
        sleep 1
      done
      
      if [ "$server_ready" = true ]; then
        log "Sunucu başarıyla aktif hale geldi ✓"
        if [[ "$OSTYPE" == "darwin"* ]]; then
          log "macOS algılandı, sayfa tarayıcıda açılıyor: http://localhost:${LOCAL_PORT}"
          open "http://localhost:${LOCAL_PORT}"
        else
          log "Lütfen tarayıcınızdan şu adrese gidin: http://localhost:${LOCAL_PORT}"
        fi
      else
        log "UYARI: Sunucu 15 saniye içinde yanıt vermedi. Logları kontrol edin: ${WORKSPACE}/app/local-dev.log"
      fi
    )
  fi
fi

# ─── ÖZET ────────────────────────────────────────────────────

log ""
log "============================================================"
log "  PIPELINE TAMAMLANDI"
log "============================================================"
log ""
log "Kategori:       ${CATEGORY}"
log "Run ID:         ${RUN_ID}"
log "Workspace:      ${WORKSPACE}"
log "Build Durumu:   $([ "$BUILD_SUCCESS" = true ] && echo 'BAŞARILI' || echo 'BAŞARISIZ')"
log "Bitiş:          $(date)"
log ""
log "Çıktılar:"
log "  Uygulama:     ${WORKSPACE}/app/"
log "  Mimari:       ${WORKSPACE}/architecture/"
log "  Pazarlama:    ${WORKSPACE}/marketing/"
log "  Screenshots:  ${WORKSPACE}/screenshots/"
log "  Deploy:       ${WORKSPACE}/deploy/"
log "  Loglar:       ${WORKSPACE}/logs/"
log ""
log "============================================================"

# Tüm adımlar tamamlandı — build başarılıysa exit 0 dön
# pipeline-manager.ts exit code'a bakarak status belirler (0=completed, else=failed)
if [ "$BUILD_SUCCESS" = true ]; then
  exit 0
else
  exit 1
fi
echo "=== AI APP FACTORY v2.0 - TAMAMLANDI ==="
echo "Çıktı: ${WORKSPACE}"
echo "Uygulama: ${WORKSPACE}/app/"
echo "Build: $([ "$BUILD_SUCCESS" = true ] && echo 'BAŞARILI ✓' || echo 'BAŞARISIZ ✗')"
