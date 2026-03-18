#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AI App Factory v1.0 - Ana Orkestratör
# Otonom uygulama üretim bandı
#
# Kullanım: ./orchestrator.sh <kategori>
# Örnek:    ./orchestrator.sh productivity
#           ./orchestrator.sh developer-tools
#           ./orchestrator.sh health
#
# Kuru çalıştırma: DRY_RUN=1 ./orchestrator.sh test
# ============================================================

CATEGORY="${1:?Kullanım: ./orchestrator.sh <kategori> (örn: productivity, developer-tools, health, finance, education)}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_ID="${CATEGORY}_${TIMESTAMP}"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="${PROJECT_ROOT}/runs/${RUN_ID}"
PROMPTS_DIR="${PROJECT_ROOT}/prompts"
LEARNINGS_FILE="${PROJECT_ROOT}/learnings.json"
MAX_VERIFY_ATTEMPTS=5
LOG_FILE="${WORKSPACE}/pipeline.log"
BUILD_SUCCESS=false
TOPLAM_ADIM=10
MEVCUT_ADIM=0

# ============================================================
# Yardımcı Fonksiyonlar
# ============================================================

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

run_step() {
  local adim_adi="$1"
  local prompt_dosyasi="$2"
  local kullanici_promptu="$3"
  local ek_flagler="${4:-}"

  log "Başlatılıyor: ${adim_adi}"
  local baslangic=$(date +%s)

  # Kuru çalıştırma modu
  if [ "${DRY_RUN:-0}" = "1" ]; then
    log "[KURU ÇALIŞTIRMA] Atlanıyor: claude -p ... --append-system-prompt \"\$(cat ${prompt_dosyasi})\""
    log "[KURU ÇALIŞTIRMA] Prompt dosyası mevcut: $([ -f "$prompt_dosyasi" ] && echo 'EVET' || echo 'HAYIR')"
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

  # Claude CLI çalıştır
  local sonuc
  if [ -n "$ek_flagler" ]; then
    sonuc=$(claude -p "${kullanici_promptu}" \
      --append-system-prompt "${system_prompt}" \
      --permission-mode bypassPermissions \
      --output-format json \
      --allowedTools "Bash,Read,Edit,Write,WebSearch,WebFetch" \
      ${ek_flagler} 2>&1) || true
  else
    sonuc=$(claude -p "${kullanici_promptu}" \
      --append-system-prompt "${system_prompt}" \
      --permission-mode bypassPermissions \
      --output-format json \
      --allowedTools "Bash,Read,Edit,Write,WebSearch,WebFetch" \
      2>&1) || true
  fi

  # Çıktıyı kaydet
  echo "$sonuc" > "${WORKSPACE}/logs/${adim_adi}.json"

  # Süreyi hesapla
  local bitis=$(date +%s)
  local sure=$((bitis - baslangic))
  log "Tamamlandı: ${adim_adi} (${sure} saniye)"

  # Hata kontrolü
  local hata_var
  hata_var=$(echo "$sonuc" | jq -r '.is_error // false' 2>/dev/null || echo "false")

  if [ "$hata_var" = "true" ]; then
    log "UYARI: ${adim_adi} adımında hata oluştu"
    return 1
  fi

  return 0
}

# ============================================================
# Başlangıç
# ============================================================

mkdir -p "${WORKSPACE}"/{app,architecture,marketing,screenshots,logs,deploy}

log "============================================================"
log "  AI APP FACTORY v1.0"
log "  Otonom Uygulama Üretim Bandı"
log "============================================================"
log ""
log "Kategori:    ${CATEGORY}"
log "Run ID:      ${RUN_ID}"
log "Workspace:   ${WORKSPACE}"
log "Başlangıç:   $(date)"
log "Kuru çalıştırma: ${DRY_RUN:-0}"
log ""

# ============================================================
# ADIM 1: KEŞİF (Discover)
# ============================================================

adim_baslik "KEŞİF (Fikir Bul)"

run_step "discover" \
  "${PROMPTS_DIR}/discover.md" \
  "Kategori: ${CATEGORY}
Workspace dizini: ${WORKSPACE}
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. '${CATEGORY}' kategorisinde pazar araştırması yap
2. ${LEARNINGS_FILE} dosyasını oku ve önceki deneyimlerden faydalan
3. Tek bir uygulama fikri belirle
4. Detaylı ürün spesifikasyonunu ${WORKSPACE}/product-spec.md dosyasına yaz

Önemli: Çıktıyı mutlaka ${WORKSPACE}/product-spec.md dosyasına yaz."

# ============================================================
# ADIM 2: MİMARİ (Architecture)
# ============================================================

adim_baslik "MİMARİ (Tasarım)"

run_step "architecture" \
  "${PROMPTS_DIR}/architecture.md" \
  "Workspace dizini: ${WORKSPACE}
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. ${WORKSPACE}/product-spec.md dosyasını oku
2. ${LEARNINGS_FILE} dosyasını oku
3. Tüm mimari dokümanları ${WORKSPACE}/architecture/ klasörüne yaz:
   - file_structure.md
   - data_model.md
   - api_contract.md
   - design_tokens.json
   - component_tree.md
   - dependencies.json
   - tech_decisions.md"

# ============================================================
# ADIM 3: KODLAMA (Build)
# ============================================================

adim_baslik "KODLAMA (Build)"

run_step "build" \
  "${PROMPTS_DIR}/build.md" \
  "Workspace dizini: ${WORKSPACE}
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Mimari dizini: ${WORKSPACE}/architecture/
Learnings dosyası: ${LEARNINGS_FILE}

Görev:
1. ${WORKSPACE}/product-spec.md ve ${WORKSPACE}/architecture/ dizinindeki tüm dokümanları oku
2. ${LEARNINGS_FILE} dosyasını oku
3. ${WORKSPACE}/app/ dizinine tam çalışan bir Next.js uygulaması kodla
4. Kodlama bitince ${WORKSPACE}/app/ dizininde 'pnpm run build' çalıştır
5. Her dosyayı yazarken import/export tutarlılığını kontrol et"

# ============================================================
# ADIM 4: DOĞRULAMA ve DÜZELTME (Verify & Fix)
# ============================================================

adim_baslik "DOĞRULAMA ve DÜZELTME (Verify & Fix)"

verify_attempt=0

while [ $verify_attempt -lt $MAX_VERIFY_ATTEMPTS ]; do
  verify_attempt=$((verify_attempt + 1))
  log "Doğrulama denemesi: ${verify_attempt}/${MAX_VERIFY_ATTEMPTS}"

  # İlk denemede yeni session, sonrasında --continue ile devam
  devam_flag=""
  if [ $verify_attempt -gt 1 ]; then
    devam_flag="--continue"
  fi

  run_step "verify_fix_${verify_attempt}" \
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
    "${devam_flag}" || true

  # Build başarılı mı kontrol et
  if [ -f "${WORKSPACE}/build-status.txt" ] && grep -q "BUILD_SUCCESS" "${WORKSPACE}/build-status.txt" 2>/dev/null; then
    BUILD_SUCCESS=true
    log "Build ${verify_attempt}. denemede başarılı!"
    break
  fi
done

if [ "$BUILD_SUCCESS" = false ]; then
  log "UYARI: Build ${MAX_VERIFY_ATTEMPTS} denemede de başarısız oldu"
fi

# ============================================================
# ADIM 5: KOD İNCELEME (Review) — Bağımsız Session
# ============================================================

adim_baslik "KOD İNCELEME (Review)"

log "Not: Review bağımsız session'da çalışıyor (--continue KULLANILMIYOR)"

run_step "review" \
  "${PROMPTS_DIR}/review.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md

Görev:
1. ${WORKSPACE}/app/ dizinindeki TÜM kaynak kodları incele
2. ${WORKSPACE}/product-spec.md ile karşılaştır
3. Güvenlik, performans, kod kalitesi, UX ve mimari açıdan incele
4. Review raporunu ${WORKSPACE}/review-report.md dosyasına yaz
5. KRİTİK sorunları doğrudan kodda düzelt
6. Düzeltme yaptıysan tekrar 'pnpm run build' çalıştır" || true

# ============================================================
# ADIM 6: GÖRSEL VARLIKLAR (Assets)
# ============================================================

adim_baslik "GÖRSEL VARLIKLAR (Assets)"

run_step "assets" \
  "${PROMPTS_DIR}/assets.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md

Görev:
1. ${WORKSPACE}/product-spec.md dosyasını oku
2. ${WORKSPACE}/app/ dizinindeki tasarım/renk bilgilerini incele
3. SVG logo, favicon, OG image oluştur
4. Dosyaları ${WORKSPACE}/app/public/ dizinine yaz
5. Layout metadata'sını güncelle" || true

# ============================================================
# ADIM 7: PAZARLAMA (Marketing)
# ============================================================

adim_baslik "PAZARLAMA (Marketing)"

run_step "marketing" \
  "${PROMPTS_DIR}/marketing.md" \
  "Uygulama dizini: ${WORKSPACE}/app
Ürün spesifikasyonu: ${WORKSPACE}/product-spec.md
Review raporu: ${WORKSPACE}/review-report.md

Görev:
1. ${WORKSPACE}/product-spec.md ve ${WORKSPACE}/review-report.md dosyalarını oku
2. Tüm pazarlama materyallerini ${WORKSPACE}/marketing/ klasörüne yaz:
   - app_store_listing.md
   - landing_page_copy.md
   - social_media_posts.md
   - readme.md
   - changelog.md
3. Hem İngilizce hem Türkçe versiyonlar oluştur" || true

# ============================================================
# ADIM 8: EKRAN GÖRÜNTÜLERİ (Screenshots)
# ============================================================

adim_baslik "EKRAN GÖRÜNTÜLERİ (Screenshots)"

run_step "screenshots" \
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

Hata durumunda: Screenshot adımı opsiyoneldir, hata olursa logla ve devam et." || {
  log "UYARI: Ekran görüntüsü adımı başarısız (devam ediliyor)"
}

# ============================================================
# ADIM 9: PAKETLEME (Package)
# ============================================================

adim_baslik "PAKETLEME (Package)"

run_step "package" \
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
9. Deploy dosyalarının kopyalarını ${WORKSPACE}/deploy/ dizinine de koy" || true

# ============================================================
# ADIM 10: ÖĞRENMELERİ GÜNCELLE (Update Learnings)
# ============================================================

adim_baslik "ÖĞRENMELERİ GÜNCELLE (Learnings)"

run_step "update_learnings" \
  "${PROMPTS_DIR}/update_learnings.md" \
  "Workspace dizini: ${WORKSPACE}
Learnings dosyası: ${LEARNINGS_FILE}
Kategori: ${CATEGORY}
Build durumu: ${BUILD_SUCCESS}

Görev:
1. ${WORKSPACE}/logs/ dizinindeki tüm logları incele
2. ${WORKSPACE}/review-report.md dosyasını oku (varsa)
3. ${WORKSPACE}/build-status.txt dosyasını oku
4. ${LEARNINGS_FILE} dosyasını oku
5. Öğrenilenleri çıkar ve ${LEARNINGS_FILE} dosyasını güncelle
6. total_runs artır, last_updated güncelle" || true

# ============================================================
# ÖZET
# ============================================================

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
echo "=== AI APP FACTORY - TAMAMLANDI ==="
echo "Çıktı: ${WORKSPACE}"
echo "Uygulama: ${WORKSPACE}/app/"
echo "Build: $([ "$BUILD_SUCCESS" = true ] && echo 'BAŞARILI ✓' || echo 'BAŞARISIZ ✗')"
