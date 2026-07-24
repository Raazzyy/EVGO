import React, { useState, useEffect, useCallback } from "react";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Plus, Tag, Play, Pause, Square, Trash2, RefreshCw, ChevronRight,
  TrendingDown, TrendingUp, AlertTriangle, Info, Zap, Users, MapPin, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useGetOperators, useGetStations } from "@workspace/api-client-react";
import { formatUzs, formatUzsRaw } from "@/lib/formatUzs";

// ── API helpers ────────────────────────────────────────────────────────────────
function apiBase() {
  const base = (import.meta as any).env?.BASE_URL ?? "/admin";
  return base.replace(/\/$/, "").replace("/admin", "");
}
function authHeaders() {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Promo {
  id: number;
  title: string;
  discount_pct: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  target_type: string;
  target_ids: (number | string)[];
  traffic_threshold: number | null;
  traffic_days?: number | null;
  created_at: string;
}

interface PreviewStation {
  id: number;
  name: string;
  address: string;
  price_per_kwh: number;
  effective_price: number;
  margin_before: number | null;
  margin_after: number | null;
}

interface PreviewResult {
  count: number;
  discount_pct: number;
  stations: PreviewStation[];
}

type PromoStatus = "active" | "scheduled" | "ended" | "paused";

interface PromoForm {
  title: string;
  discount_pct: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  target_type: string;
  target_operator_ids: string[];
  target_station_ids: string[];
  connector_type: string;
  traffic_threshold: string;
  traffic_days: string;
}

// ── Status helpers ─────────────────────────────────────────────────────────────
function getPromoStatus(p: Promo): PromoStatus {
  const now = new Date();
  if (!p.is_active) return "paused";
  if (p.ends_at && isBefore(parseISO(p.ends_at), now)) return "ended";
  if (p.starts_at && isAfter(parseISO(p.starts_at), now)) return "scheduled";
  return "active";
}

const STATUS_CONFIG: Record<PromoStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  active:    { label: "Активна",        variant: "default",    className: "bg-emerald-500 hover:bg-emerald-500 text-white" },
  scheduled: { label: "Запланирована",  variant: "secondary",  className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" },
  ended:     { label: "Завершена",      variant: "outline",    className: "text-muted-foreground" },
  paused:    { label: "Приостановлена", variant: "secondary",  className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" },
};

const TARGET_TYPES = [
  { value: "all",            label: "Все станции",         icon: Zap,        desc: "Акция применяется ко всем станциям" },
  { value: "operator",       label: "По оператору",        icon: Users,      desc: "Выберите операторов" },
  { value: "station",        label: "Конкретные станции",  icon: MapPin,     desc: "Выберите отдельные станции" },
  { value: "connector_type", label: "По типу разъёма",     icon: Zap,        desc: "CCS2, CHAdeMO, Type2 и др." },
  { value: "low_traffic",    label: "Низкий трафик",       icon: TrendingDown, desc: "Станции с малым числом сессий" },
  { value: "high_traffic",   label: "Высокий трафик",      icon: TrendingUp,  desc: "Популярные станции" },
];

const CONNECTOR_TYPES = ["CCS2", "CHAdeMO", "Type2", "GB-T"];

// ── Margin calculator ─────────────────────────────────────────────────────────
function calcMargin(costPrice: number, retailPrice: number, discountPct: number) {
  const effective = retailPrice * (1 - discountPct / 100);
  const marginPct = costPrice > 0
    ? ((effective - costPrice) / effective) * 100
    : null;
  const belowCost = costPrice > 0 && effective < costPrice;
  return { effectivePrice: effective, marginPct, belowCost };
}

// ── Empty form ─────────────────────────────────────────────────────────────────
const EMPTY_FORM: PromoForm = {
  title: "", discount_pct: "10", starts_at: "", ends_at: "",
  is_active: true, target_type: "all",
  target_operator_ids: [], target_station_ids: [], connector_type: "CCS2",
  traffic_threshold: "10", traffic_days: "30",
};

// ── PromoStatusBadge ──────────────────────────────────────────────────────────
function PromoStatusBadge({ status }: { status: PromoStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

// ── TargetSummary (compact) ────────────────────────────────────────────────────
function TargetSummary({ promo, operators }: { promo: Promo; operators: any[] }) {
  switch (promo.target_type) {
    case "all": return <span className="text-muted-foreground text-xs">Все станции</span>;
    case "operator": {
      const names = promo.target_ids
        .map(id => operators.find(o => o.id === Number(id))?.name ?? `#${id}`)
        .slice(0, 2).join(", ");
      return <span className="text-xs">{names || "—"}{promo.target_ids.length > 2 ? ` +${promo.target_ids.length - 2}` : ""}</span>;
    }
    case "station":
      return <span className="text-xs">{promo.target_ids.length} станций</span>;
    case "connector_type":
      return <span className="text-xs">{String(promo.target_ids[0] ?? "?")}</span>;
    case "low_traffic":
      return <span className="text-xs">&lt; {promo.traffic_threshold} сессий</span>;
    case "high_traffic":
      return <span className="text-xs">&gt; {promo.traffic_threshold} сессий</span>;
    default:
      return <span className="text-muted-foreground text-xs">{promo.target_type}</span>;
  }
}

// ── MarginBar ─────────────────────────────────────────────────────────────────
function MarginBar({ before, after }: { before: number | null; after: number | null }) {
  if (before == null || after == null) return <span className="text-xs text-muted-foreground">н/д</span>;
  const below = after < 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{before.toFixed(1)}%</span>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      <span className={`text-xs font-medium ${below ? "text-red-600" : after < 5 ? "text-amber-600" : "text-emerald-600"}`}>
        {after.toFixed(1)}%
      </span>
      {below && <AlertTriangle className="h-3 w-3 text-red-500" />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Promos() {
  const { toast } = useToast();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | PromoStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: operatorsResp } = useGetOperators();
  const { data: stationsResp } = useGetStations();
  const operators = operatorsResp ?? [];
  const stations = stationsResp?.nearby ?? [];

  // ── Fetch promos ────────────────────────────────────────────────────────────
  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase()}/api/promos`, { headers: authHeaders() });
      if (r.ok) setPromos(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromos(); }, [fetchPromos]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredPromos = promos.filter(p => {
    if (filter === "all") return true;
    return getPromoStatus(p) === filter;
  });

  // ── Open modal ──────────────────────────────────────────────────────────────
  function openCreate() {
    setEditPromo(null);
    setForm(EMPTY_FORM);
    setPreview(null);
    setModalOpen(true);
  }

  function openEdit(p: Promo) {
    setEditPromo(p);
    const targetOperators = p.target_type === "operator" ? p.target_ids.map(String) : [];
    const targetStations  = p.target_type === "station"  ? p.target_ids.map(String) : [];
    setForm({
      title: p.title,
      discount_pct: String(p.discount_pct),
      starts_at: fromISO(p.starts_at),
      ends_at: fromISO(p.ends_at),
      is_active: p.is_active,
      target_type: p.target_type,
      target_operator_ids: targetOperators,
      target_station_ids: targetStations,
      connector_type: p.target_type === "connector_type" ? String(p.target_ids[0] ?? "CCS2") : "CCS2",
      traffic_threshold: p.traffic_threshold ? String(p.traffic_threshold) : "10",
      traffic_days: p.traffic_days ? String(p.traffic_days) : "30",
    });
    setPreview(null);
    setModalOpen(true);
  }

  // ── Datetime helpers ─────────────────────────────────────────────────────────
  /** ISO string → "YYYY-MM-DDTHH:mm" in user's LOCAL timezone (for datetime-local input display) */
  function fromISO(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** datetime-local "YYYY-MM-DDTHH:mm" (local time) → full ISO string, or null */
  function toISO(val: string): string | null {
    if (!val) return null;
    if (/Z|[+-]\d{2}:\d{2}$/.test(val)) return val; // already ISO, pass through
    const d = new Date(val); // browser interprets datetime-local as local time
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // ── Build save payload (no traffic_days — not persisted in DB) ───────────────
  function buildSavePayload() {
    let target_ids: (number | string)[] = [];
    if (form.target_type === "operator")            target_ids = form.target_operator_ids.map(Number);
    else if (form.target_type === "station")        target_ids = form.target_station_ids.map(Number);
    else if (form.target_type === "connector_type") target_ids = [form.connector_type];

    return {
      title:             form.title,
      discount_pct:      Number(form.discount_pct),
      starts_at:         toISO(form.starts_at),
      ends_at:           toISO(form.ends_at),
      is_active:         form.is_active,
      target_type:       form.target_type,
      target_ids,
      traffic_threshold: ["low_traffic", "high_traffic"].includes(form.target_type)
        ? Number(form.traffic_threshold) || null : null,
    };
  }

  // ── Build preview payload (includes traffic_days — preview-only) ─────────────
  function buildPreviewPayload() {
    return {
      ...buildSavePayload(),
      traffic_days: ["low_traffic", "high_traffic"].includes(form.target_type)
        ? Number(form.traffic_days) || 30 : undefined,
    };
  }

  // ── Preview ─────────────────────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const r = await fetch(`${apiBase()}/api/promos/preview`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(buildPreviewPayload()),
      });
      if (r.ok) setPreview(await r.json());
      else toast({ title: "Ошибка предпросмотра", variant: "destructive" });
    } catch {
      toast({ title: "Ошибка предпросмотра", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { toast({ title: "Введите название", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = buildSavePayload();
      const url   = editPromo ? `${apiBase()}/api/promos/${editPromo.id}` : `${apiBase()}/api/promos`;
      const method = editPromo ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await r.text());
      await fetchPromos();
      setModalOpen(false);
      toast({ title: editPromo ? "Промо обновлено" : "Промо создано" });
    } catch (err) {
      toast({ title: "Ошибка сохранения", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Status actions ───────────────────────────────────────────────────────────
  async function patchPromo(id: number, data: Record<string, unknown>) {
    const r = await fetch(`${apiBase()}/api/promos/${id}`, {
      method: "PATCH", headers: authHeaders(), body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    await fetchPromos();
  }

  async function handleActivate(p: Promo) {
    try { await patchPromo(p.id, { is_active: true }); toast({ title: "Промо активировано" }); }
    catch (err) { toast({ title: "Ошибка", description: String(err), variant: "destructive" }); }
  }
  async function handlePause(p: Promo) {
    try { await patchPromo(p.id, { is_active: false }); toast({ title: "Промо приостановлено" }); }
    catch (err) { toast({ title: "Ошибка", description: String(err), variant: "destructive" }); }
  }
  async function handleEnd(p: Promo) {
    try {
      await patchPromo(p.id, { ends_at: new Date().toISOString(), is_active: false });
      toast({ title: "Промо завершено" });
    } catch (err) { toast({ title: "Ошибка", description: String(err), variant: "destructive" }); }
  }
  async function handleDelete() {
    if (!deleteId) return;
    try {
      const r = await fetch(`${apiBase()}/api/promos/${deleteId}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!r.ok) throw new Error(await r.text());
      await fetchPromos();
      toast({ title: "Промо удалено" });
    } catch (err) {
      toast({ title: "Ошибка удаления", description: String(err), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  // ── Multi-select helpers ─────────────────────────────────────────────────────
  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  }

  const set = (k: keyof PromoForm, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // ── Render ───────────────────────────────────────────────────────────────────
  const statusCounts = {
    active:    promos.filter(p => getPromoStatus(p) === "active").length,
    scheduled: promos.filter(p => getPromoStatus(p) === "scheduled").length,
    ended:     promos.filter(p => getPromoStatus(p) === "ended").length,
    paused:    promos.filter(p => getPromoStatus(p) === "paused").length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Промо-акции</h1>
          <p className="text-sm text-muted-foreground">{promos.length} акций в системе</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchPromos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Новая акция
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-6 pt-3 flex-shrink-0">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Все ({promos.length})</TabsTrigger>
            <TabsTrigger value="active">Активные ({statusCounts.active})</TabsTrigger>
            <TabsTrigger value="scheduled">Запланированные ({statusCounts.scheduled})</TabsTrigger>
            <TabsTrigger value="paused">Приостановленные ({statusCounts.paused})</TabsTrigger>
            <TabsTrigger value="ended">Завершённые ({statusCounts.ended})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1 px-6 pb-6">
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Загрузка…
            </div>
          ) : filteredPromos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Tag className="h-10 w-10 opacity-20" />
              <p>Нет акций</p>
              <Button variant="outline" size="sm" onClick={openCreate}>Создать первую</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Статус</th>
                  <th className="text-left pb-2 font-medium">Название</th>
                  <th className="text-left pb-2 font-medium">Скидка</th>
                  <th className="text-left pb-2 font-medium">Период</th>
                  <th className="text-left pb-2 font-medium">Таргетинг</th>
                  <th className="text-right pb-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromos.map(p => {
                  const status = getPromoStatus(p);
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-3">
                        <PromoStatusBadge status={status} />
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          className="font-medium hover:underline text-left"
                          onClick={() => openEdit(p)}
                        >
                          {p.title}
                        </button>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          −{p.discount_pct}%
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground text-xs">
                        {p.starts_at
                          ? format(parseISO(p.starts_at), "d MMM yyyy", { locale: ru })
                          : "сейчас"}
                        {" — "}
                        {p.ends_at
                          ? format(parseISO(p.ends_at), "d MMM yyyy", { locale: ru })
                          : "бессрочно"}
                      </td>
                      <td className="py-3 pr-3">
                        <TargetSummary promo={p} operators={operators} />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {status === "paused" && (
                            <Button variant="ghost" size="icon" title="Активировать"
                              onClick={() => handleActivate(p)}>
                              <Play className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {status === "active" && (
                            <Button variant="ghost" size="icon" title="Приостановить"
                              onClick={() => handlePause(p)}>
                              <Pause className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          {(status === "active" || status === "scheduled") && (
                            <Button variant="ghost" size="icon" title="Завершить"
                              onClick={() => handleEnd(p)}>
                              <Square className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Удалить"
                            onClick={() => setDeleteId(p.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </ScrollArea>

      {/* Create / Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle>{editPromo ? "Редактировать акцию" : "Новая промо-акция"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex">
            {/* Left: form */}
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-5 pr-2">
                {/* Basic */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Название акции</Label>
                    <Input
                      placeholder="Летняя скидка 20%"
                      value={form.title}
                      onChange={e => set("title", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Скидка (%)</Label>
                      <Input
                        type="number" min="0" max="100" placeholder="10"
                        value={form.discount_pct}
                        onChange={e => { set("discount_pct", e.target.value); setPreview(null); }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Статус</Label>
                      <div className="flex items-center gap-2 h-9">
                        <input
                          type="checkbox" id="is_active" checked={form.is_active}
                          onChange={e => set("is_active", e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label htmlFor="is_active" className="text-sm">Активна</label>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Начало</Label>
                      <Input
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={e => set("starts_at", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Конец</Label>
                      <Input
                        type="datetime-local"
                        value={form.ends_at}
                        onChange={e => set("ends_at", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Targeting */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Таргетинг</Label>
                  <RadioGroup
                    value={form.target_type}
                    onValueChange={v => { set("target_type", v); setPreview(null); }}
                    className="space-y-2"
                  >
                    {TARGET_TYPES.map(tt => (
                      <label
                        key={tt.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          form.target_type === tt.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <RadioGroupItem value={tt.value} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <tt.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-sm">{tt.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{tt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>

                  {/* Targeting sub-form */}
                  {form.target_type === "operator" && (
                    <div className="space-y-2 pl-2">
                      <Label className="text-xs text-muted-foreground">Операторы</Label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                        {operators.map(op => (
                          <label key={op.id} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 text-sm">
                            <input
                              type="checkbox"
                              checked={form.target_operator_ids.includes(String(op.id))}
                              onChange={() => {
                                set("target_operator_ids", toggleId(form.target_operator_ids, String(op.id)));
                                setPreview(null);
                              }}
                            />
                            {op.name}
                          </label>
                        ))}
                        {operators.length === 0 && (
                          <p className="text-xs text-muted-foreground col-span-2">Операторы не найдены</p>
                        )}
                      </div>
                    </div>
                  )}

                  {form.target_type === "station" && (
                    <div className="space-y-2 pl-2">
                      <Label className="text-xs text-muted-foreground">
                        Станции ({form.target_station_ids.length} выбрано)
                      </Label>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {stations.map(s => (
                          <label key={s.id} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 text-sm">
                            <input
                              type="checkbox"
                              checked={form.target_station_ids.includes(String(s.id))}
                              onChange={() => {
                                set("target_station_ids", toggleId(form.target_station_ids, String(s.id)));
                                setPreview(null);
                              }}
                            />
                            <span className="truncate">{s.name}</span>
                            <span className="text-muted-foreground text-xs ml-auto flex-shrink-0">
                              {formatUzsRaw(s.price_per_kwh)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.target_type === "connector_type" && (
                    <div className="pl-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Тип разъёма</Label>
                      <Select value={form.connector_type} onValueChange={v => { set("connector_type", v); setPreview(null); }}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONNECTOR_TYPES.map(ct => (
                            <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(form.target_type === "low_traffic" || form.target_type === "high_traffic") && (
                    <div className="pl-2 grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          {form.target_type === "low_traffic" ? "Меньше N сессий" : "Больше N сессий"}
                        </Label>
                        <Input
                          type="number" min="1" placeholder="10"
                          value={form.traffic_threshold}
                          onChange={e => { set("traffic_threshold", e.target.value); setPreview(null); }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">За последние (дней)</Label>
                        <Input
                          type="number" min="1" placeholder="30"
                          value={form.traffic_days}
                          onChange={e => { set("traffic_days", e.target.value); setPreview(null); }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview trigger */}
                <Button
                  variant="outline" className="w-full" size="sm"
                  onClick={handlePreview} disabled={previewLoading}
                >
                  <Activity className={`h-4 w-4 mr-1.5 ${previewLoading ? "animate-spin" : ""}`} />
                  {previewLoading ? "Считаем…" : "Предпросмотр охвата"}
                </Button>
              </div>
            </ScrollArea>

            {/* Right: preview panel */}
            <div className="w-72 border-l flex flex-col flex-shrink-0">
              <div className="px-4 py-3 border-b flex-shrink-0">
                <p className="text-sm font-medium">Влияние акции</p>
                <p className="text-xs text-muted-foreground">
                  {preview
                    ? `Охват: ${preview.count} станций`
                    : "Нажмите «Предпросмотр охвата»"}
                </p>
              </div>

              <ScrollArea className="flex-1">
                {preview ? (
                  <div className="p-4 space-y-4">
                    {/* Summary card */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
                      <p className="text-3xl font-bold text-primary">{preview.count}</p>
                      <p className="text-xs text-muted-foreground">станций охвачено</p>
                      <p className="text-sm font-medium mt-1">скидка −{preview.discount_pct}%</p>
                    </div>

                    {/* Margin impact for stations with cost data */}
                    {preview.stations.some(s => s.margin_before != null) && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Изменение маржи</p>
                        {preview.stations
                          .filter(s => s.margin_before != null)
                          .slice(0, 8)
                          .map(s => (
                            <div key={s.id} className="space-y-0.5">
                              <p className="text-xs font-medium truncate">{s.name}</p>
                              <div className="flex items-center justify-between">
                                <MarginBar before={s.margin_before} after={s.margin_after} />
                                <span className="text-xs text-muted-foreground">
                                  {formatUzsRaw(s.effective_price)} сум
                                </span>
                              </div>
                            </div>
                          ))}
                        {preview.stations.filter(s => s.margin_before != null).length > 8 && (
                          <p className="text-xs text-muted-foreground">
                            +{preview.stations.filter(s => s.margin_before != null).length - 8} станций…
                          </p>
                        )}
                      </div>
                    )}

                    {/* Warning if any below cost */}
                    {preview.stations.some(s => s.margin_after != null && s.margin_after < 0) && (
                      <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-700 dark:text-red-300">Цена ниже себестоимости</p>
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {preview.stations.filter(s => s.margin_after != null && s.margin_after < 0).length} станций
                            будут продавать ниже закупочной цены
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Station list */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Станции</p>
                      {preview.stations.slice(0, 12).map(s => (
                        <div key={s.id} className="flex justify-between items-center py-1 text-xs border-b last:border-0">
                          <span className="truncate pr-2 max-w-[60%]">{s.name}</span>
                          <span className="text-muted-foreground flex-shrink-0">
                            {formatUzsRaw(s.price_per_kwh)} → {formatUzsRaw(s.effective_price)}
                          </span>
                        </div>
                      ))}
                      {preview.count > 12 && (
                        <p className="text-xs text-muted-foreground">+{preview.count - 12} станций</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                    <Info className="h-8 w-8 opacity-20" />
                    <p className="text-xs text-center px-4">
                      Настройте параметры и нажмите «Предпросмотр» для расчёта охвата и маржи
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение…" : editPromo ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить промо-акцию?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Акция будет удалена из системы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
