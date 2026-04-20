export const PIPELINE_STEPS = [
  { number: 1, name: "discover", label: "Keşif (Fikir Bul)" },
  { number: 2, name: "architecture", label: "Mimari (Tasarım)" },
  { number: 3, name: "build", label: "Kodlama (Build)" },
  { number: 4, name: "verify_fix", label: "Doğrulama ve Düzeltme" },
  { number: 5, name: "review", label: "Kod İnceleme (Review)" },
  { number: 6, name: "assets", label: "Görsel Varlıklar" },
  { number: 7, name: "marketing", label: "Pazarlama" },
  { number: 8, name: "screenshots", label: "Ekran Görüntüleri" },
  { number: 9, name: "package", label: "Paketleme" },
  { number: 10, name: "deploy", label: "Deploy (Vercel)" },
  { number: 11, name: "update_learnings", label: "Öğrenmeleri Güncelle" },
] as const;

export const CATEGORIES = [
  // === YÜKSEK GELİR POTANSİYELLİ KATEGORİLER ===
  {
    value: "b2b-operations",
    label: "B2B Operasyon",
    description: "Teklif yönetimi, sözleşme takibi, onay süreçleri, iş akışı otomasyonu",
    icon: "🏢",
  },
  {
    value: "compliance-legal",
    label: "Uyum & Hukuk",
    description: "KVKK uyum paneli, sözleşme yönetimi, e-imza, audit trail",
    icon: "⚖️",
  },
  {
    value: "revenue-ops",
    label: "Gelir Operasyonları",
    description: "Faturalama, teklif oluşturma, fiyatlandırma optimizasyonu, churn analizi",
    icon: "💎",
  },
  {
    value: "developer-tools",
    label: "Geliştirici Araçları",
    description: "API yönetimi, webhook inspector, deployment dashboard, log analizi",
    icon: "🛠️",
  },
  {
    value: "hr-people",
    label: "İK & İnsan",
    description: "İzin yönetimi, performans takibi, onboarding, maaş bordrosu",
    icon: "👤",
  },
  {
    value: "vertical-saas",
    label: "Sektörel SaaS",
    description: "Emlak, restoran, klinik, spor salonu, berber — sektöre özel çözümler",
    icon: "🏪",
  },
  {
    value: "data-tools",
    label: "Veri Araçları",
    description: "CSV→API dönüştürücü, veri temizleme, raporlama dashboard, ETL pipeline",
    icon: "📊",
  },
  {
    value: "ai-workflow",
    label: "AI İş Akışları",
    description: "AI-powered otomasyon, doküman analizi, akıllı sınıflandırma, içerik üretimi",
    icon: "🤖",
  },
  // === ORTA GELİR POTANSİYELLİ KATEGORİLER ===
  {
    value: "productivity",
    label: "Üretkenlik (B2B)",
    description: "Takım dashboard'ları, proje takibi, zaman kaydı, retrospektif araçları",
    icon: "⚡",
  },
  {
    value: "marketing-tools",
    label: "Pazarlama Araçları",
    description: "SEO analizi, sosyal medya planlayıcı, landing page builder, A/B test",
    icon: "📣",
  },
  {
    value: "finance",
    label: "Finans (B2B)",
    description: "Nakit akış tahmini, gider yönetimi, bütçe planlama, finansal raporlama",
    icon: "💰",
  },
  {
    value: "education",
    label: "Eğitim (EdTech)",
    description: "Kurs platformu, sınav sistemi, öğrenci takibi, sertifika yönetimi",
    icon: "🎓",
  },
  {
    value: "e-commerce",
    label: "E-Ticaret Araçları",
    description: "Envanter yönetimi, fiyat karşılaştırma, kargo takibi, dropship yönetimi",
    icon: "🛍️",
  },
  {
    value: "customer-success",
    label: "Müşteri Başarısı",
    description: "Destek portalı, NPS takibi, müşteri sağlık skoru, feedback yönetimi",
    icon: "🎯",
  },
] as const;

export const TOTAL_STEPS = 11;

export const LANDING_PAGE_STYLES = [
  { id: "minimal_craft", label: "Minimal Craft", description: "Nefes alan typografi, serif başlıklar, tek accent rengi", reference: "Linear, Raycast" },
  { id: "bold_vibrant", label: "Bold & Vibrant", description: "Cesur renkler, gradient hero, geometrik shapes", reference: "Vercel, Figma" },
  { id: "dark_premium", label: "Dark Premium", description: "Koyu arka plan, glow aksanlar, glassmorphism", reference: "Supabase, Resend" },
  { id: "organic_warm", label: "Organic & Warm", description: "Doğal tonlar, blob shapes, yumuşak köşeler", reference: "Notion, Calm" },
  { id: "editorial_story", label: "Editorial & Story", description: "Gazete layout, asimetrik grid, pull quotes", reference: "Stripe, Apple" },
  { id: "retro_modern", label: "Retro Modern", description: "Retro renkler, rounded shapes, noise texture", reference: "Gumroad" },
  { id: "data_driven", label: "Data-Driven", description: "Dashboard preview, metrik kartları, monospace font", reference: "Plausible, PostHog" },
  { id: "playful_saas", label: "Playful SaaS", description: "Renkli illüstrasyonlar, bouncy animasyon, pastel", reference: "Loom, Pitch" },
] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  queued: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-400" },
  running: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  completed: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  stopped: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-400" },
};
