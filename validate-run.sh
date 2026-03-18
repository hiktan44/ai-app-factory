#!/usr/bin/env bash
# ============================================================
# AI App Factory - Pipeline Çıktı Doğrulama Betiği
# Kullanım: ./validate-run.sh <workspace_dizini>
# Örnek:    ./validate-run.sh runs/productivity_20260318_010000
# ============================================================

set -uo pipefail

WORKSPACE="${1:?Kullanım: ./validate-run.sh <workspace_dizini>}"
HATALAR=0
BASARILI=0
TOPLAM=0

# Renk kodları
KIRMIZI='\033[0;31m'
YESIL='\033[0;32m'
SARI='\033[0;33m'
SIFIRLA='\033[0m'

kontrol_dosya() {
  TOPLAM=$((TOPLAM + 1))
  if [ -f "$1" ]; then
    local boyut=$(wc -c < "$1" | tr -d ' ')
    if [ "$boyut" -gt 0 ]; then
      echo -e "${YESIL}[OK]${SIFIRLA} $1 (${boyut} byte)"
      BASARILI=$((BASARILI + 1))
    else
      echo -e "${SARI}[BOŞ]${SIFIRLA} $1 (dosya var ama boş)"
      HATALAR=$((HATALAR + 1))
    fi
  else
    echo -e "${KIRMIZI}[EKSİK]${SIFIRLA} $1"
    HATALAR=$((HATALAR + 1))
  fi
}

kontrol_dizin() {
  TOPLAM=$((TOPLAM + 1))
  if [ -d "$1" ]; then
    local dosya_sayisi=$(find "$1" -type f | wc -l | tr -d ' ')
    echo -e "${YESIL}[OK]${SIFIRLA} $1/ (${dosya_sayisi} dosya)"
    BASARILI=$((BASARILI + 1))
  else
    echo -e "${KIRMIZI}[EKSİK]${SIFIRLA} $1/"
    HATALAR=$((HATALAR + 1))
  fi
}

echo ""
echo "============================================"
echo "  AI App Factory - Çıktı Doğrulama"
echo "  Workspace: ${WORKSPACE}"
echo "============================================"
echo ""

echo "--- Keşif Çıktıları ---"
kontrol_dosya "${WORKSPACE}/product-spec.md"

echo ""
echo "--- Mimari Çıktıları ---"
kontrol_dizin "${WORKSPACE}/architecture"
kontrol_dosya "${WORKSPACE}/architecture/file_structure.md"
kontrol_dosya "${WORKSPACE}/architecture/data_model.md"
kontrol_dosya "${WORKSPACE}/architecture/api_contract.md"
kontrol_dosya "${WORKSPACE}/architecture/design_tokens.json"
kontrol_dosya "${WORKSPACE}/architecture/component_tree.md"
kontrol_dosya "${WORKSPACE}/architecture/dependencies.json"
kontrol_dosya "${WORKSPACE}/architecture/tech_decisions.md"

echo ""
echo "--- Uygulama Çıktıları ---"
kontrol_dizin "${WORKSPACE}/app"
kontrol_dosya "${WORKSPACE}/app/package.json"
kontrol_dosya "${WORKSPACE}/app/tsconfig.json"

echo ""
echo "--- Build Durumu ---"
kontrol_dosya "${WORKSPACE}/build-status.txt"
if [ -f "${WORKSPACE}/build-status.txt" ]; then
  ICERIK=$(cat "${WORKSPACE}/build-status.txt")
  if echo "$ICERIK" | grep -q "BUILD_SUCCESS"; then
    echo -e "${YESIL}[BAŞARILI]${SIFIRLA} Build başarılı"
  else
    echo -e "${KIRMIZI}[BAŞARISIZ]${SIFIRLA} Build başarısız: ${ICERIK}"
  fi
fi

echo ""
echo "--- Review Çıktıları ---"
kontrol_dosya "${WORKSPACE}/review-report.md"

echo ""
echo "--- Görsel Varlıklar ---"
kontrol_dosya "${WORKSPACE}/app/public/logo.svg"
kontrol_dosya "${WORKSPACE}/app/public/favicon.svg"

echo ""
echo "--- Pazarlama Çıktıları ---"
kontrol_dizin "${WORKSPACE}/marketing"
kontrol_dosya "${WORKSPACE}/marketing/readme.md"

echo ""
echo "--- Ekran Görüntüleri ---"
kontrol_dizin "${WORKSPACE}/screenshots"

echo ""
echo "--- Deploy Çıktıları ---"
kontrol_dosya "${WORKSPACE}/app/Dockerfile"
kontrol_dosya "${WORKSPACE}/app/coolify-config.json"
kontrol_dosya "${WORKSPACE}/app/.env.example"

echo ""
echo "--- Pipeline ---"
kontrol_dosya "${WORKSPACE}/pipeline.log"
kontrol_dizin "${WORKSPACE}/logs"

echo ""
echo "============================================"
echo "  SONUÇ"
echo "  Başarılı: ${BASARILI}/${TOPLAM}"
echo "  Eksik/Hata: ${HATALAR}/${TOPLAM}"
echo "============================================"

if [ $HATALAR -eq 0 ]; then
  echo -e "${YESIL}Tüm kontroller başarılı!${SIFIRLA}"
else
  echo -e "${SARI}${HATALAR} eksik/hatalı çıktı var.${SIFIRLA}"
fi

exit $HATALAR
