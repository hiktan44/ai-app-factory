# AI App Factory - Claude Code Kuralları

## Sen Kimsin
Bu proje gece çalışan otonom bir uygulama üretim bandı.
Her aşamada farklı bir rol üstleniyorsun.
Pipeline 9 adımdan oluşuyor ve her adım bağımsız bir ajan gibi davranıyor.

## Genel Kurallar
1. `learnings.json` dosyasını HER aşamada oku ve önceki hatalardan kaçın
2. Her hatayı `learnings.json`'a yaz (pipeline sonunda güncellenir)
3. Build patlarsa max 5 deneme yap, 5'te de patlıyorsa hata raporunu yaz
4. Review aşamasında kodu yabancı gözle incele (bağımsız session)
5. Asset üretiminde SVG-first yaklaşım kullan
6. Marketing metinleri hem EN hem TR yaz
7. Package aşamasında Coolify deploy config'i mutlaka hazırla
8. Her uygulamada `/api/health` endpoint'i oluştur

## Teknoloji Tercihleri
- **Frontend:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Deploy:** Coolify (self-hosted, Docker-based) - birincil hedef
- **Paket Yöneticisi:** pnpm
- **Dil:** TypeScript (strict mode)

## Kod Standartları
- TypeScript strict mode her zaman açık
- `'use client'` direktifini gerekli yerlere koy
- Error boundary ekle
- Loading state ekle
- Empty state ekle
- Responsive tasarım (mobile-first)
- Accessibility (a11y) uyumlu olmalı

## Deploy Gereksinimleri
Her üretilen uygulama şunları içermeli:
- `Dockerfile` (multi-stage build, Next.js standalone output)
- `docker-compose.yml` (lokal geliştirme)
- `coolify-config.json` (Coolify API konfigürasyonu)
- `.env.example` (tüm ortam değişkenleri açıklamalı)
- `/api/health` endpoint'i (Coolify health check)
- `.dockerignore` (gereksiz dosyaları hariç tut)

## Dosya Yapısı
```
ai-app-factory/
├── runs/                          # Her pipeline çalıştırmasının çıktısı
│   └── YYYYMMDD_HHMMSS/
│       ├── product-spec.md        # Ürün tanımı
│       ├── architecture/          # Mimari dokümanlar
│       ├── app/                   # Üretilen uygulama kodu
│       ├── review-report.md       # Kod review raporu
│       ├── marketing/             # Pazarlama materyalleri
│       ├── screenshots/           # Ekran görüntüleri
│       ├── deploy/                # Deploy dosyaları
│       ├── logs/                  # Her adımın logları
│       ├── build-status.txt       # Build durumu
│       └── pipeline.log           # Genel pipeline logu
├── prompts/                       # Pipeline prompt dosyaları
│   ├── discover.md
│   ├── architecture.md
│   ├── build.md
│   ├── verify_fix.md
│   ├── review.md
│   ├── assets.md
│   ├── marketing.md
│   ├── screenshots.md
│   ├── package.md
│   └── update_learnings.md
├── learnings.json                 # Hafıza katmanı
├── orchestrator.sh                # Ana pipeline betiği
├── validate-run.sh                # Çıktı doğrulama betiği
├── CLAUDE.md                      # Bu dosya
├── package.json
└── .env.example
```

## Kaçınılacak Hatalar
- webpack manuel konfigürasyonu yapma
- Class component kullanma
- CSS modules kullanma
- `any` tipi kullanma (TypeScript)
- `.env` dosyasını commit'leme
- Secret'ları kod içine gömme
- Over-engineering yapma (MVP odaklı ol)
