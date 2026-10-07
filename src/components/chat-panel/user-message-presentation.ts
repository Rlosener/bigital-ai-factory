import { toUserFriendlyError } from "../../lib/user-facing-errors";

const QUOTA_PATTERN = /(?:\b429\b|resource[_ ]exhausted|usage limit|rate.?limit|insufficient_quota|kota)/i;

function localizeName(value: string): string {
  return value.trim().toLowerCase() === "manager" ? "Yönetici" : value.trim();
}

function localizeTaskTitle(value: string): string {
  return value.replace(/보고 자료\(PPT\) 작성:/g, "Sunum raporu:").trim();
}

export function presentChatMessage(content: string, locale: string): string {
  if (!locale.toLowerCase().startsWith("tr")) return content;

  const text = content.trim();
  if (!text) return text;

  if (QUOTA_PATTERN.test(text)) {
    return toUserFriendlyError(
      text,
      "AI sağlayıcısı bu isteği tamamlayamadı. Başka bir bağlantı seçip yeniden deneyin.",
    );
  }

  if (/^\[REPORT ROUTING\]/i.test(text)) {
    return "Rapor görevi uygun AI çalışana atandı.";
  }

  const started = text.match(/^(.+?) started work on '(.+?)'(?:\.\s*)?(?:\(isolated branch:.*\))?\.?$/i);
  if (started)
    return `${localizeName(started[1])}, “${localizeTaskTitle(started[2])}” görevi üzerinde çalışmaya başladı.`;

  const failedTask = text.match(/^Task '(.+?)' failed(?: \(exit code:\s*\d+\))?\.?/i);
  if (failedTask)
    return `“${localizeTaskTitle(failedTask[1])}” görevi tamamlanamadı. Görevi veya bağlantıyı kontrol edip yeniden deneyin.`;

  const failedForCeo = text.match(/^CEO, '(.+?)' failed with an issue/i);
  if (failedForCeo)
    return `“${localizeTaskTitle(failedForCeo[1])}” görevi tamamlanamadı. Başka bir bağlantı seçebilir veya görevi düzenleyebilirsiniz.`;

  const assigned = text.match(/^(.+?) assigned '(.+?)' to (.+?)\.?$/i);
  if (assigned) {
    return `${localizeName(assigned[1])}, “${localizeTaskTitle(assigned[2])}” görevini ${localizeName(assigned[3])} adlı AI çalışana atadı.`;
  }

  const newTask = text.match(/^New task assigned:\s*(.+)$/i);
  if (newTask) return `Yeni görev atandı: ${newTask[1]}`;

  if (/^Noted! Management will take this into account\.?$/i.test(text)) {
    return "Not alındı. Yönetici bu bilgiyi sonraki adımlarda dikkate alacak.";
  }
  if (/^Understood\./i.test(text)) {
    return "Anlaşıldı. Önce çalışma planı hazırlanacak, ardından görev uygun AI çalışan tarafından yürütülecek.";
  }
  if (/^Atlas here\. Report request received/i.test(text)) {
    return "Rapor isteği alındı. Sonuç sunum biçiminde hazırlanacak.";
  }
  if (/^\[CLAUDE RECOMMENDATION\]/i.test(text)) {
    return "Rapor için uygun AI çalışan seçildi; sunum üretilemezse sonuç doküman olarak hazırlanacak.";
  }
  if (/^\[Planning\] Related departments identified/i.test(text)) {
    return "Planlama tamamlandı; görevle ilgili ekipler belirlendi.";
  }
  if (/^\[CEO OFFICE\].*planned round.*started/i.test(text)) {
    return "Planlama turu başladı. Uygulanabilir alt görevler hazırlanıyor.";
  }
  if (/^\[CEO OFFICE\].*planned meeting.*complete/i.test(text)) {
    return "Planlama tamamlandı. Görev uygulama aşamasına alındı.";
  }
  const subtasks = text.match(/^Created (\d+) subtasks/i);
  if (subtasks) return `${subtasks[1]} alt görev oluşturuldu ve sorumlularına atandı.`;

  return text
    .replace(/보고 자료\(PPT\) 작성:/g, "Sunum raporu:")
    .replace(/(Sorumlu:\s*)Manager\b/g, "$1Yönetici")
    .replace(/\(isolated branch:[^)]+\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
