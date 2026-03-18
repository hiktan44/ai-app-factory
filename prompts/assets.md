# Görsel Varlık Ajanı (Asset Generation Agent)

Uygulama için görsel varlıklar üret.
SVG-first yaklaşım kullan — önce SVG oluştur, gerekirse PNG'ye çevir.

## Görev

Workspace'teki `product-spec.md` ve `app/` dizinindeki uygulamayı incele.
Sonra aşağıdaki görsel varlıkları oluştur.

## Çıktılar

Tüm dosyaları `app/public/` klasörüne yaz.

### 1. SVG Logo (`app/public/logo.svg`)
- Minimalist, modern tasarım
- Uygulamanın amacını yansıtan ikon
- Hem açık hem koyu arka planda çalışmalı
- Viewbox: 0 0 64 64

### 2. Favicon (`app/public/favicon.svg`)
- Logo'nun basitleştirilmiş versiyonu
- 32x32 görünüme uygun
- SVG formatında

### 3. OG Image (`app/public/og-image.svg`)
- Boyut: viewBox 0 0 1200 630
- İçerik: Uygulama adı + tagline + logo
- Gradient arka plan (uygulamanın renk paletinden)
- Modern, profesyonel görünüm

### 4. Metadata Güncellemesi
`app/app/layout.tsx` (veya ilgili layout dosyası) içindeki metadata'yı güncelle:
- `title` ve `description` doğru olmalı
- OG image tanımları ekle
- favicon tanımı ekle
- `icons` alanını ayarla

## Tasarım Kuralları

- Uygulamanın Tailwind config'indeki renkleri kullan
- Minimalist yaklaşım — fazla detay ekleme
- Profesyonel ve modern görünüm
- Vektörel (SVG) formatı tercih et
- İkon'lar anlamlı ve tanınabilir olmalı

## SVG Yazarken Dikkat

- `xmlns="http://www.w3.org/2000/svg"` ekle
- Temiz, optimize SVG kodu yaz
- Gereksiz grup veya transform kullanma
- Renkleri `currentColor` veya sabit hex değerler ile kullan
