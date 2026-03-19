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
  { number: 10, name: "deploy", label: "Deploy (Coolify)" },
  { number: 11, name: "update_learnings", label: "Öğrenmeleri Güncelle" },
] as const;

export const CATEGORIES = [
  {
    value: "productivity",
    label: "Üretkenlik",
    description: "Görev yönetimi, zaman takibi, verimlilik araçları",
    icon: "⚡",
  },
  {
    value: "developer-tools",
    label: "Geliştirici Araçları",
    description: "Kod araçları, API test, dekümantasyon",
    icon: "🛠️",
  },
  {
    value: "health",
    label: "Sağlık",
    description: "Sağlık takibi, fitness, beslenme",
    icon: "🏥",
  },
  {
    value: "finance",
    label: "Finans",
    description: "Bütçe yönetimi, yatırım takibi, faturalama",
    icon: "💰",
  },
  {
    value: "education",
    label: "Eğitim",
    description: "Öğrenme platformu, quiz, kurs yönetimi",
    icon: "🎓",
  },
  {
    value: "social",
    label: "Sosyal",
    description: "Topluluk, mesajlaşma, etkinlik yönetimi",
    icon: "👥",
  },
  {
    value: "e-commerce",
    label: "E-Ticaret",
    description: "Mağaza yönetimi, ürün kataloğu, sipariş takibi",
    icon: "🛍️",
  },
  {
    value: "ai",
    label: "Yapay Zeka",
    description: "AI araçları, chatbot, içerik üretimi",
    icon: "🤖",
  },
] as const;

export const TOTAL_STEPS = 11;

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  queued: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-400" },
  running: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  completed: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  stopped: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-400" },
};
