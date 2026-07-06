// Static UI strings dictionary. Keys are stable identifiers used in components via `t(key)`.
// Overrides from `ui_translations` table take precedence at runtime.

export type Lang = "ar" | "en";

export const STRINGS = {
  // navbar / actions
  "nav.admin": { ar: "الإدارة", en: "Admin" },
  "nav.dashboard": { ar: "لوحة العميل", en: "My Account" },
  "nav.login": { ar: "دخول", en: "Sign in" },
  "nav.signIn": { ar: "تسجيل دخول", en: "Sign in" },
  "nav.signOut": { ar: "تسجيل الخروج", en: "Sign out" },
  "nav.whatsapp": { ar: "اطلب عبر واتساب", en: "Order via WhatsApp" },
  "nav.whatsappShort": { ar: "واتساب", en: "WhatsApp" },
  "nav.shop": { ar: "تسوق الآن", en: "Shop now" },
  "nav.menu": { ar: "القائمة", en: "Menu" },
  "nav.close": { ar: "إغلاق", en: "Close" },
  "nav.hello": { ar: "مرحبًا", en: "Hello" },
  "nav.myRequests": { ar: "طلباتي", en: "My requests" },
  "nav.myTanks": { ar: "أحواضي", en: "My tanks" },
  "nav.myAppointments": { ar: "مواعيدي", en: "My appointments" },

  // whatsapp default message
  "wa.defaultMessage": {
    ar: "السلام عليكم، أرغب بطلب خدمة من أكوا هيفن.",
    en: "Hello, I'd like to request a service from Aqua Haven.",
  },

  // language switcher
  "lang.switchToEn": { ar: "English", en: "English" },
  "lang.switchToAr": { ar: "العربية", en: "العربية" },

  // generic
  "common.back": { ar: "رجوع", en: "Back" },
  "common.home": { ar: "العودة للرئيسية", en: "Back to home" },
  "common.save": { ar: "حفظ التغييرات", en: "Save changes" },
  "common.saving": { ar: "جارٍ الحفظ…", en: "Saving…" },
  "common.saved": { ar: "تم الحفظ", en: "Saved" },
  "common.loading": { ar: "جارٍ التحميل…", en: "Loading…" },
  "common.error": { ar: "حدث خطأ", en: "Something went wrong" },
  "common.retry": { ar: "حاول مرة أخرى", en: "Try again" },
  "common.next": { ar: "التالي", en: "Next" },
  "common.prev": { ar: "السابق", en: "Previous" },
  "common.close": { ar: "إغلاق", en: "Close" },
  "common.cancel": { ar: "إلغاء", en: "Cancel" },
  "common.confirm": { ar: "تأكيد", en: "Confirm" },
  "common.search": { ar: "بحث", en: "Search" },
  "common.readMore": { ar: "اقرأ المزيد", en: "Read more" },

  // 404
  "404.title": { ar: "الصفحة غير موجودة", en: "Page not found" },
  "404.desc": {
    ar: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    en: "The page you're looking for doesn't exist or was moved.",
  },

  // footer
  "footer.rights": {
    ar: "© أكوا هيفن — جميع الحقوق محفوظة.",
    en: "© Aqua Haven — All rights reserved.",
  },
  "footer.tagline": {
    ar: "عالمك المائي يبدأ من هنا",
    en: "Your aquatic world starts here",
  },
} as const;

export type StringKey = keyof typeof STRINGS;

export function baseT(key: StringKey, lang: Lang): string {
  const row = STRINGS[key];
  if (!row) return key;
  return row[lang] || row.ar || key;
}

export const ALL_UI_KEYS: StringKey[] = Object.keys(STRINGS) as StringKey[];
