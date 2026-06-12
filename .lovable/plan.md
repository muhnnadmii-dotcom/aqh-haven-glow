# لوحة تحكم الأدمن — أكوا هيفن

## نظرة عامة
تفعيل Lovable Cloud (قاعدة بيانات + تسجيل دخول)، ونقل كل محتوى الموقع من ملفات الكود إلى قاعدة البيانات، مع لوحة تحكم خاصة بك تعدّل منها كل شيء، ولوحة عميل بسيطة يرسل منها رسائله ويتابع الرد.

## المصادقة والأدوار
- تسجيل دخول بالإيميل/كلمة المرور + Google (مُدار من Lovable Cloud).
- جدول `profiles` (id, full_name, phone, avatar_url).
- نوع `app_role` = (`admin`, `customer`) + جدول `user_roles`.
- دالة `has_role(user_id, role)` security definer لحماية RLS من التكرار.
- بعد أول تسجيل لك → ترقّي حسابك يدوياً إلى `admin` بـ SQL واحد.
- الزوار يقدرون يرسلون نماذج تواصل/استشارة بدون تسجيل (يُحفظ بدون user_id)، والعملاء المسجّلين يشوفون طلباتهم في لوحتهم.

## الجداول (Lovable Cloud)
- `projects` — الأحواض (كل حقول `src/data/projects.ts` الحالية: title, slug, category, featured, location, year, description, specs jsonb, equipment jsonb, addons jsonb, contents jsonb, price_min, price_max, images text[]).
- `articles` — المقالات (slug, title, excerpt, body, cover_image, published_at, tags).
- `testimonials` — الشهادات (name, rating, body, featured).
- `contact_requests` — طلبات تواصل (name, phone, type, message, user_id nullable, status, admin_notes, created_at).
- `consultation_requests` — استشارات (name, phone, tank_type, goal, size, details, user_id nullable, status, admin_notes).
- Storage bucket `media` لرفع الصور (أحواض ومقالات).

RLS: الأدمن يقرأ/يكتب كل شيء. العميل يقرأ طلباته فقط. القوائم العامة (projects/articles/testimonials المنشورة) متاحة للقراءة العامة.

## الصفحات الجديدة
- `/auth` — تسجيل دخول/إنشاء حساب (إيميل + Google).
- `/admin` — لوحة الأدمن (محمية بدور admin):
  - `/admin` — نظرة عامة (إحصائيات: طلبات جديدة، عدد الأحواض/المقالات).
  - `/admin/projects` — قائمة + إضافة/تعديل/حذف + رفع صور.
  - `/admin/articles` — محرر مقالات.
  - `/admin/testimonials` — إدارة الشهادات.
  - `/admin/requests` — صندوق وارد لطلبات التواصل والاستشارات مع حالة (جديد/قيد المتابعة/مغلق) وملاحظات.
- `/account` — لوحة العميل (محمية بتسجيل دخول): بياناته + طلباته السابقة وحالتها.

## تعديل النماذج الحالية
- نموذج التواصل والاستشارة: يحفظ في قاعدة البيانات أولاً، ثم يفتح واتساب (نفس السلوك الحالي + سجل دائم).
- الصفحات العامة (الأحواض، المقالات، الشهادات، الصفحة الرئيسية) تقرأ من قاعدة البيانات بدل ملفات الكود.

## التفاصيل التقنية
- TanStack server functions مع `requireSupabaseAuth` لقراءة/كتابة الأدمن.
- مسار `_authenticated/admin/*` محمي بطبقتين: تسجيل دخول + فحص دور admin في `beforeLoad` عبر `has_role`.
- رفع الصور إلى Storage `media` مع توليد URL عام.
- ملف `src/data/projects.ts` يبقى كـ seed أولي يُنقل لقاعدة البيانات في أول migration (Insert)، ثم تعتمد الواجهة على القاعدة.

## خطة التنفيذ (مراحل)
1. تفعيل Lovable Cloud + إنشاء كل الجداول والـ RLS و Storage bucket + seed الأحواض الحالية.
2. صفحة `/auth` + نظام الأدوار + ترقيتك لأدمن.
3. لوحة `/admin` كاملة (CRUD للأحواض، المقالات، الشهادات، الطلبات).
4. ربط النماذج العامة بالقاعدة + لوحة `/account` للعميل.
5. تحويل صفحات العرض العامة لقراءة البيانات من القاعدة.

بعد موافقتك على الخطة أبدأ التنفيذ مرحلة مرحلة.
