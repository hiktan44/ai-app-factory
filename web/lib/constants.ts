export const PIPELINE_STEPS = [
  { number: 1, name: "discover", label: "Ke\u015fif (Fikir Bul)" },
  { number: 2, name: "architecture", label: "Mimari (Tasar\u0131m)" },
  { number: 3, name: "build", label: "Kodlama (Build)" },
  { number: 4, name: "verify_fix", label: "Do\u011frulama ve D\u00fczeltme" },
  { number: 5, name: "review", label: "Kod \u0130nceleme (Review)" },
  { number: 6, name: "assets", label: "G\u00f6rsel Varl\u0131klar" },
  { number: 7, name: "marketing", label: "Pazarlama" },
  { number: 8, name: "screenshots", label: "Ekran G\u00f6r\u00fcnt\u00fcleri" },
  { number: 9, name: "package", label: "Paketleme" },
  { number: 10, name: "update_learnings", label: "\u00d6\u011frenmeleri G\u00fcncelle" },
] as const;

export const CATEGORIES = [
  {
    value: "productivity",
    label: "\u00dcretkenlik",
    description: "G\u00f6rev y\u00f6netimi, zaman takibi, verimlilik ara\u00e7lar\u0131",
    icon: "\u26a1",
  },
  {
    value: "developer-tools",
    label: "Geli\u015ftirici Ara\u00e7lar\u0131",
    description: "Kod ara\u00e7lar\u0131, API test, dek\u00fcmentasyon",
    icon: "\ud83d\udee0\ufe0f",
  },
  {
    value: "health",
    label: "Sa\u011fl\u0131k",
    description: "Sa\u011fl\u0131k takibi, fitness, beslenme",
    icon: "\ud83c\udfe5",
  },
  {
    value: "finance",
    label: "Finans",
    description: "B\u00fct\u00e7e y\u00f6netimi, yat\u0131r\u0131m takibi, faturalama",
    icon: "\ud83d\udcb0",
  },
  {
    value: "education",
    label: "E\u011fitim",
    description: "\u00d6\u011frenme platformu, quiz, kurs y\u00f6netimi",
    icon: "\ud83c\udf93",
  },
  {
    value: "social",
    label: "Sosyal",
    description: "Topluluk, mesajla\u015fma, etkinlik y\u00f6netimi",
    icon: "\ud83d\udc65",
  },
  {
    value: "e-commerce",
    label: "E-Ticaret",
    description: "Ma\u011faza y\u00f6netimi, \u00fcr\u00fcn katalo\u011fu, sipari\u015f takibi",
    icon: "\ud83d\udecd\ufe0f",
  },
  {
    value: "ai",
    label: "Yapay Zeka",
    description: "AI ara\u00e7lar\u0131, chatbot, i\u00e7erik \u00fcretimi",
    icon: "\ud83e\udd16",
  },
] as const;

export const TOTAL_STEPS = 10;

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  queued: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-400" },
  running: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  completed: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  stopped: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-400" },
};
