import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fmtSAR } from "@/lib/finance/constants";
import {
  fetchFinanceOverview,
  delta,
  pct,
  type FinanceOverview,
} from "@/lib/finance/overview";
import { FinanceRowsDrawer, type DrawerSpec } from "./FinanceRowsDrawer";
import { SalesRowsDrawer, type SalesDrillSpec } from "./SalesRowsDrawer";
import {
  fetchProviderTaxInvoiceAlerts,
  PROVIDER_TAX_ALERT_LABEL,
  type ProviderTaxInvoiceAlerts,
  type ProviderTaxAlertRow,
} from "@/lib/finance/provider-tax-invoices";
import {
  Wallet,
  TrendingUp,
  Banknote,
  Receipt,
  Activity,
  CreditCard,
  Truck,
  Ticket,
  Info,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const num = (n: number) => fmtSAR(n);
const pctTxt = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

export function OverviewPanel({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fin, setFin] = useState<DrawerSpec | null>(null);
  const [sales, setSales] = useState<SalesDrillSpec | null>(null);
  const [taxAlerts, setTaxAlerts] = useState<ProviderTaxInvoiceAlerts | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, alerts] = await Promise.all([
          fetchFinanceOverview(from, to),
          fetchProviderTaxInvoiceAlerts().catch(() => null),
        ]);
        if (alive) {
          setData(d);
          setTaxAlerts(alerts);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? "تعذر تحميل البيانات");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [from, to]);

  if (loading) return <div className="py-10 text-center text-xs text-muted-foreground">جاري تحميل النظرة العامة…</div>;
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-[12px] text-red-300">
        تعذر تحميل النظرة العامة: {error}
      </div>
    );
  if (!data) return null;

  const k = data.kpis;
  const h = data.sales_health;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-muted-foreground">
        الفترة: <span className="font-mono text-foreground">{data.range.from} → {data.range.to}</span> — المقارنة مع{" "}
        <span className="font-mono">{data.range.prev_from} → {data.range.prev_to}</span>. المبيعات ≠ المقبوضات؛ مسحوبات
        المالك والتحويلات الداخلية مستبعدة من صافي التشغيل النقدي.
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi
          icon={Wallet}
          label="رصيد حسابات المؤسسة"
          value={k.bank_balance}
          tone="text-sky-300"
          hint="مجموع أرصدة الحسابات البنكية/النقدية للنشاط (ليس مرتبطًا بالفترة)."
        />
        <Kpi
          icon={TrendingUp}
          label="إجمالي المبيعات (غير الملغاة)"
          value={k.total_sales}
          prev={k.prev_total_sales}
          tone="text-emerald-300"
          hint="قيمة الفواتير غير الملغاة الصادرة داخل الفترة، شاملة الضريبة."
          onClick={() => setSales({ title: "المبيعات غير الملغاة", from, to })}
        />
        <Kpi
          icon={Banknote}
          label="المقبوض فعليًا"
          value={k.collected}
          prev={k.prev_collected}
          tone="text-emerald-300"
          hint="المقبوضات التشغيلية الفعلية فقط، دون مساهمات المالك أو التحويلات الداخلية."
          onClick={() => setFin({ title: "المقبوضات التشغيلية", show: "income", dateFrom: from, dateTo: to })}
        />
        <Kpi
          icon={Receipt}
          label="مصروفات النشاط"
          value={k.operating_expenses}
          prev={k.prev_operating_expenses}
          tone="text-red-300"
          invertDelta
          hint="المصروفات التشغيلية فقط، دون سحوبات المالك أو التحويلات الداخلية."
          onClick={() => setFin({ title: "مصروفات النشاط", show: "expense", dateFrom: from, dateTo: to })}
        />
        <Kpi
          icon={Activity}
          label="صافي التشغيل النقدي"
          value={k.net_operating_cash}
          prev={k.prev_net_operating_cash}
          tone={k.net_operating_cash >= 0 ? "text-emerald-300" : "text-red-300"}
          accent="border-gold/30 bg-gold/5"
          hint="المقبوضات التشغيلية − مصروفات النشاط."
          onClick={() => setFin({ title: "حركة التشغيل النقدي", show: "both", dateFrom: from, dateTo: to })}
        />
        <Kpi
          icon={CreditCard}
          label="إجمالي تكلفة بوابات الدفع"
          value={k.gateway_cost}
          prev={k.prev_gateway_cost}
          tone="text-amber-300"
          invertDelta
          hint="رسوم + ضريبة الرسوم + رسوم التحويل + خصومات أخرى من التسويات (معلومة، لا تُخصم مرتين)."
        />
      </div>

      {/* Direct customer transfers needing a linked invoice */}
      {data.customer_transfers && data.customer_transfers.count > 0 && (
        <Link
          to="/admin/finance/incomes"
          search={{ cust: "needs_link", month: "" } as any}
          className="block rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 transition hover:bg-amber-500/15"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              حوالات عملاء تحتاج إجراء
            </div>
            <div className="text-[12px] text-amber-100/80">
              {data.customer_transfers.count} حوالة · {num(data.customer_transfers.amount)} ر.س
              {data.customer_transfers.oldest_date && (
                <> · الأقدم {data.customer_transfers.oldest_date} (منذ {data.customer_transfers.oldest_age_days} يوم)</>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <SplitPill label="غير مرتبطة" count={data.customer_transfers.unlinked_count} amount={data.customer_transfers.unlinked_amount} />
            <SplitPill label="اشتباه تكرار" count={data.customer_transfers.suspected_duplicate_count} amount={data.customer_transfers.suspected_duplicate_amount} />
          </div>
          <div className="mt-2 text-[10px] text-amber-100/60">
            أخطاء فعلية تحتاج مراجعة: حوالات غير مرتبطة بفاتورة أو يُشتبه بتكرارها. لا تشمل سلة/تابي/تمارا ولا التحويلات الداخلية.
          </div>
        </Link>
      )}

      {data.customer_transfers && data.customer_transfers.advance_pending_count > 0 && (
        <Link
          to="/admin/finance/incomes"
          search={{ cust: "advance_pending", month: "" } as any}
          className="block rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 transition hover:bg-sky-500/15"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-sky-200">
              <Info className="h-4 w-4" />
              أرصدة مقدمة لدى العملاء
            </div>
            <div className="text-[12px] text-sky-100/80">
              {data.customer_transfers.advance_pending_count} حوالة · {num(data.customer_transfers.advance_pending_amount)} ر.س
            </div>
          </div>
          <div className="mt-2 text-[10px] text-sky-100/70">
            دفعات وصلت قبل إصدار أو ربط فاتورة؛ تبقى رصيدًا للعميل حتى استخدامها.
          </div>
        </Link>
      )}

      {/* Provider tax invoice alerts */}
      {taxAlerts && taxAlerts.action_required_count > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-red-200">
              <AlertTriangle className="h-4 w-4" />
              فواتير ضريبية للبوابات تحتاج إجراء
            </div>
            <div className="text-[12px] text-red-100/80">{taxAlerts.action_required_count} حالة</div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <CountPill label="فاتورة الشهر غير مسجلة" count={taxAlerts.missing_invoice_count} />
            <CountPill label="ملف PDF مفقود" count={taxAlerts.missing_attachment_count} />
            <CountPill label="تحتاج مطابقة مع التسويات" count={taxAlerts.unreconciled_count} />
          </div>
          <div className="mt-3 space-y-2">
            {taxAlerts.rows
              .filter((r) => r.alert_status !== "awaiting_issue")
              .map((r, i) => (
                <ProviderAlertRow key={`${r.provider_id}-${r.fee_month}-${r.alert_status}-${i}`} r={r} />
              ))}
          </div>
        </div>
      )}

      {taxAlerts && taxAlerts.waiting_count > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-sky-200">
              <Info className="h-4 w-4" />
              فواتير الشهر بانتظار الإصدار
            </div>
            <div className="text-[12px] text-sky-100/80">{taxAlerts.waiting_count} بوابة</div>
          </div>
          <div className="mt-3 space-y-1 text-[11px]">
            {taxAlerts.rows
              .filter((r) => r.alert_status === "awaiting_issue")
              .map((r, i) => (
                <div
                  key={`${r.provider_id}-${r.fee_month}-w-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/20 bg-black/20 px-3 py-2"
                >
                  <span className="text-sky-100">{r.provider_name} · شهر {r.fee_month}</span>
                  <span className="font-mono text-sky-100/80">
                    الموعد {r.due_date ?? "—"} · {r.settlement_count} تسوية
                  </span>
                </div>
              ))}
          </div>
          <div className="mt-2 text-[10px] text-sky-100/70">لا يُحتسب كخطأ؛ ضمن المهلة المسموحة للإصدار.</div>
        </div>
      )}


      {/* Secondary */}

      <details className="rounded-xl border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-[12px] text-muted-foreground">
          الأصول والمخزون وصافي الثروة ومسحوبات المالك
        </summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Mini label="قيمة المخزون (يدوي)" value={k.inventory_value} />
          <Mini label="الأصول (يدوي)" value={k.assets_value} />
          <Mini label="صافي الثروة التقريبي" value={k.bank_balance + k.inventory_value + k.assets_value} />
          <Mini label="مسحوبات المالك" value={k.owner_draws} tone="text-orange-300" />
        </div>
      </details>

      {/* Payment methods */}
      <Section icon={CreditCard} title="كيف دفع العملاء؟" note="طريقة الدفع الأصلية من سلة بعد التوحيد.">
        {data.payment_methods.length === 0 ? (
          <Empty>لا توجد مبيعات في هذه الفترة.</Empty>
        ) : (
          <Table
            head={["الطريقة", "الطلبات", "العملاء", "المبيعات", "% من المبيعات", "متوسط الطلب"]}
            rows={data.payment_methods.map((m) => ({
              key: m.method,
              onClick: () => setSales({ title: `المبيعات — ${m.method}`, from, to, method: m.method }),
              cells: [
                m.method,
                m.orders,
                m.customers,
                num(m.sales),
                `${pct(m.sales, k.total_sales).toFixed(1)}%`,
                num(m.avg_order ?? 0),
              ],
            }))}
          />
        )}
      </Section>

      {/* Gateways */}
      <Section icon={Banknote} title="كم أخذت البوابات مني؟" note="التكلفة = الرسوم + ضريبة الرسوم + رسوم التحويل + خصومات أخرى (بدون المرتجعات).">
        {data.gateways.length === 0 ? (
          <Empty>لا توجد تسويات مسجلة في هذه الفترة.</Empty>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {data.gateways.map((g) => (
              <Link
                key={g.provider}
                to="/admin/finance/settlements"
                className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-gold/30 hover:bg-white/10 transition block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{g.provider}</span>
                  <span className="text-[10px] text-muted-foreground">{g.settlements_count} تسوية</span>
                </div>
                <div className="mt-2 text-xl font-mono text-amber-300">
                  {num(g.total_cost)} <span className="text-[10px] text-muted-foreground">ر.س تكلفة</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  المتبقي من كل 100 ريال:{" "}
                  <span className="font-mono text-emerald-300">
                    {g.gross_sales_amount ? (100 - (g.total_cost / g.gross_sales_amount) * 100).toFixed(2) : "—"}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-[11px]">
                  <Line label="المبيعات عبر البوابة" v={g.gross_sales_amount} />
                  <Line label="المرتجعات" v={g.refunds_amount} />
                  <Line label="الرسوم قبل الضريبة" v={g.fees_before_vat} />
                  <Line label="ضريبة الرسوم" v={g.fees_vat_amount} />
                  <Line label="رسوم التحويل" v={g.payout_fee} />
                  <Line label="خصومات أخرى" v={g.other_deductions} />
                  <Line label="الصافي المتوقع" v={g.expected_net_amount} />
                  <Line label="الوارد فعليًا للبنك" v={g.actual_bank_amount} />
                  <Line label="المعلّق" v={g.pending_amount} />
                  <Line label="الفرق" v={g.difference_amount} tone={Math.abs(g.difference_amount) > 1 ? "text-red-300" : undefined} />
                </dl>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Sales health */}
      <Section icon={TrendingUp} title="صحة المبيعات">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Mini label="الطلبات" value={h.orders} raw />
          <Mini label="العملاء" value={h.customers} raw />
          <Mini label="عملاء جدد" value={h.new_customers} raw />
          <Mini label="عملاء عائدون" value={h.returning_customers} raw />
          <Mini
            label="نسبة التكرار"
            value={`${pct(h.returning_customers, h.customers).toFixed(1)}%`}
            raw
          />
          <Mini label="متوسط الطلب" value={h.avg_order ?? 0} />
          <Mini label="وسيط الطلب" value={h.median_order} />
          <Mini label="الخصومات" value={h.discounts} tone="text-amber-300" />
          <Mini label="المرتجعات" value={h.refunds} tone="text-red-300" />
          <Mini label="نسبة المرتجعات" value={`${pct(h.refunds, k.total_sales).toFixed(1)}%`} raw />
          <Mini label="قيمة الشحن المحصلة" value={h.shipping_collected} />
          <Mini label="الإلغاءات" value={`${h.cancelled_orders} — ${num(h.cancelled_value)}`} raw tone="text-red-300" />
        </div>

        {h.partial_payments > 0 && (
          <button
            type="button"
            onClick={() => setSales({ title: "دفعات جزئية مؤكدة", from, to, partialOnly: true })}
            className="mt-3 w-full text-start rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-300 hover:bg-amber-500/10"
          >
            <AlertTriangle size={13} className="inline-block ms-1" /> دفعات جزئية مؤكدة: {h.partial_payments} فاتورة بقيمة
            متبقية {num(h.partial_payments_amount)} ر.س — اضغط للتفاصيل.
          </button>
        )}

        <DailyChart cur={h.daily} prev={h.prev_daily} />
      </Section>

      {/* Discount codes */}
      <Section icon={Ticket} title="أكواد الخصم">
        {data.discount_codes.length === 0 ? (
          <Empty>لا توجد أكواد خصم مستخدمة في هذه الفترة.</Empty>
        ) : (
          <Table
            head={["الكود", "الطلبات", "العملاء", "المبيعات", "قيمة الخصم", "متوسط الطلب", "جدد", "المرتجعات", "صافي المبيعات"]}
            rows={data.discount_codes.map((d) => ({
              key: d.code,
              onClick: () => setSales({ title: `فواتير الكود ${d.code}`, from, to, code: d.code }),
              cells: [
                d.code,
                d.orders,
                d.customers,
                num(d.sales),
                num(d.discount_value),
                num(d.avg_order ?? 0),
                d.new_customers,
                num(d.refunds),
                num(d.net_sales),
              ],
            }))}
          />
        )}
      </Section>

      {/* Shipping */}
      <Section icon={Truck} title="أداء شركات الشحن">
        {!data.shipping.has_data ? (
          <Empty>أعد استيراد ملف سلة لتعبئة شركات الشحن.</Empty>
        ) : (
          <>
            <Table
              head={["الشركة", "الطلبات", "تم التوصيل", "نشط", "ملغي", "% من الطلبات", "الشحن المحصل", "متوسط الشحن"]}
              rows={data.shipping.companies.map((c) => {
                const totalOrders = data.shipping.companies.reduce((a, x) => a + x.orders, 0);
                return {
                  key: c.company,
                  onClick: () => setSales({ title: `طلبات ${c.company}`, from, to, company: c.company }),
                  cells: [
                    c.company,
                    c.orders,
                    c.delivered,
                    c.active,
                    c.cancelled,
                    `${pct(c.orders, totalOrders).toFixed(1)}%`,
                    num(c.shipping_collected),
                    num(c.avg_shipping ?? 0),
                  ],
                };
              })}
            />
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Mini label="إجمالي الشحن المحصل" value={data.shipping.collected_total} />
              <Mini label="مصروفات التوصيل (Delivery)" value={data.shipping.expenses_total} tone="text-red-300" />
              <Mini
                label="صافي مساهمة الشحن"
                value={data.shipping.collected_total - data.shipping.expenses_total}
                tone={data.shipping.collected_total - data.shipping.expenses_total >= 0 ? "text-emerald-300" : "text-red-300"}
              />
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              مصروفات التوصيل لا تُنسب لشركة محددة إلا عند تطابق اسم المورد؛ غير ذلك تظهر كإجمالي «غير مربوط».
            </div>
          </>
        )}
      </Section>

      {fin && <FinanceRowsDrawer spec={fin} onClose={() => setFin(null)} />}
      {sales && <SalesRowsDrawer spec={sales} onClose={() => setSales(null)} />}
    </div>
  );
}

/* ---------- small building blocks ---------- */

function Kpi({
  icon: Icon,
  label,
  value,
  prev,
  tone,
  accent,
  hint,
  onClick,
  invertDelta,
}: {
  icon: any;
  label: string;
  value: number;
  prev?: number;
  tone?: string;
  accent?: string;
  hint?: string;
  onClick?: () => void;
  invertDelta?: boolean;
}) {
  const d = prev === undefined ? null : delta(value, prev);
  const good = d === null ? null : invertDelta ? d <= 0 : d >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={hint}
      className={`text-start rounded-xl border p-4 transition ${accent ?? "border-white/10 bg-white/5"} ${
        onClick ? "hover:bg-white/10 hover:border-gold/30 cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1">
          {label}
          {hint && <Info size={11} className="opacity-50" />}
        </span>
        <Icon size={15} className={tone} />
      </div>
      <div className={`mt-2 text-xl font-semibold font-mono ${tone ?? ""}`}>
        {num(value)} <span className="text-[10px] text-muted-foreground">ر.س</span>
      </div>
      {d !== null && (
        <div className={`mt-1 text-[11px] font-mono flex items-center gap-1 ${good ? "text-emerald-300" : "text-red-300"}`}>
          {good ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />} {pctTxt(d)}{" "}
          <span className="text-muted-foreground">مقابل الفترة السابقة</span>
        </div>
      )}
    </button>
  );
}

function Mini({ label, value, tone, raw }: { label: string; value: number | string; tone?: string; raw?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-[13px] font-mono ${tone ?? ""}`}>
        {raw ? value : num(Number(value))}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  note,
  children,
}: {
  icon: any;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Icon size={15} className="text-gold" /> {title}
        </h3>
        {note && <p className="text-[11px] text-muted-foreground mt-1">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-[12px] text-muted-foreground">
      {children}
    </div>
  );
}

function Line({ label, v, tone }: { label: string; v: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-mono ${tone ?? ""}`}>{num(v)}</dd>
    </div>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: { key: string; cells: (string | number)[]; onClick?: () => void }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-[12px] min-w-max">
        <thead className="bg-white/5 text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-2 text-start whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              onClick={r.onClick}
              className={`border-t border-white/5 ${r.onClick ? "cursor-pointer hover:bg-white/5" : ""}`}
            >
              {r.cells.map((c, i) => (
                <td key={i} className={`p-2 whitespace-nowrap ${i === 0 ? "" : "font-mono"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyChart({ cur, prev }: { cur: { d: string; sales: number }[]; prev: { d: string; sales: number }[] }) {
  if (!cur.length) return null;
  const max = Math.max(...cur.map((x) => x.sales), ...prev.map((x) => x.sales), 1);
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-muted-foreground mb-2">
        المبيعات اليومية <span className="text-gold">■</span> الفترة الحالية{" "}
        <span className="text-white/30">■</span> الفترة السابقة
      </div>
      <div className="flex items-end gap-[3px] h-32">
        {cur.map((x, i) => (
          <div key={x.d} className="flex-1 flex items-end gap-[1px]" title={`${x.d} — ${num(x.sales)} ر.س`}>
            <div className="flex-1 rounded-t bg-gold/70" style={{ height: `${(x.sales / max) * 100}%` }} />
            <div
              className="flex-1 rounded-t bg-white/15"
              style={{ height: `${((prev[i]?.sales ?? 0) / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitPill({ label, count, amount }: { label: string; count: number; amount: number }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-black/20 px-3 py-2">
      <div className="text-amber-100/70">{label}</div>
      <div className="mt-0.5 font-mono text-amber-100">
        {count} · {fmtSAR(amount)}
      </div>
    </div>
  );
}
