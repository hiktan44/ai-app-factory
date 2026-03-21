#!/usr/bin/env bash
set -uo pipefail

# ============================================================
# AI App Factory v2.0 - Ana Orkestratör
# Otonom uygulama üretim bandı - Multi-LLM routing
#
# Kullanım: ./orchestrator.sh <kategori>
# Örnek:    ./orchestrator.sh productivity
#
# LLM Routing:
#   Claude     → Mimari tasarım, kod yazma, hata düzeltme (kritik)
#   Gemini     → Araştırma, review, assets, packaging (ücretsiz)
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

# ─── Claude CLI doğrulama ────────────────────────────────────
if ! command -v claude &> /dev/null; then
  echo "HATA: 'claude' komutu bulunamadı."
  echo "Kurulum: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

# ─── Gemini API helper ───────────────────────────────────────
call_gemini() {
  local system_prompt="$1"
  local user_prompt="$2"
  local output_file="$3"

  if [ -z "${GEMINI_API_KEY:-}" ]; then
    return 1
  fi

  local payload
  payload=$(jq -n \
    --arg sys "$system_prompt" \
    --arg usr "$user_prompt" \
    '{
      system_instruction: { parts: [{ text: $sys }] },
      contents: [{ parts: [{ text: $usr }] }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
    }')

  local response
  response=$(curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)

  local text
  text=$(echo "$response" | jq -r '.candidates[0].content.parts[0].text // empty' 2>/dev/null || echo "")

  if [ -n "$text" ]; then
    # Gemini yanıtını Claude-benzeri JSON formatında kaydet
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

  # Auth kontrolü: OAuth token VEYA API key gerekli
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    log "HATA: Ne CLAUDE_CODE_OAUTH_TOKEN ne de ANTHROPIC_API_KEY tanımlı — Claude CLI çalışamaz"
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

    # OAuth token varsa API key'i geçirme (CLI API key'i öncelikli kullanıyor)
    local claude_api_key_for_gosu=""
    if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
      claude_api_key_for_gosu="${ANTHROPIC_API_KEY:-}"
    fi

    HOME=/home/factory \
    ANTHROPIC_API_KEY="${claude_api_key_for_gosu}" \
    CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}" \
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
# Non-Claude provider'lar (Gemini, Qwen, OpenRouter) sadece text döndürür
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
# Web UI'dan RUN_ID env değişkeni geçilmişse onu kullan, yoksa üret
RUN_ID="${RUN_ID:-${CATEGORY}_${TIMESTAMP}}"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="${PROJECT_ROOT}/runs/${RUN_ID}"
PROMPTS_DIR="${PROJECT_ROOT}/prompts"
LEARNINGS_FILE="${PROJECT_ROOT}/learnings.json"
MAX_VERIFY_ATTEMPTS=5
LOG_FILE="${WORKSPACE}/pipeline.log"
BUILD_SUCCESS=false
TOPLAM_ADIM=11
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

# ─── Akıllı LLM Routing ──────────────────────────────────────
# preferred_providers: boşlukla ayrılmış öncelik listesi
# Örnek: "gemini openrouter claude"
run_step_smart() {
  local adim_adi="$1"
  local prompt_dosyasi="$2"
  local kullanici_promptu="$3"
  local preferred_providers="${4:-claude}"  # Varsayılan: claude
  local ek_flagler="${5:-}"

  log "Başlatılıyor: ${adim_adi} (providers: ${preferred_providers})"
  local baslangic=$(date +%s)

  # Kuru çalıştırma
  if [ "${DRY_RUN:-0}" = "1" ]; then
    log "[KURU ÇALIŞTIRMA] Atlanıyor: ${adim_adi}"
    touch "${WORKSPACE}/logs/${adim_adi}.json"
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
        if call_gemini "$system_prompt" "$kullanici_promptu" "$json_dosya"; then
          kullanilan_provider="gemini"
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
  # Gemini/Qwen API çağrıları daha hızlı olabilir (3-5s normal)
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
log "  GEMINI:    $([ -n "${GEMINI_API_KEY:-}" ] && echo 'YÜKLENDİ (ücretsiz)' || echo 'YOK')"
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

# 2. Claude auth var mı? (OAuth token VEYA API key)
CLAUDE_AUTH_METHOD="none"
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  CLAUDE_AUTH_METHOD="oauth"
  log "  CLAUDE_CODE_OAUTH_TOKEN: ...${CLAUDE_CODE_OAUTH_TOKEN: -8} (OAuth/Max Plan)"
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  CLAUDE_AUTH_METHOD="apikey"
  log "  ANTHROPIC_API_KEY: ...${ANTHROPIC_API_KEY: -8} (API Key)"
fi

if [ "$CLAUDE_AUTH_METHOD" = "none" ]; then
  log "KRİTİK HATA: Ne CLAUDE_CODE_OAUTH_TOKEN ne de ANTHROPIC_API_KEY tanımlı!"
  log "Max Plan kullanıcıları: CLAUDE_CODE_OAUTH_TOKEN env var'ını tanımlayın."
  log "API Key kullanıcıları: ANTHROPIC_API_KEY env var'ını tanımlayın."
  echo "Claude auth eksik" > "${WORKSPACE}/build-status.txt"
else

  # 3. Basit bir bağlantı testi yap (hızlı, minimal prompt)
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
    ANTHROPIC_API_KEY="${_preflight_api_key}" \
    CLAUDE_CODE_OAUTH_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}" \
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
    # Debug: gosu ortam kontrolü
    if command -v gosu &>/dev/null && [ "$(id -u)" = "0" ]; then
      log "  DEBUG: claude binary: $(which claude 2>&1)"
      log "  DEBUG: factory user id: $(gosu factory id 2>&1)"
      log "  DEBUG: factory HOME test: $(HOME=/home/factory gosu factory sh -c 'echo HOME=$HOME; ls -la ~/.claude/ 2>&1' | head -5)"
      log "  DEBUG: node version: $(gosu factory node --version 2>&1)"
      # Inline test — claude'u doğrudan çalıştır (redirect olmadan)
      local inline_test
      inline_test=$(HOME=/home/factory ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" gosu factory claude -p "hi" --dangerously-skip-permissions --output-format json --max-turns 1 2>&1 || true)
      log "  DEBUG: inline test (ilk 500 byte): $(echo "$inline_test" | head -c 500)"
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
fi

log "Claude CLI durumu: $([ "$CLAUDE_CLI_OK" = true ] && echo 'HAZIR ✓' || echo 'SORUNLU ✗')"
log ""

# pre-approved.json varsa keşif adımını atla
PRE_APPROVED="${WORKSPACE}/pre-approved.json"

# ─── ADIM 1: KEŞİF ───────────────────────────────────────────

adim_baslik "KEŞİF (Fikir Bul)"

if [ -f "$PRE_APPROVED" ]; then
  log "Pre-approved ürün spec mevcut, keşif adımı atlanıyor."
else
  # Araştırma ajanı: Gemini (web search kabiliyeti), Grok (trend analizi), Claude (derin analiz)
  run_step_smart "discover" \
    "${PROMPTS_DIR}/discover.md" \
    "Kategori: ${CATEGORY}
Workspace dizini: ${WORKSPACE}
Learnings dosyası: ${LEARNINGS_FILE}

ÖNEMLİ TALİMATLAR:
1. '${CATEGORY}' kategorisinde DERİN pazar araştırması yap
2. ${LEARNINGS_FILE} dosyasını oku (varsa) — daha önce üretilen basit/düşük kaliteli fikirleri TEKRARLAMA
3. Web araştırması yap:
   - Reddit, Product Hunt, Indie Hackers'da bu kategoride kullanıcı şikayetlerini ara
   - Mevcut SaaS rakiplerin fiyatlarını, G2/Capterra puanlarını araştır
   - Google Trends ile talep trendlerini doğrula
4. Fikir Skor Kartını doldur — minimum 70/160 puan alan fikri seç
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

  # Post-processing: Non-Claude provider product-spec.md yazmaz
  if [ ! -f "${WORKSPACE}/product-spec.md" ] || [ ! -s "${WORKSPACE}/product-spec.md" ]; then
    log "product-spec.md bulunamadı, post-processing ile çıkarılıyor..."
    extract_and_write "${WORKSPACE}/logs/discover.json" "${WORKSPACE}/product-spec.md"
  fi
fi

# ─── ADIM 2: MİMARİ ──────────────────────────────────────────

adim_baslik "MİMARİ (Tasarım)"

# Claude zorunlu — mimari dosyaları dosya sisteme yazar
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
  "claude"

# Post-processing: Non-Claude provider mimari dosyaları yazmaz
if [ ! -f "${WORKSPACE}/architecture/file_structure.md" ]; then
  log "Mimari dosyaları bulunamadı, post-processing ile çıkarılıyor..."
  extract_and_write "${WORKSPACE}/logs/architecture.json" "${WORKSPACE}/architecture/architecture-plan.md"
fi

# ─── ADIM 3: KODLAMA ─────────────────────────────────────────

adim_baslik "KODLAMA (Build)"

# Claude zorunlu — kod kalitesi için
run_step_smart "build" \
  "${PROMPTS_DIR}/build.md" \
  "Workspace dizini: ${WORKSPACE}
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Mimari dizini: ${WORKSPACE}/architecture/
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. ${WORKSPACE}/product-spec.md ve ${WORKSPACE}/architecture/ dizinindeki tüm dokümanları oku
2. ${LEARNINGS_FILE} dosyasını oku (varsa)
3. ${WORKSPACE}/app/ dizinine tam çalışan bir Next.js uygulaması kodla
4. Kodlama bitince ${WORKSPACE}/app/ dizininde 'pnpm run build' çalıştır
5. Her dosyayı yazarken import/export tutarlılığını kontrol et" \
  "claude"

# ─── ADIM 4: DOĞRULAMA ───────────────────────────────────────

adim_baslik "DOĞRULAMA ve DÜZELTME (Verify & Fix)"

verify_attempt=0

while [ $verify_attempt -lt $MAX_VERIFY_ATTEMPTS ]; do
  verify_attempt=$((verify_attempt + 1))
  log "Doğrulama denemesi: ${verify_attempt}/${MAX_VERIFY_ATTEMPTS}"

  devam_flag=""
  if [ $verify_attempt -gt 1 ]; then
    devam_flag="--continue"
  fi

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
    "claude" \
    "${devam_flag}" || true

  if [ -f "${WORKSPACE}/build-status.txt" ] && grep -q "BUILD_SUCCESS" "${WORKSPACE}/build-status.txt" 2>/dev/null; then
    BUILD_SUCCESS=true
    log "Build ${verify_attempt}. denemede başarılı!"
    break
  fi
done

if [ "$BUILD_SUCCESS" = false ]; then
  log "UYARI: Build ${MAX_VERIFY_ATTEMPTS} denemede de başarısız oldu"
fi

# ─── ADIM 5: KOD REVİEW ──────────────────────────────────────

adim_baslik "KOD İNCELEME (Review)"

# Gemini ile review yeterli — ucuz ve hızlı
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
  "gemini claude openrouter" || true

# Post-processing: Non-Claude provider review-report.md yazmaz
if [ ! -f "${WORKSPACE}/review-report.md" ]; then
  log "review-report.md bulunamadı, post-processing ile çıkarılıyor..."
  extract_and_write "${WORKSPACE}/logs/review.json" "${WORKSPACE}/review-report.md"
fi

# ─── ADIM 6: GÖRSEL VARLIKLAR ────────────────────────────────

adim_baslik "GÖRSEL VARLIKLAR (Assets)"

# Gemini SVG üretebilir
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
  "gemini claude openrouter" || true

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
  "qwen gemini openrouter claude" || true

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
  "gemini claude" || {
  log "UYARI: Ekran görüntüsü adımı başarısız (devam ediliyor)"
}

# ─── ADIM 9: PAKETLEME ───────────────────────────────────────

adim_baslik "PAKETLEME (Package)"

# Gemini template doldurma için yeterli
run_step_smart "package" \
  "${PROMPTS_DIR}/package.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Deploy dizini: ${WORKSPACE}/deploy
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md

Görev:
1. ${WORKSPACE}/app/ dizinindeki uygulamayı incele
2. Dockerfile oluştur (multi-stage, standalone output)
3. docker-compose.yml oluştur
4. coolify-config.json oluştur
5. .env.example oluştur
6. deploy.sh oluştur
7. next.config'de output: 'standalone' olduğunu kontrol et
8. Pipeline raporunu ${WORKSPACE}/pipeline-report.json dosyasına yaz
9. Deploy dosyalarının kopyalarını ${WORKSPACE}/deploy/ dizinine de koy" \
  "gemini claude openrouter" || true

# Post-processing: Non-Claude provider deploy dosyaları yazmaz
if [ ! -f "${WORKSPACE}/deploy/Dockerfile" ] && [ ! -f "${WORKSPACE}/app/Dockerfile" ]; then
  log "Deploy dosyaları bulunamadı, post-processing ile çıkarılıyor..."
  extract_and_write "${WORKSPACE}/logs/package.json" "${WORKSPACE}/deploy/package-notes.md"
fi

# ─── ADIM 10: DEPLOY (Coolify'a Yükle) ──────────────────────

adim_baslik "DEPLOY (Coolify'a Yükle)"

COOLIFY_URL_LOCAL=$(jq -r '.coolifyApiUrl // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
COOLIFY_TOKEN_LOCAL=$(jq -r '.coolifyApiToken // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
GH_TOKEN_LOCAL=$(jq -r '.githubToken // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")

if [ -z "$COOLIFY_URL_LOCAL" ] || [ -z "$COOLIFY_TOKEN_LOCAL" ] || [ -z "$GH_TOKEN_LOCAL" ]; then
  log "Coolify/GitHub credentials bulunamadı — deploy atlanıyor"
elif [ "$BUILD_SUCCESS" != true ]; then
  log "Build başarısız — deploy atlanıyor"
elif [ ! -d "${WORKSPACE}/app" ]; then
  log "App dizini bulunamadı — deploy atlanıyor"
else
  # 1. App adını product-spec.md'den çıkar
  APP_NAME_RAW=$(head -5 "${WORKSPACE}/product-spec.md" 2>/dev/null | grep -m1 '^#' | sed 's/^#[[:space:]]*//' || echo "${CATEGORY}-app")
  REPO_NAME=$(echo "$APP_NAME_RAW" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | head -c 50)
  [ -z "$REPO_NAME" ] && REPO_NAME="${CATEGORY}-app"
  log "Deploy başlıyor: ${REPO_NAME}"

  # 2. GitHub repo oluştur
  GH_ORG_LOCAL=$(jq -r '.githubOrg // empty' "$SETTINGS_FILE" 2>/dev/null || echo "")
  if [ -n "$GH_ORG_LOCAL" ]; then
    CREATE_URL="https://api.github.com/orgs/${GH_ORG_LOCAL}/repos"
  else
    CREATE_URL="https://api.github.com/user/repos"
  fi

  REPO_RESPONSE=$(curl -s -X POST "$CREATE_URL" \
    -H "Authorization: Bearer ${GH_TOKEN_LOCAL}" \
    -H "Accept: application/vnd.github.v3+json" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${REPO_NAME}\",\"private\":false,\"auto_init\":false,\"description\":\"Generated by AI App Factory\"}" 2>/dev/null)

  CLONE_URL=$(echo "$REPO_RESPONSE" | jq -r '.clone_url // empty')
  HTML_URL=$(echo "$REPO_RESPONSE" | jq -r '.html_url // empty')
  OWNER_LOGIN=$(echo "$REPO_RESPONSE" | jq -r '.owner.login // empty')

  if [ -n "$CLONE_URL" ] && [ "$CLONE_URL" != "null" ]; then
    log "GitHub repo oluşturuldu: ${HTML_URL}"

    # 3. Kodu push et
    GIT_PUSH_LOG="${WORKSPACE}/logs/git-push.log"
    (
      cd "${WORKSPACE}/app"
      # factory kullanıcısı dosyaları oluşturdu, root push ediyor — safe.directory gerekli
      git config --global --add safe.directory "${WORKSPACE}/app" 2>/dev/null || true
      git init -b main 2>/dev/null || git init  # eski git sürümlerinde -b yok
      git checkout -b main 2>/dev/null || true
      git config user.email "factory@seymata.com"
      git config user.name "AI App Factory"
      # .env dosyalarını commit'leme
      echo ".env" >> .gitignore 2>/dev/null || true
      echo ".env.local" >> .gitignore 2>/dev/null || true
      echo "node_modules/" >> .gitignore 2>/dev/null || true
      echo ".next/" >> .gitignore 2>/dev/null || true
      git add -A
      git commit -m "feat: initial commit — generated by AI App Factory"
      git remote add origin "https://${GH_TOKEN_LOCAL}@github.com/${OWNER_LOGIN}/${REPO_NAME}.git" 2>/dev/null || \
        git remote set-url origin "https://${GH_TOKEN_LOCAL}@github.com/${OWNER_LOGIN}/${REPO_NAME}.git"
      git push -u origin main 2>&1
    ) > "${GIT_PUSH_LOG}" 2>&1 && {
      log "Kod GitHub'a push edildi ✓"
      GIT_PUSH_OK=true
    } || {
      log "UYARI: GitHub push başarısız — detay:"
      log "$(tail -10 "${GIT_PUSH_LOG}" 2>/dev/null || echo 'log okunamadı')"
      GIT_PUSH_OK=false
    }

    # Push başarılıysa Coolify'a deploy et
    if [ "${GIT_PUSH_OK}" = true ]; then
      # 4. Coolify'da uygulama oluştur
      COOLIFY_SERVER_UUID=$(jq -r '.coolifyServerUuid // "nksk84gkwog0s4w0g4scwko4"' "$SETTINGS_FILE" 2>/dev/null)
      COOLIFY_PROJECT_UUID=$(jq -r '.coolifyProjectUuid // "ce0ih9q54ua6f5d6ygpr99h8"' "$SETTINGS_FILE" 2>/dev/null)
      COOLIFY_BASE_URL=$(echo "$COOLIFY_URL_LOCAL" | sed 's:/*$::')

      # Full repo URL (https://github.com/owner/repo.git formatı)
      GIT_REPO_URL="https://github.com/${OWNER_LOGIN}/${REPO_NAME}"

      log "Coolify API çağrılıyor: ${COOLIFY_BASE_URL}/api/v1/applications/public"
      log "  git_repository: ${GIT_REPO_URL}"
      log "  server_uuid: ${COOLIFY_SERVER_UUID}"
      log "  project_uuid: ${COOLIFY_PROJECT_UUID}"

      APP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${COOLIFY_BASE_URL}/api/v1/applications/public" \
        -H "Authorization: Bearer ${COOLIFY_TOKEN_LOCAL}" \
        -H "Content-Type: application/json" \
        -d "{
          \"project_uuid\":\"${COOLIFY_PROJECT_UUID}\",
          \"server_uuid\":\"${COOLIFY_SERVER_UUID}\",
          \"environment_name\":\"production\",
          \"git_repository\":\"${GIT_REPO_URL}\",
          \"git_branch\":\"main\",
          \"build_pack\":\"dockerfile\",
          \"ports_exposes\":\"3000\",
          \"name\":\"${REPO_NAME}\"
        }" 2>/dev/null)

      # HTTP status code'u ayır
      HTTP_CODE=$(echo "$APP_RESPONSE" | tail -1)
      APP_BODY=$(echo "$APP_RESPONSE" | sed '$d')

      log "Coolify API yanıtı: HTTP ${HTTP_CODE}"

      APP_UUID=$(echo "$APP_BODY" | jq -r '.uuid // empty' 2>/dev/null)

      if [ -n "$APP_UUID" ] && [ "$APP_UUID" != "null" ]; then
        log "Coolify app oluşturuldu: ${APP_UUID} ✓"
        mkdir -p "${WORKSPACE}/deploy"
        echo "${APP_UUID}" > "${WORKSPACE}/deploy/coolify-app-uuid.txt"
        echo "${HTML_URL}" > "${WORKSPACE}/deploy/github-repo-url.txt"
        log "Deploy bilgileri: ${WORKSPACE}/deploy/"

        # Deploy tetikle (instant_deploy yerine ayrı API çağrısı)
        log "Deploy tetikleniyor..."
        DEPLOY_RESP=$(curl -s -X POST "${COOLIFY_BASE_URL}/api/v1/applications/${APP_UUID}/deploy" \
          -H "Authorization: Bearer ${COOLIFY_TOKEN_LOCAL}" \
          -H "Content-Type: application/json" 2>/dev/null)
        log "Deploy yanıtı: $(echo "$DEPLOY_RESP" | jq -r '.message // .deployment_uuid // "bilinmiyor"' 2>/dev/null)"
      else
        COOLIFY_ERR=$(echo "$APP_BODY" | jq -r '.message // "bilinmeyen hata"' 2>/dev/null)
        log "UYARI: Coolify app oluşturulamadı (HTTP ${HTTP_CODE}): ${COOLIFY_ERR}"
        log "  Tam yanıt: $(echo "$APP_BODY" | head -c 500)"
      fi
    else
      log "GitHub push başarısız olduğu için Coolify deploy atlanıyor"
    fi
  else
    GH_ERR=$(echo "$REPO_RESPONSE" | jq -r '.message // "bilinmeyen hata"')
    log "UYARI: GitHub repo oluşturulamadı: ${GH_ERR}"
    log "  Tam yanıt: $(echo "$REPO_RESPONSE" | head -c 500)"
  fi
fi

# ─── ADIM 11: ÖĞRENMELERİ GÜNCELLE ─────────────────────────

adim_baslik "ÖĞRENMELERİ GÜNCELLE (Learnings)"

# Gemini JSON güncellemesi için yeterli
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
  "gemini openrouter claude" || true

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

echo ""
echo "=== AI APP FACTORY v2.0 - TAMAMLANDI ==="
echo "Çıktı: ${WORKSPACE}"
echo "Uygulama: ${WORKSPACE}/app/"
echo "Build: $([ "$BUILD_SUCCESS" = true ] && echo 'BAŞARILI ✓' || echo 'BAŞARISIZ ✗')"
