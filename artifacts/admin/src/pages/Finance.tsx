import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RCTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Banknote, Zap, Clock, Users, Car, MapPin, TrendingUp, TrendingDown,
  Download, RefreshCw, AlertTriangle, Tag, ChevronDown, ChevronRight,
  Activity, BarChart2, Info, GitCompare, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { formatUzs, formatUzsRaw } from "@/lib/formatUzs";
import { exportXlsx } from "@/lib/exportXlsx";

// ── API helpers ────────────────────────────────────────────────────────────────
function apiBase() {
  const base = (import.meta as any).env?.BASE_URL ?? "/admin";
  return base.replace(/\/$/, "").replace("/admin", "");
}
function authHeaders() {
  const token = localStorage.getItem("admin_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface DailyStat { day: string; revenue: number; kwh: number; sessions: number; }
interface TopStation { station_id: number | null; name: string; revenue: number; sessions: number; kwh: number; }
interface OperatorRow  { operator_id: number | null; name: string; revenue: number; sessions: number; kwh: number; }
interface HourlyRow    { hour: number; sessions: number; kwh: number; }
interface TopUser      { user_id: string; sessions: number; kwh: number; spent: number; }
interface TopModel     { make: string; model: string; count: number; }
interface ConnectorRow { connector_type: string; sessions: number; revenue: number; }
interface LowStation   { id: number; name: string; session_count: number; }

interface PeriodSummary {
  total_revenue:    number;
  total_kwh:        number;
  session_count:    number;
  avg_check:        number;
  unique_users:     number;
  avg_duration_sec: number;
  estimated_cost:   number;
  estimated_profit: number;
  margin_pct:       number;
}

interface FinanceData {
  period: string;
  from: string;
  to: string;
  summary: PeriodSummary;
  daily:               DailyStat[];
  compare: {
    from: string;
    to: string;
    summary: PeriodSummary;
    daily: DailyStat[];
  } | null;
  top_stations:        TopStation[];
  operator_breakdown:  OperatorRow[];
  hourly_distribution: HourlyRow[];
  user_stats: {
    total_registered: number;
    new_in_period:    number;
    active_in_period: number;
    retention_pct:    number;
    top_users:        TopUser[];
  };
  vehicle_stats: {
    total_user_vehicles: number;
    top_models:          TopModel[];
  };
  top_vehicles:         { connector_type: string; count: number }[];
  connector_split:      ConnectorRow[];
  low_traffic_stations: LowStation[];
}

// ── Compare state ──────────────────────────────────────────────────────────────
type CompareMode = "prev_similar" | "custom";
interface CompareState { enabled: boolean; mode: CompareMode; from: string; to: string; }

// ── Palette ────────────────────────────────────────────────────────────────────
const COLORS = ["#2563EB", "#7C3AED", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

// ── Duration formatter ─────────────────────────────────────────────────────────
function fmtDuration(sec: number): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(";");
  const body = rows.map(r => keys.map(k => String(r[k] ?? "")).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Demo badge ─────────────────────────────────────────────────────────────────
function DemoBadge() {
  return (
    <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-medium">
      демо-данные
    </Badge>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || !isFinite(delta)) return null;
  const positive = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded px-1.5 py-0.5 ${
      positive
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
    }`}>
      {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {positive ? "+" : ""}{delta.toFixed(1)}%
    </span>
  );
}

function calcDelta(current: number, base: number): number | null {
  if (!base) return null;
  return Math.round(((current - base) / Math.abs(base)) * 1000) / 10;
}

// ── KPI card ──────────────────────────────────────────────────────────────────
interface KpiProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  demo?: boolean;
  warn?: boolean;
  iconBg?: string;
  delta?: number | null;
}
function KpiCard({ icon: Icon, label, value, sub, demo, warn, iconBg = "bg-primary/10 text-primary", delta }: KpiProps) {
  return (
    <Card className="shadow-sm border-none bg-white dark:bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-sm text-muted-foreground font-medium truncate">{label}</p>
              {demo && <DemoBadge />}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className={`text-2xl font-bold ${warn ? "text-red-600" : ""}`}>{value}</p>
              {delta !== undefined && delta !== null && <DeltaBadge delta={delta} />}
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  onExport?: () => void;
  children: React.ReactNode;
}
function Section({ title, icon: Icon, defaultOpen = true, onExport, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="shadow-sm border-none bg-white dark:bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
              {onExport && (
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => { e.stopPropagation(); onExport(); }}
                >
                  <Download className="h-3 w-3" /> CSV
                </Button>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <CardContent className="pt-4 pb-5">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── Period filter ──────────────────────────────────────────────────────────────
type PeriodKey = "day" | "week" | "month" | "custom";

interface PeriodState { period: PeriodKey; from: string; to: string; }

function usePeriod(): [PeriodState, (p: PeriodState) => void, CompareState, (c: CompareState) => void] {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);

  const period  = (params.get("period") ?? "month") as PeriodKey;
  const fromStr = params.get("from") ?? "";
  const toStr   = params.get("to")   ?? "";
  const state: PeriodState = { period, from: fromStr, to: toStr };

  const cmpEnabled = params.get("cmp") === "1";
  const cmpMode    = (params.get("cmode") ?? "prev_similar") as CompareMode;
  const cmpFrom    = params.get("cfrom") ?? "";
  const cmpTo      = params.get("cto")   ?? "";
  const compareState: CompareState = { enabled: cmpEnabled, mode: cmpMode, from: cmpFrom, to: cmpTo };

  const buildUrl = useCallback((next: PeriodState, cmp: CompareState) => {
    const p = new URLSearchParams();
    p.set("period", next.period);
    if (next.period === "custom") {
      if (next.from) p.set("from", next.from);
      if (next.to)   p.set("to",   next.to);
    }
    if (cmp.enabled) {
      p.set("cmp", "1");
      p.set("cmode", cmp.mode);
      if (cmp.mode === "custom") {
        if (cmp.from) p.set("cfrom", cmp.from);
        if (cmp.to)   p.set("cto",   cmp.to);
      }
    }
    setLocation(`/finance?${p.toString()}`);
  }, [setLocation]);

  const setState       = useCallback((next: PeriodState)    => buildUrl(next, compareState), [buildUrl, compareState]);
  const setCompareState= useCallback((next: CompareState)   => buildUrl(state, next),        [buildUrl, state]);

  return [state, setState, compareState, setCompareState];
}

// ── Compute compare window from current period ─────────────────────────────────
// Returns ISO strings for the immediately preceding equivalent window.
// Uses whole-day arithmetic to avoid millisecond boundary skew.
function computeCompareWindow(period: PeriodKey, fromStr: string, toStr: string): { from: string; to: string } {
  const MS_PER_DAY = 86_400_000;
  const now = new Date();

  if (period === "custom" && fromStr && toStr) {
    // fromStr / toStr are date-only strings ("YYYY-MM-DD")
    const fDay = new Date(fromStr + "T00:00:00Z");
    const tDay = new Date(toStr   + "T00:00:00Z");
    // Number of calendar days in the selected range (inclusive)
    const days = Math.round((tDay.getTime() - fDay.getTime()) / MS_PER_DAY) + 1;
    const cFrom = new Date(fDay.getTime() - days * MS_PER_DAY);
    const cTo   = new Date(tDay.getTime() - days * MS_PER_DAY);
    // cTo is start-of-day; extend to end-of-day
    const cToEnd = new Date(cTo.getTime() + MS_PER_DAY - 1);
    return { from: cFrom.toISOString(), to: cToEnd.toISOString() };
  }
  if (period === "day") {
    // Previous day: 00:00–23:59:59.999 UTC yesterday
    const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);
    const prevStart  = new Date(todayStart.getTime() - MS_PER_DAY);
    const prevEnd    = new Date(todayStart.getTime() - 1);
    return { from: prevStart.toISOString(), to: prevEnd.toISOString() };
  }
  if (period === "week") {
    // Previous 7-day block
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const prevStart = new Date(weekStart.getTime() - 7 * MS_PER_DAY);
    const prevEnd   = new Date(weekStart.getTime() - 1);
    return { from: prevStart.toISOString(), to: prevEnd.toISOString() };
  }
  // month (default): previous 30-day block
  const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30);
  const prevStart  = new Date(monthStart.getTime() - 30 * MS_PER_DAY);
  const prevEnd    = new Date(monthStart.getTime() - 1);
  return { from: prevStart.toISOString(), to: prevEnd.toISOString() };
}

function PeriodFilter({
  state, onChange,
  compare, onCompareChange,
}: {
  state: PeriodState; onChange: (s: PeriodState) => void;
  compare: CompareState; onCompareChange: (c: CompareState) => void;
}) {
  const presets: { key: PeriodKey; label: string }[] = [
    { key: "day",   label: "День"   },
    { key: "week",  label: "Неделя" },
    { key: "month", label: "Месяц"  },
    { key: "custom",label: "Период" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <Button
          key={p.key}
          variant={state.period === p.key ? "default" : "outline"}
          size="sm"
          onClick={() => onChange({ period: p.key, from: state.from, to: state.to })}
        >
          {p.label}
        </Button>
      ))}
      {state.period === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={state.from}
            onChange={e => onChange({ ...state, from: e.target.value })}
          />
          <span className="text-muted-foreground text-xs">—</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={state.to}
            onChange={e => onChange({ ...state, to: e.target.value })}
          />
        </div>
      )}

      {/* ── Compare toggle ── */}
      <div className="flex items-center gap-1.5 ml-1 border-l pl-3">
        {!compare.enabled ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => onCompareChange({ ...compare, enabled: true })}
          >
            <GitCompare className="h-3.5 w-3.5" /> Сравнить
          </Button>
        ) : (
          <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950 rounded-md px-2.5 py-1">
            <GitCompare className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />
            <select
              className="text-xs bg-transparent border-none outline-none text-violet-700 dark:text-violet-300 font-medium cursor-pointer"
              value={compare.mode}
              onChange={e => onCompareChange({ ...compare, mode: e.target.value as CompareMode })}
            >
              <option value="prev_similar">Предыдущий период</option>
              <option value="custom">Произвольный период</option>
            </select>
            {compare.mode === "custom" && (
              <>
                <Input
                  type="date"
                  className="h-7 w-32 text-xs"
                  value={compare.from}
                  onChange={e => onCompareChange({ ...compare, from: e.target.value })}
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="date"
                  className="h-7 w-32 text-xs"
                  value={compare.to}
                  onChange={e => onCompareChange({ ...compare, to: e.target.value })}
                />
              </>
            )}
            <button
              className="ml-1 text-violet-500 hover:text-violet-700"
              onClick={() => onCompareChange({ enabled: false, mode: "prev_similar", from: "", to: "" })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function FinanceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Finance() {
  const { toast } = useToast();
  const [periodState, setPeriodState, compareState, setCompareState] = usePeriod();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ period: periodState.period });
      if (periodState.period === "custom") {
        if (periodState.from) p.set("from", new Date(periodState.from).toISOString());
        if (periodState.to)   p.set("to",   new Date(periodState.to + "T23:59:59").toISOString());
      }
      // Compare window
      if (compareState.enabled) {
        let cWin: { from: string; to: string };
        if (compareState.mode === "custom" && compareState.from && compareState.to) {
          cWin = {
            from: new Date(compareState.from).toISOString(),
            to:   new Date(compareState.to + "T23:59:59").toISOString(),
          };
        } else {
          cWin = computeCompareWindow(periodState.period, periodState.from, periodState.to);
        }
        p.set("compare_from", cWin.from);
        p.set("compare_to",   cWin.to);
      }
      const r = await fetch(`${apiBase()}/api/admin/finance?${p}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (err) {
      toast({ title: "Ошибка загрузки данных", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [periodState, compareState]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const dailyChart = useMemo(() => {
    if (!data?.daily) return [];
    const cmpDaily = data.compare?.daily ?? [];
    return data.daily.map((d, i) => {
      const cmp = cmpDaily[i];
      return {
        day:        format(parseISO(d.day), "d MMM", { locale: ru }),
        Оборот:     d.revenue,
        Прибыль:    Math.max(0, d.revenue - Math.round(d.revenue * (1 - (data.summary.margin_pct / 100)))),
        Сессии:     d.sessions,
        Сравнение:  cmp ? cmp.revenue : undefined,
      };
    });
  }, [data]);

  const connectorPieData = useMemo(() =>
    (data?.connector_split ?? []).map(c => ({
      name:  c.connector_type,
      value: c.sessions,
    })),
  [data]);

  const topModelsPieData = useMemo(() =>
    (data?.vehicle_stats?.top_models ?? []).slice(0, 6).map(m => ({
      name:  `${m.make} ${m.model}`,
      value: m.count,
    })),
  [data]);

  // ── CSV exports ────────────────────────────────────────────────────────────
  function exportFinancial() {
    if (!data) return;
    exportCSV("finance_stations.csv", data.top_stations.map(s => ({
      Станция: s.name, Оборот_сум: s.revenue, Сессии: s.sessions, "кВт·ч": s.kwh,
    })));
  }
  function exportConsumption() {
    if (!data) return;
    exportCSV("finance_hourly.csv", data.hourly_distribution.map(h => ({
      Час: `${h.hour}:00`, Сессии: h.sessions, "кВт·ч": h.kwh,
    })));
  }
  function exportUsers() {
    if (!data) return;
    exportCSV("finance_users.csv", data.user_stats.top_users.map(u => ({
      Пользователь: u.user_id, Сессии: u.sessions, "кВт·ч": u.kwh, Потрачено_сум: u.spent,
    })));
  }
  function exportVehicles() {
    if (!data) return;
    exportCSV("finance_vehicles.csv", data.vehicle_stats.top_models.map(m => ({
      Марка: m.make, Модель: m.model, Добавлено: m.count,
    })));
  }
  function exportStations() {
    if (!data) return;
    exportCSV("finance_low_traffic.csv", data.low_traffic_stations.map(s => ({
      Станция: s.name, Сессий_за_период: s.session_count,
    })));
  }

  function exportAllXlsx() {
    if (!data) return;
    const periodLabel = data.period === "custom"
      ? `${data.from.slice(0, 10)}_${data.to.slice(0, 10)}`
      : data.period;

    exportXlsx(`finance_report_${periodLabel}.xlsx`, [
      {
        name: "Финансы",
        rows: [
          // Summary block
          { Показатель: "Оборот (сум)",                Значение: data.summary.total_revenue },
          { Показатель: "Себестоимость оценка (сум)",  Значение: data.summary.estimated_cost },
          { Показатель: "Валовая прибыль оценка (сум)",Значение: data.summary.estimated_profit },
          { Показатель: "Маржа (%)",                   Значение: data.summary.margin_pct },
          { Показатель: "Сессий",                      Значение: data.summary.session_count },
          { Показатель: "кВт·ч",                       Значение: data.summary.total_kwh },
          { Показатель: "Средний чек (сум)",           Значение: data.summary.avg_check },
          { Показатель: "Уникальных пользователей",    Значение: data.summary.unique_users },
        ],
        numericKeys: ["Значение"],
      },
      {
        name: "Станции",
        rows: data.top_stations.map((s, i) => ({
          "№":        i + 1,
          Станция:    s.name,
          "Оборот (сум)": s.revenue,
          Сессии:     s.sessions,
          "кВт·ч":    s.kwh,
        })),
        numericKeys: ["№", "Оборот (сум)", "Сессии", "кВт·ч"],
      },
      {
        name: "Потребление",
        rows: data.hourly_distribution.map(h => ({
          Час:      `${h.hour}:00`,
          Сессии:   h.sessions,
          "кВт·ч":  h.kwh,
        })),
        numericKeys: ["Сессии", "кВт·ч"],
      },
      {
        name: "Пользователи",
        rows: data.user_stats.top_users.map((u, i) => ({
          "№":           i + 1,
          "ID пользователя": u.user_id,
          Сессии:        u.sessions,
          "кВт·ч":       u.kwh,
          "Потрачено (сум)": u.spent,
        })),
        numericKeys: ["№", "Сессии", "кВт·ч", "Потрачено (сум)"],
      },
      {
        name: "Автомобили",
        rows: data.vehicle_stats.top_models.map((m, i) => ({
          "№":    i + 1,
          Марка:  m.make,
          Модель: m.model,
          Кол_во: m.count,
        })),
        numericKeys: ["№", "Кол_во"],
      },
    ]);
  }

  const s  = data?.summary;
  const cs = data?.compare?.summary ?? null;   // compare summary shorthand

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F7F8FA] dark:bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white dark:bg-card flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Финансы и аналитика</h1>
          <p className="text-sm text-muted-foreground">
            {data ? (
              <>
                {format(parseISO(data.from), "d MMM yyyy", { locale: ru })}
                {" — "}
                {format(parseISO(data.to), "d MMM yyyy", { locale: ru })}
                <span className="ml-2 text-xs">·</span>
                <span className="ml-2 text-xs">{data.summary.session_count.toLocaleString("ru-RU")} сессий</span>
              </>
            ) : "Загрузка…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilter
            state={periodState} onChange={setPeriodState}
            compare={compareState} onCompareChange={setCompareState}
          />
          {data && (
            <Button
              variant="outline" size="sm"
              className="h-9 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
              onClick={exportAllXlsx}
            >
              <Download className="h-3.5 w-3.5" /> XLSX
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 py-5">
        {loading && !data ? (
          <FinanceSkeleton />
        ) : !data ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <p>Нет данных</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-7xl mx-auto pb-8">

            {/* ── Compare banner ── */}
            {data.compare && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-950 rounded-xl text-sm text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900">
                <GitCompare className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">Сравнение:</span>
                <span>
                  {format(parseISO(data.compare.from), "d MMM yyyy", { locale: ru })}
                  {" — "}
                  {format(parseISO(data.compare.to), "d MMM yyyy", { locale: ru })}
                </span>
                <span className="text-violet-400 mx-1">·</span>
                <span>{data.compare.summary.session_count.toLocaleString("ru-RU")} сессий</span>
              </div>
            )}

            {/* ── Финансы ── */}
            <Section title="Финансы" icon={Banknote} onExport={exportFinancial}>
              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard
                  icon={Banknote} demo
                  label="Оборот"
                  value={formatUzs(s!.total_revenue)}
                  sub={`${s!.session_count.toLocaleString("ru-RU")} сессий`}
                  delta={cs ? calcDelta(s!.total_revenue, cs.total_revenue) : undefined}
                />
                <KpiCard
                  icon={TrendingDown} demo
                  label="Себестоимость (оценка)"
                  value={formatUzs(s!.estimated_cost)}
                  sub="По закупочной цене станций"
                  iconBg="bg-amber-50 text-amber-700"
                  delta={cs ? calcDelta(s!.estimated_cost, cs.estimated_cost) : undefined}
                />
                <KpiCard
                  icon={TrendingUp} demo
                  label="Валовая прибыль (оценка)"
                  value={formatUzs(s!.estimated_profit)}
                  sub={`Маржа ${s!.margin_pct}%`}
                  warn={s!.estimated_profit < 0}
                  iconBg="bg-emerald-50 text-emerald-700"
                  delta={cs ? calcDelta(s!.estimated_profit, cs.estimated_profit) : undefined}
                />
                <KpiCard
                  icon={Activity} demo
                  label="Средний чек"
                  value={formatUzs(s!.avg_check)}
                  sub={`${s!.unique_users.toLocaleString("ru-RU")} уникальных пользователей`}
                  iconBg="bg-violet-50 text-violet-700"
                  delta={cs ? calcDelta(s!.avg_check, cs.avg_check) : undefined}
                />
              </div>

              {/* Line chart: daily revenue + comparison */}
              {dailyChart.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Оборот по дням</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false}
                          tickFormatter={v => formatUzsRaw(v)} width={80} />
                        <RCTooltip
                          contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                          formatter={(v: number, name: string) => [formatUzs(v), name]}
                        />
                        <Legend iconType="circle" iconSize={8} />
                        <Line type="monotone" dataKey="Оборот"     stroke="#2563EB" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Прибыль"    stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                        {data.compare && (
                          <Line type="monotone" dataKey="Сравнение" stroke="#7C3AED" strokeWidth={2} dot={false} strokeDasharray="6 3" connectNulls />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Operator breakdown */}
              {data.operator_breakdown.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Разбивка по операторам</p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          {["Оператор", "Оборот", "Сессии", "кВт·ч"].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.operator_breakdown.map((op, i) => (
                          <tr key={i} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium">{op.name}</td>
                            <td className="px-4 py-2.5">{formatUzs(op.revenue)}</td>
                            <td className="px-4 py-2.5">{op.sessions.toLocaleString("ru-RU")}</td>
                            <td className="px-4 py-2.5">{op.kwh.toLocaleString("ru-RU")} кВт·ч</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top-20 stations */}
              {data.top_stations.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Топ-20 станций по обороту</p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          {["#", "Станция", "Оборот", "Сессии", "кВт·ч"].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_stations.map((s, i) => (
                          <tr key={i} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium max-w-xs truncate">{s.name}</td>
                            <td className="px-4 py-2.5">{formatUzs(s.revenue)}</td>
                            <td className="px-4 py-2.5">{s.sessions.toLocaleString("ru-RU")}</td>
                            <td className="px-4 py-2.5">{s.kwh.toLocaleString("ru-RU")} кВт·ч</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.top_stations.length === 0 && data.operator_breakdown.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <Info className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Нет завершённых сессий за период</p>
                </div>
              )}
            </Section>

            {/* ── Потребление ── */}
            <Section title="Потребление энергии" icon={Zap} onExport={exportConsumption}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard icon={Zap} label="Всего кВт·ч"
                  value={`${data.summary.total_kwh.toLocaleString("ru-RU")} кВт·ч`}
                  delta={cs ? calcDelta(data.summary.total_kwh, cs.total_kwh) : undefined} />
                <KpiCard icon={Banknote} label="Средний чек"
                  value={formatUzs(data.summary.avg_check)}
                  sub="за сессию" iconBg="bg-blue-50 text-blue-700"
                  delta={cs ? calcDelta(data.summary.avg_check, cs.avg_check) : undefined} />
                <KpiCard icon={Clock} label="Средняя длительность"
                  value={fmtDuration(data.summary.avg_duration_sec)}
                  iconBg="bg-violet-50 text-violet-700"
                  delta={cs ? calcDelta(data.summary.avg_duration_sec, cs.avg_duration_sec) : undefined} />
                <KpiCard icon={Activity} label="Среднее кВт·ч/сессия"
                  value={data.summary.session_count > 0
                    ? `${(data.summary.total_kwh / data.summary.session_count).toFixed(1)} кВт·ч`
                    : "—"}
                  iconBg="bg-emerald-50 text-emerald-700"
                  delta={cs && cs.session_count > 0
                    ? calcDelta(
                        data.summary.total_kwh / data.summary.session_count,
                        cs.total_kwh / cs.session_count
                      )
                    : undefined} />
              </div>

              {/* Hourly distribution */}
              <div>
                <p className="text-sm font-medium mb-3 text-muted-foreground">Распределение по часам суток (UTC)</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.hourly_distribution} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false}
                        tickFormatter={h => `${h}:00`} interval={3} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <RCTooltip
                        contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        labelFormatter={h => `${h}:00 – ${Number(h)+1}:00`}
                      />
                      <Bar dataKey="sessions" name="Сессии" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Connector split */}
              {data.connector_split.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground">Сессии по типу разъёма</p>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={connectorPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                            paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                            labelLine={false} fontSize={11}>
                            {connectorPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
                          </Pie>
                          <RCTooltip contentStyle={{ borderRadius: 8, border: "none" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground">Детали по разъёмам</p>
                    <div className="space-y-2">
                      {data.connector_split.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="font-medium">{c.connector_type}</span>
                          </div>
                          <div className="flex gap-4 text-muted-foreground text-xs">
                            <span>{c.sessions.toLocaleString("ru-RU")} сессий</span>
                            <span>{formatUzsRaw(c.revenue)} сум</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* ── Пользователи ── */}
            <Section title="Пользователи" icon={Users} onExport={exportUsers}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard icon={Users} label="Всего зарегистрировано"
                  value={data.user_stats.total_registered.toLocaleString("ru-RU")}
                  iconBg="bg-blue-50 text-blue-700" />
                <KpiCard icon={Activity} label="Активных за период"
                  value={data.user_stats.active_in_period.toLocaleString("ru-RU")}
                  iconBg="bg-emerald-50 text-emerald-700" />
                <KpiCard icon={TrendingUp} label="Новых за период"
                  value={data.user_stats.new_in_period.toLocaleString("ru-RU")}
                  iconBg="bg-violet-50 text-violet-700" />
                <KpiCard icon={RefreshCw} label="Retention (повторные)"
                  value={`${data.user_stats.retention_pct}%`}
                  sub="пользователей с ≥ 2 сессиями"
                  iconBg="bg-amber-50 text-amber-700" />
              </div>

              {data.user_stats.top_users.length > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Топ-10 пользователей по объёму зарядки</p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          {["#", "ID пользователя", "Сессий", "кВт·ч", "Потрачено"].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.user_stats.top_users.map((u, i) => (
                          <tr key={i} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2.5 font-mono text-xs truncate max-w-[140px]">{u.user_id}</td>
                            <td className="px-4 py-2.5">{u.sessions}</td>
                            <td className="px-4 py-2.5">{u.kwh.toFixed(1)} кВт·ч</td>
                            <td className="px-4 py-2.5">{formatUzs(u.spent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">Нет данных о пользователях за период</p>
                </div>
              )}
            </Section>

            {/* ── Автомобили ── */}
            <Section title="Автомобили" icon={Car} defaultOpen={false} onExport={exportVehicles}>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <KpiCard icon={Car} label="Всего автомобилей добавлено"
                  value={data.vehicle_stats.total_user_vehicles.toLocaleString("ru-RU")}
                  iconBg="bg-blue-50 text-blue-700" />
                <KpiCard icon={Zap} label="Уникальных моделей"
                  value={data.vehicle_stats.top_models.length.toLocaleString("ru-RU")}
                  iconBg="bg-violet-50 text-violet-700" />
                <KpiCard icon={Activity} label="Самый популярный разъём"
                  value={data.top_vehicles[0]?.connector_type ?? "—"}
                  sub={data.top_vehicles[0] ? `${data.top_vehicles[0].count.toLocaleString("ru-RU")} авт.` : ""}
                  iconBg="bg-emerald-50 text-emerald-700" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top models table */}
                {data.vehicle_stats.top_models.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground">Топ-10 моделей</p>
                    <div className="space-y-2">
                      {data.vehicle_stats.top_models.map((m, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium truncate">{m.make} {m.model}</span>
                              <span className="text-muted-foreground text-xs ml-2 flex-shrink-0">{m.count}</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${(m.count / (data.vehicle_stats.top_models[0]?.count || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connector type split for vehicles — always uses connector_type distribution */}
                {data.top_vehicles.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground">Разбивка по типу разъёма</p>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.top_vehicles.map(v => ({ name: v.connector_type, value: v.count }))}
                            cx="50%" cy="50%" outerRadius={65}
                            paddingAngle={3} dataKey="value"
                          >
                            {data.top_vehicles.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                            ))}
                          </Pie>
                          <RCTooltip contentStyle={{ borderRadius: 8, border: "none" }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Станции ── */}
            <Section title="Станции" icon={MapPin} defaultOpen={false} onExport={exportStations}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top by sessions */}
                {data.top_stations.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground">Топ-5 по числу сессий</p>
                    <div className="space-y-2">
                      {data.top_stations.slice(0, 5).map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium truncate">{s.name}</span>
                              <span className="text-muted-foreground text-xs ml-2 flex-shrink-0">
                                {s.sessions.toLocaleString("ru-RU")} сессий
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${(s.sessions / (data.top_stations[0]?.sessions || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">Нет данных о сессиях</p>
                  </div>
                )}

                {/* Low-traffic stations */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Низкий трафик (&lt; 3 сессий)
                    </p>
                    {data.low_traffic_stations.length > 0 && (
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setLocation("/promos?target_type=low_traffic")}
                      >
                        <Tag className="h-3 w-3" /> Создать акцию
                      </Button>
                    )}
                  </div>
                  {data.low_traffic_stations.length === 0 ? (
                    <div className="flex items-center gap-2 py-6 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 rounded-lg px-4">
                      <Activity className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm">Все станции активны</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {data.low_traffic_stations.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-md text-sm border ${
                          s.session_count === 0
                            ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                            : "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                        }`}>
                          <div className="flex items-center gap-2">
                            {s.session_count === 0
                              ? <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                              : <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />}
                            <span className="truncate max-w-[180px]">{s.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {s.session_count} сессий
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

          </div>
        )}
      </ScrollArea>
    </div>
  );
}
