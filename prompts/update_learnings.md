# Öğrenme Güncelleme Ajanı (Update Learnings Agent)

Bu pipeline çalıştırmasından öğrenilenleri kaydet.
Hafıza katmanını güncelle ki bir sonraki çalıştırmada aynı hatalar tekrarlanmasın.

## Görev

1. Proje kök dizinindeki `learnings.json` dosyasını oku
2. Bu çalıştırmanın tüm loglarını ve çıktılarını incele:
   - `logs/` klasöründeki her adımın logları
   - `build-status.txt` — build başarılı mı?
   - `review-report.md` — review'da bulunan sorunlar
   - `product-spec.md` — hangi kategori, ne üretildi
3. Öğrenilenleri çıkar ve `learnings.json`'ı güncelle

## Güncelleme Kuralları

1. **Yeni hata pattern'leri ekle:** Build'de karşılaşılan yeni hatalar
2. **Frequency artır:** Daha önce görülmüş hatalar tekrar olduysa sayacı artır
3. **Çözülen hataları işaretle:** `resolved: true` yap
4. **Yeni kurallar ekle:** Bu çalıştırmadan çıkan genel kurallar
5. **Başarılı pattern'leri kaydet:** Ne iyi çalıştı?
6. **Kategori bilgisi ekle:** Bu kategoride ne öğrenildi
7. **Duplicate kural ekleme:** Aynı kural zaten varsa ekleme
8. **`total_runs` artır:** +1
9. **`last_updated` güncelle:** Şu anki tarih/saat

## Çıktı Formatı

Güncellenmiş `learnings.json` dosyasını proje kök dizinine yaz.
Yapı:

```json
{
  "version": "1.0",
  "total_runs": 0,
  "last_updated": "ISO-8601 tarih",
  "patterns": {
    "build_errors": [
      {
        "error_type": "",
        "frequency": 0,
        "root_cause": "",
        "fix": "",
        "first_seen": "YYYY-MM-DD",
        "last_seen": "YYYY-MM-DD",
        "resolved": false
      }
    ],
    "architecture_mistakes": [],
    "review_findings": [],
    "successful_patterns": []
  },
  "rules": [],
  "tech_preferences": {
    "preferred_stack": "Next.js 15 + Supabase + Tailwind v4",
    "deployment": "Coolify (Docker-based, self-hosted)",
    "package_manager": "pnpm",
    "avoid": []
  },
  "category_insights": {
    "kategori_adi": {
      "apps_built": 0,
      "success_rate": 0,
      "common_features": [],
      "notes": ""
    }
  }
}
```

## Önemli

- Mevcut verileri SİLME, sadece ekle veya güncelle
- Her girdi kısa ve aksiyonel olsun (uzun paragraflar değil)
- Timestamp ekle
- JSON formatının geçerli olduğundan emin ol
