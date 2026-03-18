# Ekran Görüntüsü Ajanı (Screenshot Agent)

Çalışan uygulamadan otomatik ekran görüntüsü al.
Puppeteer kullanarak farklı viewport boyutlarında screenshot çek.

## Görev

1. Uygulama dizininde `pnpm dev` ile geliştirme sunucusunu başlat
2. Sunucunun hazır olmasını bekle (localhost:3000)
3. Puppeteer ile farklı sayfalara git ve screenshot al
4. Sunucuyu kapat
5. Screenshot'ları workspace'in `screenshots/` klasörüne kaydet

## Puppeteer Script

Aşağıdaki gibi bir Node.js scripti yaz ve çalıştır:

```javascript
// screenshot-script.js olarak kaydet ve çalıştır
const puppeteer = require('puppeteer');

async function captureScreenshots() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Desktop screenshots (1920x1080)
  await page.setViewport({ width: 1920, height: 1080 });
  // Sayfalara git ve çek...

  // Mobile screenshots (390x844)
  await page.setViewport({ width: 390, height: 844 });
  // Sayfalara git ve çek...

  // Tablet screenshots (1024x1366)
  await page.setViewport({ width: 1024, height: 1366 });
  // Sayfalara git ve çek...

  await browser.close();
}
```

## Screenshot Listesi

### Desktop (1920x1080)
1. `screenshots/desktop-home.png` — Ana sayfa
2. `screenshots/desktop-feature-1.png` — Ana özellik kullanımda
3. `screenshots/desktop-feature-2.png` — İkinci özellik (varsa)

### Mobil (390x844)
1. `screenshots/mobile-home.png` — Ana sayfa
2. `screenshots/mobile-feature-1.png` — Ana özellik

### Tablet (1024x1366)
1. `screenshots/tablet-home.png` — Ana sayfa

## Kurallar

- Her screenshot'tan önce `page.waitForNetworkIdle()` bekle
- Boş sayfa çekme — uygulama tam yüklendikten sonra çek
- Dark mode varsa hem light hem dark versiyon çek
- Screenshot dosya adları açıklayıcı olsun
- Dev server başlatılamazsa hata logla ve devam et (pipeline'ı durdurma)
- Puppeteer'ı proje root'undaki node_modules'dan kullan

## Hata Durumu

Eğer dev server başlatılamıyorsa veya Puppeteer çalışmıyorsa:
1. Hatayı logla
2. `screenshots/` klasörüne `SCREENSHOTS_SKIPPED.md` yaz
3. Pipeline'ı durdurmadan devam et
