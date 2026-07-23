import React, { useState } from "react";
import {
  useGetOperators,
  useGetStations,
  useCreateOperator,
  useDeleteOperator,
  getGetOperatorsQueryKey,
  Operator,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Briefcase, Trash2, MapPin, User, Phone, Mail, Link2,
  Wifi, WifiOff, RefreshCw, Percent, AlertTriangle, CheckCircle2,
  ChevronRight, Loader2, Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatUzs } from "@/lib/formatUzs";
import { setBaseUrl } from "@workspace/api-client-react";

// Extended operator type (full detail returned by GET /operators/:id)
interface OperatorDetail extends Operator {
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  contract_notes?: string | null;
  api_type?: string;
  api_endpoint?: string | null;
  default_margin_pct?: number | null;
}

type PingResult = { ok: boolean; latency_ms?: number; message?: string } | null;

// ─── helpers ────────────────────────────────────────────────────────────────
function apiBase() {
  const base = (import.meta as any).env?.BASE_URL ?? "/admin";
  return base.replace(/\/$/, "").replace("/admin", "");
}

async function patchOperator(id: number, data: Record<string, unknown>) {
  const token = localStorage.getItem("admin_token");
  const r = await fetch(`${apiBase()}/api/operators/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function pingOperator(id: number) {
  const token = localStorage.getItem("admin_token");
  const r = await fetch(`${apiBase()}/api/operators/${id}/ping`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function bulkUpdateStationMargin(
  stations: Array<{ id: number; cost_price_per_kwh?: number | null; price_per_kwh: number }>,
  marginPct: number,
  token: string | null,
) {
  // Use PATCH (partial) to set price derived from cost + margin when cost is known
  const results = await Promise.allSettled(
    stations.map((s) => {
      const patch: Record<string, unknown> = {};
      if (s.cost_price_per_kwh) {
        patch.price_per_kwh = Math.round(s.cost_price_per_kwh * (1 + marginPct / 100));
      }
      // Always record the intent — even if we can't recompute price without cost basis
      return fetch(`${apiBase()}/api/stations/${s.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(patch),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Station ${s.id}: ${r.status} ${await r.text().catch(() => "")}`);
      });
    })
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) console.warn("Bulk margin errors:", failed);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProfileTab({ op, onSave }: { op: OperatorDetail; onSave: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: op.name ?? "",
    logo_url: op.logo_url ?? "",
    contact_person: op.contact_person ?? "",
    phone: op.phone ?? "",
    email: op.email ?? "",
    contract_notes: op.contract_notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await patchOperator(op.id, {
        name: form.name,
        logo_url: form.logo_url || null,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        email: form.email || null,
        contract_notes: form.contract_notes || null,
      });
      toast({ title: "Профиль сохранён" });
      onSave();
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label>Название оператора</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>URL логотипа</Label>
          <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
          {form.logo_url && (
            <img src={form.logo_url} alt="logo" className="h-10 object-contain rounded border mt-1" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Контактное лицо</Label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="ФИО" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Телефон</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 …" />
          </div>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@operator.uz" />
          </div>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Заметки по договору</Label>
          <Textarea rows={3} value={form.contract_notes} onChange={(e) => setForm({ ...form, contract_notes: e.target.value })} placeholder="Условия, реквизиты…" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Сохранить профиль
        </Button>
      </div>
    </div>
  );
}

function StationsTab({ op, onEditStation }: { op: OperatorDetail; onEditStation: (id: number) => void }) {
  const { data: stationsData } = useGetStations();
  const stations = [...(stationsData?.promoted ?? []), ...(stationsData?.nearby ?? [])].filter(
    (s) => s.operator_id === op.id
  );

  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <MapPin className="h-10 w-10 opacity-30" />
        <p className="text-sm">У оператора пока нет станций</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    free: "bg-emerald-100 text-emerald-700",
    occupied: "bg-amber-100 text-amber-700",
    offline: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="space-y-2">
      {stations.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-muted/40 cursor-pointer transition-colors"
          onClick={() => onEditStation(s.id)}
        >
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{s.name}</div>
            <div className="text-xs text-muted-foreground truncate">{s.address}</div>
          </div>
          <Badge className={`${statusColors[s.status] ?? ""} border-0 shadow-none text-xs`}>
            {s.status === "free" ? "Свободна" : s.status === "occupied" ? "Занята" : "Офлайн"}
          </Badge>
          <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">{formatUzs(s.price_per_kwh)}/кВт·ч</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      ))}
    </div>
  );
}

function IntegrationTab({ op, onSave }: { op: OperatorDetail; onSave: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    api_type: op.api_type ?? "none",
    api_endpoint: op.api_endpoint ?? "",
    api_credentials: "",
  });
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [ping, setPing] = useState<PingResult>(null);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        api_type: form.api_type,
        api_endpoint: form.api_endpoint || null,
      };
      if (form.api_credentials) payload.api_credentials = form.api_credentials;
      await patchOperator(op.id, payload);
      toast({ title: "Интеграция сохранена" });
      onSave();
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doPing = async () => {
    setPinging(true);
    setPing(null);
    try {
      const result = await pingOperator(op.id);
      setPing(result);
    } catch {
      setPing({ ok: false, message: "Нет ответа от сервера" });
    } finally {
      setPinging(false);
    }
  };

  const apiTypeLabels: Record<string, string> = {
    none: "Не подключено",
    ocpi: "OCPI 2.2",
    ocpp: "OCPP 1.6 / 2.0",
    custom: "Кастомный API",
    manual: "Ручной режим",
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Тип интеграции</Label>
        <Select value={form.api_type} onValueChange={(v) => setForm({ ...form, api_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(apiTypeLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.api_type !== "none" && form.api_type !== "manual" && (
        <>
          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 font-mono text-sm" value={form.api_endpoint} onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })} placeholder="https://api.operator.uz/ocpi/…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>API-ключ / токен <span className="text-muted-foreground text-xs">(оставьте пустым чтобы не менять)</span></Label>
            <Input type="password" value={form.api_credentials} onChange={(e) => setForm({ ...form, api_credentials: e.target.value })} placeholder="••••••••" />
          </div>
        </>
      )}

      {ping && (
        <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${ping.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {ping.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
          <span>{ping.ok ? `Соединение установлено · ${ping.latency_ms} мс` : ping.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={doPing} disabled={pinging}>
          {pinging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wifi className="h-4 w-4 mr-2" />}
          Проверить соединение
        </Button>
        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function PricingTab({ op, onSave }: { op: OperatorDetail; onSave: () => void }) {
  const { toast } = useToast();
  const { data: stationsData } = useGetStations();
  const opStations = [...(stationsData?.promoted ?? []), ...(stationsData?.nearby ?? [])].filter(
    (s) => s.operator_id === op.id
  );
  const [margin, setMargin] = useState(String(op.default_margin_pct ?? ""));
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const save = async (reprice: boolean) => {
    setSaving(true);
    setShowConfirm(false);
    try {
      await patchOperator(op.id, { default_margin_pct: margin ? Number(margin) : null });
      if (reprice && margin) {
        const token = localStorage.getItem("admin_token");
        await bulkUpdateStationMargin(
          opStations.map((s) => ({
            id: s.id,
            price_per_kwh: s.price_per_kwh,
            cost_price_per_kwh: (s as any).cost_price_per_kwh ?? null,
          })),
          Number(margin),
          token,
        );
      }
      toast({ title: "Ценообразование сохранено" });
      onSave();
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const marginNum = parseFloat(margin) || 0;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
        <p className="text-sm font-medium text-foreground">Маржа оператора</p>
        <p className="text-xs text-muted-foreground">
          Применяется как наценка к закупочной цене при создании новых станций.
          Пересчёт существующих — опционально.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Маржа по умолчанию (%)</Label>
        <div className="relative">
          <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 w-48"
            type="number"
            min={0}
            max={200}
            step={0.5}
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="20"
          />
        </div>
        {marginNum > 0 && (
          <p className="text-xs text-muted-foreground">
            Пример: закупка 1 000 сум → розница {formatUzs(Math.round(1000 * (1 + marginNum / 100)))} (+{marginNum}%)
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">Текущие цены станций ({opStations.length})</p>
        {opStations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет станций у этого оператора</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
            {opStations.map((s) => (
              <div key={s.id} className="text-xs flex justify-between rounded bg-muted/50 px-2 py-1.5">
                <span className="truncate text-muted-foreground">{s.name}</span>
                <span className="font-medium ml-2 whitespace-nowrap">{formatUzs(s.price_per_kwh)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => save(false)}
          disabled={saving}
        >
          Сохранить без пересчёта
        </Button>
        <Button
          onClick={() => opStations.length > 0 ? setShowConfirm(true) : save(false)}
          disabled={saving}
          className="bg-primary hover:bg-primary/90"
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Сохранить
        </Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Пересчитать цены?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Применить маржу {margin}% ко всем <strong>{opStations.length}</strong> станциям оператора?
            Текущие розничные цены будут пересчитаны.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => save(false)}>Только маржу</Button>
            <Button onClick={() => save(true)} className="bg-primary hover:bg-primary/90">
              Да, пересчитать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Operators() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: operators, isLoading } = useGetOperators();
  const createMutation = useCreateOperator();
  const deleteMutation = useDeleteOperator();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  // Detail: fetched lazily on selection
  const [detail, setDetail] = useState<OperatorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", logo_url: "" });

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const r = await fetch(`${apiBase()}/api/operators/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await r.json();
      setDetail(data);
    } catch {
      toast({ title: "Ошибка загрузки оператора", variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  const selectOperator = (id: number) => {
    setSelectedId(id);
    setActiveTab("profile");
    loadDetail(id);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Удалить оператора? Его станции станут независимыми.")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOperatorsQueryKey() });
          if (selectedId === id) { setSelectedId(null); setDetail(null); }
          toast({ title: "Оператор удалён" });
        },
      }
    );
  };

  const handleCreate = () => {
    if (!createForm.name.trim()) return;
    createMutation.mutate(
      { data: { name: createForm.name, logo_url: createForm.logo_url || null } },
      {
        onSuccess: (op) => {
          queryClient.invalidateQueries({ queryKey: getGetOperatorsQueryKey() });
          setIsCreateOpen(false);
          setCreateForm({ name: "", logo_url: "" });
          selectOperator(op.id);
          toast({ title: "Оператор создан" });
        },
      }
    );
  };

  const selectedOp = operators?.find((o) => o.id === selectedId);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Операторы сети</h1>
          <p className="text-muted-foreground text-sm mt-1">Партнёрские сети и бренды зарядных станций</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Добавить оператора
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 px-8 pb-8 overflow-hidden flex gap-5">
        {/* Left: operator list */}
        <div className="w-72 shrink-0 flex flex-col gap-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Загрузка…</div>
          ) : !operators?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Building2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Нет операторов</p>
            </div>
          ) : (
            operators.map((op) => (
              <button
                key={op.id}
                onClick={() => selectOperator(op.id)}
                className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${
                  selectedId === op.id
                    ? "bg-white shadow-sm border-primary/30 ring-1 ring-primary/20"
                    : "bg-white/60 hover:bg-white hover:shadow-sm border-transparent"
                }`}
              >
                {op.logo_url ? (
                  <img src={op.logo_url} alt={op.name} className="w-9 h-9 rounded-md object-contain bg-white border shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <Briefcase className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{op.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {op.station_count ?? 0} станций
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleDelete(op.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </button>
            ))
          )}
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-hidden">
          {!selectedId ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Briefcase className="h-14 w-14 opacity-20" />
              <p className="text-sm">Выберите оператора из списка слева</p>
            </div>
          ) : detailLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <Card className="h-full border-none shadow-sm bg-white dark:bg-card flex flex-col overflow-hidden">
              {/* Panel header */}
              <div className="px-6 pt-5 pb-0 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  {detail.logo_url ? (
                    <img src={detail.logo_url} alt={detail.name} className="w-12 h-12 rounded-xl object-contain bg-white border" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Briefcase className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <h2 className="font-bold text-lg">{detail.name}</h2>
                    <p className="text-xs text-muted-foreground">{detail.station_count ?? 0} станций</p>
                  </div>
                  <div className="ml-auto">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(detail.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full justify-start bg-transparent border-b rounded-none p-0 h-auto mb-0 gap-0">
                    {[
                      { value: "profile", label: "Профиль" },
                      { value: "stations", label: "Станции" },
                      { value: "integration", label: "Интеграция" },
                      { value: "pricing", label: "Ценообразование" },
                    ].map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.value
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto px-6 py-5">
                {activeTab === "profile" && <ProfileTab op={detail} onSave={() => { queryClient.invalidateQueries({ queryKey: getGetOperatorsQueryKey() }); loadDetail(detail.id); }} />}
                {activeTab === "stations" && <StationsTab op={detail} onEditStation={(id) => {}} />}
                {activeTab === "integration" && <IntegrationTab op={detail} onSave={() => loadDetail(detail.id)} />}
                {activeTab === "pricing" && <PricingTab op={detail} onSave={() => { queryClient.invalidateQueries({ queryKey: getGetOperatorsQueryKey() }); loadDetail(detail.id); }} />}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Новый оператор</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Например: UzEV" />
            </div>
            <div className="space-y-1.5">
              <Label>URL логотипа (опционально)</Label>
              <Input value={createForm.logo_url} onChange={(e) => setCreateForm({ ...createForm, logo_url: e.target.value })} placeholder="https://…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Отмена</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-primary hover:bg-primary/90">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
