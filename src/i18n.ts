import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type UiLanguage = "tr" | "ko" | "en" | "ja" | "zh";
export const LANGUAGE_STORAGE_KEY = "climpire.language";
export const LANGUAGE_USER_SET_STORAGE_KEY = "climpire.language.user_set";

export type LangText = {
  ko: string;
  en: string;
  ja?: string;
  zh?: string;
  tr?: string;
};

type TranslationInput = LangText | string;

function parseLanguage(value?: string | null): UiLanguage | null {
  const code = (value ?? "").toLowerCase().replace("_", "-");
  if (code === "tr" || code.startsWith("tr-")) return "tr";
  if (code === "ko" || code.startsWith("ko-")) return "ko";
  if (code === "en" || code.startsWith("en-")) return "en";
  if (code === "ja" || code.startsWith("ja-")) return "ja";
  if (code === "zh" || code.startsWith("zh-")) return "zh";
  return null;
}

export function normalizeLanguage(value?: string | null): UiLanguage {
  return parseLanguage(value) ?? "en";
}

/** 로캘별 이름 반환. 해당 로캘 이름이 비어있으면 영문(name) fallback */
export function localeName(
  locale: UiLanguage | string,
  obj: { name: string; name_ko?: string | null; name_ja?: string | null; name_zh?: string | null },
): string {
  const lang = (typeof locale === "string" ? locale : "en").slice(0, 2);
  if (lang === "ko") return obj.name_ko || obj.name;
  if (lang === "ja") return obj.name_ja || obj.name;
  if (lang === "zh") return obj.name_zh || obj.name;
  if (lang === "tr") return translateEnglishToTurkish(obj.name);
  return obj.name;
}

export function detectBrowserLanguage(): UiLanguage {
  if (typeof window === "undefined") return "en";
  const candidates = [...(window.navigator.languages ?? []), window.navigator.language];
  for (const lang of candidates) {
    const parsed = parseLanguage(lang);
    if (parsed) return parsed;
  }
  return "en";
}

function detectRuntimeLanguage(): UiLanguage {
  if (typeof window === "undefined") return "en";
  let storedLanguage: string | null = null;
  try {
    const storage = window.localStorage as { getItem?: (key: string) => string | null } | undefined;
    if (storage && typeof storage.getItem === "function") {
      storedLanguage = storage.getItem(LANGUAGE_STORAGE_KEY);
    }
  } catch {
    storedLanguage = null;
  }
  return parseLanguage(storedLanguage) ?? detectBrowserLanguage();
}

export function localeFromLanguage(lang: UiLanguage): string {
  switch (lang) {
    case "tr":
      return "tr-TR";
    case "ko":
      return "ko-KR";
    case "en":
      return "en-US";
    case "ja":
      return "ja-JP";
    case "zh":
      return "zh-CN";
    default:
      return "en-US";
  }
}

export function pickLang(lang: UiLanguage, text: LangText): string {
  switch (lang) {
    case "tr":
      return text.tr ?? translateEnglishToTurkish(text.en);
    case "ko":
      return text.ko;
    case "en":
      return text.en;
    case "ja":
      return text.ja ?? text.en;
    case "zh":
      return text.zh ?? text.en;
    default:
      return text.en;
  }
}

const TURKISH_COMMON_TEXT: Record<string, string> = {
  Office: "Ofis",
  Dashboard: "Genel Bakış",
  Tasks: "Görevler",
  Agents: "AI Çalışanlar",
  Settings: "Ayarlar",
  Skills: "Yetenekler",
  Company: "İşletme",
  "Company Name": "İşletme Adı",
  "CEO Name": "Yönetici Adı",
  "Auto Assign": "Otomatik Atama",
  Language: "Dil",
  Save: "Kaydet",
  Saved: "Kaydedildi",
  Cancel: "Vazgeç",
  Close: "Kapat",
  Delete: "Sil",
  Edit: "Düzenle",
  Add: "Ekle",
  Create: "Oluştur",
  Send: "Gönder",
  General: "Genel",
  "API Providers": "API Sağlayıcıları",
  "Register local, frontier, and compatible third-party APIs, then assign those models directly to agents.":
    "Yerel, gelişmiş ve uyumlu üçüncü taraf API'lerini kaydedin; modelleri doğrudan AI çalışanlara atayın.",
  "No API providers registered. Click + Add above to get started.":
    "Kayıtlı API sağlayıcısı yok. Başlamak için yukarıdaki + Ekle düğmesini kullanın.",
  Connected: "Bağlı",
  Disconnected: "Bağlantı Kesildi",
  Idle: "Hazır",
  Working: "Çalışıyor",
  Offline: "Çevrimdışı",
  Break: "Molada",
  "Team Lead": "Ekip Lideri",
  Senior: "Uzman",
  Leader: "Lider",
  Junior: "Geliştirici",
  Intern: "Stajyer",
  Chat: "Sohbet",
  Messages: "Mesajlar",
  "No messages yet": "Henüz mesaj yok",
  "Type a message...": "Mesaj yaz...",
  Projects: "Projeler",
  "New Task": "Yeni Görev",
  "In Progress": "Çalışıyor",
  Done: "Tamamlandı",
  Review: "Kontrol Ediliyor",
  Planned: "Planlandı",
  Inbox: "Gelen Kutusu",
  Pending: "Bekliyor",
  Cancelled: "İptal Edildi",
  Decisions: "Kararlar",
  Reports: "Raporlar",
  Announcement: "Duyuru",
  "Office Manager": "Ofis Yönetimi",
  "CEO Office": "Yönetici Ofisi",
  "Break Room": "Dinlenme Alanı",
  "Switch to light mode": "Açık temaya geç",
  "Switch to dark mode": "Koyu temaya geç",
  "Open menu": "Menüyü aç",
  "Close menu": "Menüyü kapat",
  Management: "Yönetim",
  Manager: "Yönetici",
  Task: "Görev",
  Report: "Rapor",
  "Team Leader": "Ekip Lideri",
  planning: "Planlama",
  "Task mode - assign work to the agent": "Görev modu — AI çalışana yeni bir iş atar",
  "Announcement mode - sent to all agents": "Duyuru modu — tüm AI çalışanlara gönderilir",
  "Report mode - request report/deck authoring": "Rapor modu — rapor veya sunum hazırlanmasını ister",
  "Write a task instruction...": "Görev talimatını yazın...",
  "Write a report request...": "Rapor isteğini yazın...",
  "Write an announcement...": "Duyuruyu yazın...",
  "Press Enter to send, Shift+Enter for a new line": "Göndermek için Enter, yeni satır için Shift+Enter kullanın",
  "Clear message history": "Sohbet geçmişini temizle",
  "Start a conversation! 👋": "Sohbete başlayın! 👋",
  manager: "AI Yönetici",
  developer: "Yazılım Geliştirici",
  reviewer: "İnceleme Uzmanı",
  product_manager: "Ürün Yöneticisi",
  content_strategist: "İçerik Stratejisti",
  designer: "Tasarımcı",
  qa: "Kalite Uzmanı",
  Software: "Yazılım",
  "Reviewer / QA": "İnceleme / Kalite",
  Product: "Ürün",
  "Social & Brand": "Sosyal Medya ve Marka",
  Planning: "Planlama",
  Design: "Tasarım",
  "Testing & QA": "Test ve Kalite",
  Operations: "Operasyon",
  Development: "Yazılım Geliştirme",
  Analysis: "Analiz",
  Presentation: "Sunum",
  Documentation: "Dokümantasyon",
  Research: "Araştırma",
  Content: "İçerik",
  Marketing: "Pazarlama",
  "Add Dept": "Departman Ekle",
  "Add Department": "Departman Ekle",
  "Hire Agent": "AI Çalışan Ekle",
  Departments: "Departmanlar",
  All: "Tümü",
  Active: "Aktif",
  Inactive: "Pasif",
  Search: "Ara",
  "Search...": "Ara...",
  "Search agents...": "AI çalışanlarda ara...",
  "No agents found": "AI çalışan bulunamadı",
  "No departments found": "Departman bulunamadı",
  "Double-click: edit dept": "Çift tıklayın: departmanı düzenleyin",
  Total: "Toplam",
  "Task Board": "Görev Panosu",
  "Active/All": "Aktif/Tümü",
  Hide: "Gizle",
  Show: "Göster",
  "Project Manager": "Proje Yönetimi",
  "Project Management": "Proje Yönetimi",
  New: "Yeni",
  "GitHub Import": "GitHub'dan Aktar",
  Prev: "Geri",
  "Project Info": "Proje Bilgileri",
  "Project Path": "Proje Klasörü",
  "Core Goal": "Ana Hedef",
  "Edit Selected": "Seçili Projeyi Düzenle",
  "Edit Project": "Projeyi Düzenle",
  "Register New Project": "Yeni Proje Kaydet",
  "Task History": "Görev Geçmişi",
  "No mapped tasks": "Bu projeye bağlı görev yok",
  Owner: "Sorumlu",
  "Sub tasks": "Alt görevler",
  "Click card for details": "Ayrıntılar için karta tıklayın",
  "Mapped Reports": "Bağlı Raporlar",
  "No mapped reports": "Bu projeye bağlı rapor yok",
  "Representative Decisions": "Önemli Kararlar",
  "No representative decision records": "Kaydedilmiş önemli karar yok",
  "Search tasks...": "Görevlerde ara...",
  "All Departments": "Tüm Departmanlar",
  "All Agents": "Tüm AI Çalışanlar",
  "All Types": "Tüm Türler",
  "All Statuses": "Tüm Durumlar",
  "All Priorities": "Tüm Öncelikler",
  Priority: "Öncelik",
  Status: "Durum",
  "Task Type": "Görev Türü",
  Assignee: "Sorumlu",
  Unassigned: "Atanmamış",
  "No agent": "AI çalışan yok",
  "Assign Task": "Görevi Ata",
  "Create Task": "Görev Oluştur",
  "Create New Task": "Yeni Görev Oluştur",
  "Open temporary drafts": "Geçici taslakları aç",
  Temp: "Taslak",
  Title: "Başlık",
  "Enter a task title": "Görev başlığını yazın",
  "Enter a detailed description": "Görevin ayrıntılı açıklamasını yazın",
  "-- All --": "-- Tümü --",
  "-- Unassigned --": "-- Atanmamış --",
  "— Unassigned —": "— Atanmamış —",
  Fire: "AI Çalışanı Sil",
  "Project Name": "Proje Adı",
  "Type project name or path": "Proje adını veya klasör yolunu yazın",
  "Toggle project list": "Proje listesini aç veya kapat",
  Medium: "Orta",
  "Task title": "Görev başlığı",
  "Task description": "Görev açıklaması",
  Description: "Açıklama",
  "Run task": "Görevi çalıştır",
  Pause: "Duraklat",
  Resume: "Devam Et",
  Stop: "Durdur",
  "View Terminal": "Terminali Görüntüle",
  "Meeting Minutes": "Toplantı Notları",
  "No tasks found": "Görev bulunamadı",
  "No tasks": "Görev yok",
  Collaborating: "Ortak Çalışma",
  collaborating: "Ortak Çalışma",
  "Agent Skills Library": "AI Çalışan Yetenekleri",
  "Add Custom Skill": "Özel Yetenek Ekle",
  "Search skills... (name, repo, category)": "Yeteneklerde ara... (ad, depo, kategori)",
  "By Rank": "Sıralamaya Göre",
  "By Installs": "Kuruluma Göre",
  "By Name": "Ada Göre",
  Frontend: "Ön Yüz",
  Backend: "Arka Uç",
  "AI & Agent": "Yapay Zekâ ve Ajan",
  DevOps: "DevOps",
  Productivity: "Üretkenlik",
  Architecture: "Mimari",
  Security: "Güvenlik",
  Other: "Diğer",
  "Learning History": "Öğrenme Geçmişi",
  "Available Skills": "Kullanılabilir Yetenekler",
  "AI agent skill directory · live skills.sh data": "AI çalışan yetenek kataloğu · güncel skills.sh verisi",
  "Registered skills": "Kayıtlı yetenek",
  " skills shown": " yetenek gösteriliyor",
  "Learning Memory": "Öğrenme Hafızası",
  "Per-CLI skill history": "CLI bazında yetenek geçmişi",
  "Retention: 180 days": "Saklama süresi: 180 gün",
  "Loading memory records...": "Hafıza kayıtları yükleniyor...",
  installs: "kurulum",
  Refresh: "Yenile",
  Learn: "Öğren",
  Copy: "Kopyala",
  Installed: "Kuruldu",
  Install: "Kur",
  "Start Mission": "Görev Başlat",
  "Quick Start": "Hızlı Başlangıç",
  "Create a priority task and move execution immediately.":
    "Öncelikli bir görev oluşturun ve doğrudan çalışmayı başlatın.",
  LIVE: "CANLI",
  Live: "Canlı",
  "Agents are executing missions in real time": "AI çalışanlar görevleri gerçek zamanlı yürütüyor",
  Queued: "Sırada",
  Running: "Çalışıyor",
  Succeeded: "Başarılı",
  Failed: "Başarısız",
  Unlearn: "Hafızadan Çıkar",
  "Unlearning...": "Hafızadan çıkarılıyor...",
  "Morning Briefing": "Sabah Bilgilendirmesi",
  "Afternoon Ops Check": "Öğleden Sonra Operasyon Kontrolü",
  "Evening Wrap-up": "Akşam Değerlendirmesi",
  MISSIONS: "GÖREVLER",
  "Total tasks": "Toplam görev",
  "CLEAR RATE": "TAMAMLANMA ORANI",
  cleared: "tamamlandı",
  uptime: "aktiflik",
  "IN PROGRESS": "DEVAM EDİYOR",
  planned: "planlandı",
  inbox: "gelen kutusu",
  in_progress: "çalışıyor",
  review: "kontrol ediliyor",
  done: "tamamlandı",
  pending: "bekliyor",
  cancelled: "iptal edildi",
  general: "genel",
  development: "yazılım geliştirme",
  design: "tasarım",
  analysis: "analiz",
  presentation: "sunum",
  documentation: "dokümantasyon",
  "RANKING BOARD": "BAŞARI SIRALAMASI",
  "Agent ranking by XP": "XP puanına göre AI çalışan sıralaması",
  "DEPT. PERFORMANCE": "DEPARTMAN PERFORMANSI",
  "by department": "departmanlara göre",
  total: "toplam",
  ON: "AKTİF",
  OFF: "HAZIR",
  SQUAD: "EKİP",
  "MISSION LOG": "GÖREV GÜNLÜĞÜ",
  "Recent activity": "Son aktiviteler",
  "No recent activity": "Henüz aktivite yok",
  "Completed Tasks": "Tamamlanan Görevler",
  "Active Agents": "Aktif AI Çalışanlar",
  "CLI Tools": "CLI Araçları",
  "CLI Tool Status": "CLI Araç Durumu",
  "Not installed": "Kurulu değil",
  "Version unknown": "Sürüm bilinmiyor",
  Authenticated: "Kimlik doğrulandı",
  "Not Authenticated": "Kimlik doğrulanmadı",
  "Main model:": "Ana model:",
  "Sub-agent model:": "Alt çalışan modeli:",
  "No models": "Model bulunamadı",
  "Each agent's CLI tool can be changed in Office by clicking an agent. Configure Copilot/Antigravity models in OAuth tab.":
    "Her AI çalışanın CLI aracı, Ofis ekranında çalışana tıklanarak değiştirilebilir. Copilot ve Antigravity modellerini OAuth bölümünden yapılandırın.",
  Channel: "Kanal",
  "Channel Messaging": "Kanal Mesajlaşması",
  "You can configure messenger channels directly in this tab. Use 'Add Chat' to register messenger/token/target ID/conversation agent.":
    "Mesajlaşma kanallarını bu bölümden yapılandırabilirsiniz. Mesajlaşma servisi, erişim anahtarı, hedef kimliği ve konuşacak AI çalışanı kaydetmek için 'Sohbet Ekle'yi kullanın.",
  "Chat Sessions": "Sohbet Oturumları",
  "Add Chat": "Sohbet Ekle",
  "No chats yet. Use 'Add Chat' to register messenger/token/channel.":
    "Henüz kayıtlı sohbet yok. Mesajlaşma servisi, erişim anahtarı ve kanalı kaydetmek için 'Sohbet Ekle'yi kullanın.",
  "Messages starting with $ become company directives; normal messages go 1:1 to the selected agent.":
    "$ ile başlayan mesajlar işletme talimatı olur; normal mesajlar seçilen AI çalışanla bire bir görüşmeye gider.",
  "Test Send": "Test Mesajı Gönder",
  Receiver: "Alıcı",
  Runtime: "Çalışma Oturumu",
  "Target Session": "Hedef Oturum",
  "No saved session. Add a chat first.": "Kayıtlı oturum yok. Önce bir sohbet ekleyin.",
  "YOLO Mode": "Otomatik Onay Modu",
  "Auto Update (Global)": "Otomatik Güncelleme (Genel)",
  "OAuth Auto Swap": "OAuth Otomatik Geçiş",
  "When enabled, the planning lead auto-analyzes decision steps and proceeds automatically.":
    "Etkinleştirildiğinde planlama lideri karar adımlarını otomatik inceler ve ilerler.",
  "Enable or disable auto-update loop for the whole server.":
    "Sunucunun tamamı için otomatik güncellemeyi açın veya kapatın.",
  "Auto-switch to next OAuth account on failures/limits":
    "Hata veya limit durumunda sonraki OAuth hesabına otomatik geç",
  "OAuth Status": "OAuth Durumu",
  "OAuth storage is active (encryption key configured)": "OAuth kasası etkin (şifreleme anahtarı yapılandırıldı)",
  "Auth Status": "Kimlik Doğrulama Durumu",
  "CLI detected": "CLI algılandı",
  "Detected (not runnable)": "Algılandı (çalıştırılamıyor)",
  "CLI-detected credentials are not used directly for Bigital AI Factory execution. Reconnect with Web OAuth.":
    "CLI üzerinden algılanan kimlik bilgileri çalıştırma için doğrudan kullanılmaz. Web OAuth ile yeniden bağlanın.",
  Scope: "Yetki kapsamı",
  Created: "Oluşturulma",
  "Models require a GitHub Copilot subscription. You can ignore this if you only need repo import.":
    "Modeller için GitHub Copilot aboneliği gerekir. Yalnızca depo aktarımı kullanacaksanız bu uyarıyı dikkate almayabilirsiniz.",
  Expires: "Geçerlilik sonu",
  "Account Pool": "Hesap havuzu",
  "Multiple active accounts supported · lower priority runs first":
    "Birden fazla hesap etkin olabilir · düşük öncelik değeri önce çalışır",
  Label: "Hesap adı",
  "Account alias": "Hesap için görünen ad",
  "Model Override": "Özel model",
  "Use provider default": "Sağlayıcının varsayılanını kullan",
  "Pool Off": "Havuzdan çıkar",
  "Pool On": "Havuza ekle",
  Disable: "Devre dışı bırak",
  Enable: "Etkinleştir",
  Models: "Modeller",
  "Reasoning:": "Akıl yürütme:",
  "Sub reasoning:": "Alt çalışan akıl yürütmesi:",
  "Fast responses with lighter reasoning": "Daha hafif akıl yürütmeyle hızlı yanıt",
  "Balances speed and reasoning depth for everyday tasks": "Günlük işler için hız ve düşünme derinliğini dengeler",
  "Greater reasoning depth for complex problems": "Karmaşık sorunlarda daha derin akıl yürütür",
  "Extra high reasoning depth for complex problems": "Karmaşık sorunlarda çok derin akıl yürütür",
  "Maximum reasoning depth for the hardest problems": "En zor sorunlar için en yüksek akıl yürütme düzeyi",
  "Add OAuth Account": "OAuth Hesabı Ekle",
  Detected: "Algılandı",
  "Add Account": "Hesap Ekle",
  "GitHub OAuth (Copilot included)": "GitHub OAuth (Copilot dahil)",
  "Google OAuth (Antigravity)": "Google OAuth (Antigravity)",
  "GitHub OAuth App (Private repo access)": "GitHub OAuth Uygulaması (Özel depo erişimi)",
  "Default GitHub uses Copilot OAuth which limits private repo access. Register your own OAuth App for full access.":
    "Varsayılan GitHub bağlantısı, özel depo erişimini sınırlayan Copilot OAuth kullanır. Tam erişim için kendi OAuth uygulamanızı kaydedin.",
  "How to create OAuth App": "OAuth uygulaması nasıl oluşturulur?",
  Korean: "Korece",
  English: "İngilizce",
  Turkish: "Türkçe",
  Japanese: "Japonca",
  Chinese: "Çince",
  "CLI Usage": "CLI Kullanımı",
  "Refresh usage data": "Kullanım verilerini yenile",
  Provider: "Sağlayıcı",
  Model: "Model",
  "Default Model": "Varsayılan Model",
  "Default CLI Provider": "Varsayılan CLI Sağlayıcısı",
  Connection: "Bağlantı",
  Connect: "Bağlan",
  Reconnect: "Yeniden Bağlan",
  Disconnect: "Bağlantıyı Kes",
  "Disconnecting...": "Bağlantı kesiliyor...",
  Runnable: "Çalıştırılabilir",
  "Encryption key required": "Şifreleme anahtarı gerekli",
  "Waiting for code...": "Kod bekleniyor...",
  "Auto-refreshed": "Otomatik yenilendi",
  "Refresh failed": "Yenileme başarısız",
  "Expired — re-auth needed": "Süresi doldu — yeniden doğrulama gerekli",
  Expired: "Süresi doldu",
  "Refreshing...": "Yenileniyor...",
  Configure: "Yapılandır",
  "Test Connection": "Bağlantıyı Test Et",
  Name: "Ad",
  Role: "Rol",
  Department: "Departman",
  Personality: "Çalışma Tarzı",
  Avatar: "Avatar",
  "Create Agent": "AI Çalışan Oluştur",
  "Hire New Agent": "Yeni AI Çalışan Ekle",
  "Basic Info": "Temel Bilgiler",
  Emoji: "Emoji",
  "Role Config": "Rol Ayarları",
  "CLI Provider": "CLI Sağlayıcısı",
  "Personality / Prompt": "Çalışma Tarzı / Talimat",
  "Expertise or personality...": "Uzmanlık alanını veya çalışma tarzını yazın...",
  "Character Sprite": "Karakter Görseli",
  "Upload 4-direction sprite sheet (2x2 grid)": "Dört yönlü karakter görseli yükleyin (2x2 düzen)",
  "Front / Left / Back / Right order": "Ön / Sol / Arka / Sağ sırası",
  "(White background)": "(Beyaz arka plan)",
  "Removing background & splitting...": "Arka plan kaldırılıyor ve görsel bölünüyor...",
  Front: "Ön",
  Left: "Sol",
  Right: "Sağ",
  "Sprite #": "Karakter No",
  "Registering...": "Kaydediliyor...",
  "Registered!": "Kaydedildi!",
  "Register Sprite": "Karakter Görselini Kaydet",
  "Re-upload": "Yeniden Yükle",
  "Save Changes": "Değişiklikleri Kaydet",
  "Confirm Hire": "AI Çalışanı Ekle",
  "Update Agent": "AI Çalışanı Güncelle",
  "Delete Agent": "AI Çalışanı Sil",
  "Edit Agent": "AI Çalışanı Düzenle",
  "New Department": "Yeni Departman",
  "Edit Department": "Departmanı Düzenle",
  Icon: "Simge",
  "Theme Color": "Tema Rengi",
  "Korean Name": "Korece Ad",
  "Japanese Name": "Japonca Ad",
  "Chinese Name": "Çince Ad",
  "Brief description of the department": "Departmanın görevini kısaca açıklayın",
  "Department Prompt": "Departman Talimatı",
  "Shared system prompt for agents in this department...":
    "Bu departmandaki AI çalışanlar için ortak sistem talimatı...",
  "Applied as shared system prompt when agents in this department execute tasks":
    "Bu departmandaki AI çalışanlar görev yürütürken ortak sistem talimatı olarak uygulanır",
  No: "Hayır",
  "Department ID already exists.": "Bu departman kimliği zaten kullanılıyor.",
  "Cannot delete: department has agents.": "Bu departmanda AI çalışanlar bulunduğu için silinemez.",
  "Cannot delete: department has tasks.": "Bu departmana bağlı görevler bulunduğu için silinemez.",
  "Cannot delete: protected system department.": "Korunan sistem departmanı silinemez.",
  "Department Name": "Departman Adı",
  "Create Department": "Departman Oluştur",
  "Update Department": "Departmanı Güncelle",
  "Delete Department": "Departmanı Sil",
  Confirm: "Onayla",
  Back: "Geri",
  Next: "İleri",
  Previous: "Önceki",
  "Loading...": "Yükleniyor...",
  "Saving...": "Kaydediliyor...",
  "Creating...": "Oluşturuluyor...",
  "Deleting...": "Siliniyor...",
  "No data": "Veri yok",
  Error: "Hata",
  Success: "Başarılı",
  Warning: "Uyarı",
  Retry: "Tekrar Dene",
  Unknown: "Bilinmiyor",
  Open: "Aç",
  Download: "İndir",
  Upload: "Yükle",
  Enabled: "Etkin",
  Disabled: "Devre Dışı",
  Default: "Varsayılan",
  Custom: "Özel",
  Required: "Zorunlu",
  Optional: "İsteğe Bağlı",
  "Reset Filters": "Filtreleri Sıfırla",
  "Switch to active view (exclude hidden)": "Aktif görünüme geç (gizlenenleri hariç tut)",
  "Switch to all view (include hidden)": "Tümünü göster (gizlenenler dahil)",
  "Hide done/pending/cancelled tasks": "Tamamlanan, bekleyen ve iptal edilen görevleri gizle",
  "Development Office": "Yazılım Geliştirme Ofisi",
  "Report Office": "Rapor Ofisi",
  "Web Research Office": "Web Araştırma Ofisi",
  "Novel Studio": "Roman Stüdyosu",
  "Video Pre-production": "Video Ön Yapım",
  "Roleplay Studio": "Rol Yapma Stüdyosu",
  "Default engineering organization": "Standart yazılım geliştirme ekibi",
  "Research and documentation focused crew": "Araştırma ve dokümantasyon odaklı ekip",
  "Web research and evidence-driven reporting": "Web araştırması ve kanıta dayalı raporlama",
  "Long-form narrative production crew": "Uzun biçimli anlatı üretim ekibi",
  "Storyboard and video planning crew": "Storyboard ve video planlama ekibi",
  "Character and dialogue focused crew": "Karakter ve diyalog odaklı ekip",
  "Editorial Planning": "Editoryal Planlama",
  "Editorial PM": "Editoryal Proje Yöneticisi",
  BRONZE: "BRONZ",
  SILVER: "GÜMÜŞ",
  GOLD: "ALTIN",
  PLATINUM: "PLATİN",
  DIAMOND: "ELMAS",
  MASTER: "USTA",
  "Mevcut mimariyi koruyan yazılım geliştirici. İzole branch, test kanıtı ve bağımsız review ile çalışır.":
    "Mevcut mimariyi koruyan yazılım geliştirici. İzole dal, test kanıtı ve bağımsız incelemeyle çalışır.",
  "Bağımsız Reviewer / QA. Çıktıları kabul kriterlerine ve gerçek doğrulama kanıtlarına göre kontrol eder.":
    "Bağımsız inceleme ve kalite uzmanı. Çıktıları kabul kriterlerine ve gerçek doğrulama kanıtlarına göre kontrol eder.",
  "Problemi, hedef kullanıcıyı, MVP kapsamını ve öncelikli development backlogunu netleştiren ürün uzmanı.":
    "Problemi, hedef kullanıcıyı, MVP kapsamını ve öncelikli geliştirme iş listesini netleştiren ürün uzmanı.",
  "Marka bağlamıyla sosyal içerik ve görsel brief üretir; doğrulanmamış iddialardan kaçınır ve yayın öncesi insan onayı ister.":
    "Marka bağlamıyla sosyal içerik ve görsel yönlendirme üretir; doğrulanmamış iddialardan kaçınır ve yayın öncesi insan onayı ister.",
};

/** Legacy English copy gets a Turkish UI equivalent when one is registered. */
export function translateEnglishToTurkish(value: string): string {
  return TURKISH_COMMON_TEXT[value] ?? value;
}

export interface I18nContextValue {
  language: UiLanguage;
  locale: string;
  t: (text: TranslationInput) => string;
  __fromProvider?: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  locale: "en-US",
  t: (text) => (typeof text === "string" ? text : text.en),
  __fromProvider: false,
});

interface I18nProviderProps {
  language?: string | null;
  children: ReactNode;
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  const normalizedLanguage = normalizeLanguage(language);
  const locale = useMemo(() => localeFromLanguage(normalizedLanguage), [normalizedLanguage]);
  const t = useCallback(
    (text: TranslationInput) => (typeof text === "string" ? text : pickLang(normalizedLanguage, text)),
    [normalizedLanguage],
  );

  const value = useMemo(
    () => ({
      language: normalizedLanguage,
      locale,
      t,
      __fromProvider: true,
    }),
    [normalizedLanguage, locale, t],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(languageOverride?: string | null): I18nContextValue {
  const context = useContext(I18nContext);
  const [runtimeLanguage, setRuntimeLanguage] = useState<UiLanguage>(() => detectRuntimeLanguage());

  useEffect(() => {
    if (context.__fromProvider || typeof window === "undefined") return;
    const sync = () => {
      setRuntimeLanguage(detectRuntimeLanguage());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("climpire-language-change", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("climpire-language-change", sync as EventListener);
    };
  }, [context.__fromProvider]);

  const override = useMemo(() => {
    if (typeof languageOverride !== "string" || !languageOverride.trim()) return null;
    return normalizeLanguage(languageOverride);
  }, [languageOverride]);
  const baseLanguage = context.__fromProvider ? context.language : runtimeLanguage;
  const language = override ?? baseLanguage;

  const t = useCallback(
    (text: TranslationInput) => (typeof text === "string" ? text : pickLang(language, text)),
    [language],
  );

  return useMemo(
    () => ({
      language,
      locale: localeFromLanguage(language),
      t,
      __fromProvider: context.__fromProvider,
    }),
    [context.__fromProvider, language, t],
  );
}
