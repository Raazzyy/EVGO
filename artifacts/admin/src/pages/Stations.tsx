import React, { useState, useMemo, useCallback } from "react";
import {
  useGetStations,
  useGetOperators,
  useCreateStation,
  useDeleteStation,
  useUpdateStationStatus,
  getGetStationsQueryKey,
  Station,
  StationStatusUpdateStatus,
} from "@workspace/api-client-react";

// PATCH helper — uses the extended station endpoint that accepts all fields
function apiBase() {
  const base = (import.meta as any).env?.BASE_URL ?? "/admin";
  return base.replace(/\/$/, "").replace("/admin", "");
}

async function patchStation(id: number, data: Record<string, unknown>): Promise<void> {
  const token = localStorage.getItem("admin_token");
  const r = await fetch(`${apiBase()}/api/stations/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(msg);
  }
}
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Search, MoreHorizontal, MapPin, Zap, Trash2, Edit2,
  AlertTriangle, Loader2, Image, X, Star, ChevronDown, GripVertical,
  CheckSquare, Percent, Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatUzs } from "@/lib/formatUzs";

// ─── Types ────────────────────────────────────────────────────────────────────
// ExtStation omits the strict Connector[] type so we can overlay looser fields
type ExtStation = Omit<Station, "connectors"> & {
  connectors?: { type: string; power_kw: number; total: number; available: number }[];
  photos?: string[];
  amenities?: string[];
  district?: string;
  region?: string;
  cost_per_kwh?: number;
  margin_pct?: number;
  is_promoted?: boolean;
  discount_pct?: number;
};

const AMENITY_OPTIONS = [
  "wifi", "parking", "cafe", "toilet", "shop", "security",
  "covered", "accessible", "cctv", "playground",
];
const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi", parking: "Парковка", cafe: "Кафе", toilet: "Туалет",
  shop: "Магазин", security: "Охрана", covered: "Навес", accessible: "Доступность",
  cctv: "Видеонаблюдение", playground: "Детская площадка",
};
const CONNECTOR_TYPES = ["CCS2", "CHAdeMO", "Type2", "GB-T"];
const STATUS_LABELS: Record<string, string> = { free: "Свободна", occupied: "Занята", offline: "Офлайн" };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusBadgeClass: Record<string, string> = {
  free: "bg-emerald-100 text-emerald-800",
  occupied: "bg-amber-100 text-amber-800",
  offline: "bg-rose-100 text-rose-800",
};

function getStatusBadge(status: string) {
  return (
    <Badge className={`${statusBadgeClass[status] ?? "bg-muted text-muted-foreground"} hover:opacity-90 border-0 shadow-none`}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ─── Section headers ─────────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 mt-1">
      {children}
    </div>
  );
}

// ─── StationEditDrawer ────────────────────────────────────────────────────────
interface DrawerForm {
  name: string;
  address: string;
  lat: string;
  lng: string;
  district: string;
  region: string;
  power_kw: string;
  cost_price_per_kwh: string;   // matches DB column name
  margin_pct: string;
  price_per_kwh: string;
  status: string;
  operator_id: string;          // "none" sentinel = independent
  amenities: string[];
  photos: string[];
  primary_photo_idx: number;
  connectors: { type: string; power_kw: string; total: string; available: string }[];
  is_promoted: boolean;
  discount_pct: string;
}

const EMPTY_FORM: DrawerForm = {
  name: "", address: "", lat: "0", lng: "0", district: "", region: "",
  power_kw: "50", cost_price_per_kwh: "", margin_pct: "", price_per_kwh: "2000",
  status: "free", operator_id: "none",
  amenities: [], photos: [], primary_photo_idx: 0,
  connectors: [{ type: "CCS2", power_kw: "50", total: "2", available: "2" }],
  is_promoted: false, discount_pct: "",
};

function stationToForm(s: ExtStation): DrawerForm {
  return {
    name: s.name,
    address: s.address,
    lat: String(s.lat),
    lng: String(s.lng),
    district: s.district ?? "",
    region: s.region ?? "",
    power_kw: String(s.power_kw),
    cost_price_per_kwh: (s as any).cost_price_per_kwh ? String((s as any).cost_price_per_kwh) : "",
    margin_pct: s.margin_pct ? String(s.margin_pct) : "",
    price_per_kwh: String(s.price_per_kwh),
    status: s.status,
    operator_id: s.operator_id ? String(s.operator_id) : "none",
    amenities: s.amenities ?? [],
    photos: s.photos ?? [],
    primary_photo_idx: 0,
    connectors: s.connectors?.length
      ? s.connectors.map((c) => ({
          type: c.type, power_kw: String(c.power_kw), total: String(c.total), available: String(c.available),
        }))
      : [{ type: "CCS2", power_kw: String(s.power_kw), total: "2", available: "2" }],
    is_promoted: s.is_promoted ?? false,
    discount_pct: s.discount_pct ? String(s.discount_pct) : "",
  };
}

function formToPayload(f: DrawerForm): Record<string, unknown> {
  return {
    name: f.name,
    address: f.address,
    lat: Number(f.lat),
    lng: Number(f.lng),
    power_kw: Number(f.power_kw),
    price_per_kwh: Number(f.price_per_kwh),
    cost_price_per_kwh: f.cost_price_per_kwh ? Number(f.cost_price_per_kwh) : null,
    status: f.status,
    // "none" sentinel maps to null (independent station)
    operator_id: f.operator_id && f.operator_id !== "none" ? Number(f.operator_id) : null,
    source: "manual",
    amenities: f.amenities,
    photos: f.photos,
    connectors: f.connectors.map((c) => ({
      type: c.type,
      power_kw: Number(c.power_kw),
      total: Number(c.total),
      available: Number(c.available),
    })),
    // is_promoted stored as 0/1 in DB; PATCH endpoint coerces boolean → integer
    is_promoted: f.is_promoted,
    discount_pct: f.discount_pct ? Number(f.discount_pct) : 0,
    ...(f.district ? { district: f.district } : {}),
    ...(f.region ? { region: f.region } : {}),
  };
}

// Live price preview
function LivePricePreview({ form, onChange }: { form: DrawerForm; onChange: (k: keyof DrawerForm, v: any) => void }) {
  const cost = parseFloat(form.cost_price_per_kwh) || 0;
  const margin = parseFloat(form.margin_pct) || 0;
  const retail = parseFloat(form.price_per_kwh) || 0;
  const isWarning = cost > 0 && retail < cost;

  // When cost or margin changes, auto-fill price_per_kwh
  const handleCostChange = (val: string) => {
    onChange("cost_price_per_kwh", val);
    const c = parseFloat(val);
    const m = parseFloat(form.margin_pct) || 0;
    if (c > 0) onChange("price_per_kwh", String(Math.round(c * (1 + m / 100))));
  };
  const handleMarginChange = (val: string) => {
    onChange("margin_pct", val);
    const c = parseFloat(form.cost_price_per_kwh);
    const m = parseFloat(val) || 0;
    if (c > 0) onChange("price_per_kwh", String(Math.round(c * (1 + m / 100))));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Закупочная (сум)</Label>
          <Input
            type="number" step="100" placeholder="1 000"
            value={form.cost_price_per_kwh}
            onChange={(e) => handleCostChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Маржа (%)</Label>
          <Input
            type="number" step="0.5" min={0} placeholder="20"
            value={form.margin_pct}
            onChange={(e) => handleMarginChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Розница (сум)</Label>
          <Input
            type="number" step="100"
            value={form.price_per_kwh}
            onChange={(e) => onChange("price_per_kwh", e.target.value)}
            className={isWarning ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>
      </div>

      {/* Live preview */}
      <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-3 ${isWarning ? "bg-destructive/10 border border-destructive/30 text-destructive" : "bg-muted/40 border"}`}>
        {isWarning ? (
          <>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Розничная цена ниже закупочной — убыточно</span>
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 text-amber-500 shrink-0" />
            <span>
              Итоговая цена для клиента:{" "}
              <strong>{formatUzs(retail)}</strong> / кВт·ч
              {cost > 0 && margin > 0 && (
                <span className="text-muted-foreground ml-1">(маржа {margin}%)</span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Промо</Label>
          <div className="flex items-center gap-2 h-9">
            <Checkbox
              id="is-promoted"
              checked={form.is_promoted}
              onCheckedChange={(v) => onChange("is_promoted", Boolean(v))}
            />
            <label htmlFor="is-promoted" className="text-sm cursor-pointer">Акционная станция</label>
          </div>
        </div>
        {form.is_promoted && (
          <div className="space-y-1.5">
            <Label className="text-xs">Скидка (%)</Label>
            <Input type="number" min={0} max={100} step={1} value={form.discount_pct} onChange={(e) => onChange("discount_pct", e.target.value)} placeholder="10" />
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectorsEditor({ connectors, onChange }: {
  connectors: DrawerForm["connectors"];
  onChange: (c: DrawerForm["connectors"]) => void;
}) {
  const add = () => onChange([...connectors, { type: "CCS2", power_kw: "50", total: "1", available: "1" }]);
  const remove = (i: number) => onChange(connectors.filter((_, idx) => idx !== i));
  const update = (i: number, key: string, val: string) => {
    const next = connectors.map((c, idx) => idx === i ? { ...c, [key]: val } : c);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {connectors.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_60px_60px_32px] gap-2 items-center">
          <Select value={c.type} onValueChange={(v) => update(i, "type", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONNECTOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="h-8 text-sm" placeholder="кВт" type="number" value={c.power_kw} onChange={(e) => update(i, "power_kw", e.target.value)} />
          <Input className="h-8 text-sm text-center" placeholder="Всего" type="number" min={1} value={c.total} onChange={(e) => update(i, "total", e.target.value)} />
          <Input className="h-8 text-sm text-center" placeholder="Своб." type="number" min={0} value={c.available} onChange={(e) => update(i, "available", e.target.value)} />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(i)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_60px_60px_32px] gap-2 text-[10px] text-muted-foreground px-0">
        <span>Тип разъёма</span><span>кВт</span><span className="text-center">Всего</span><span className="text-center">Свобод.</span><span />
      </div>
      <Button variant="outline" size="sm" onClick={add} className="w-full border-dashed">
        <Plus className="h-3 w-3 mr-1" /> Добавить разъём
      </Button>
    </div>
  );
}

function PhotosEditor({ photos, primaryIdx, onPhotos, onPrimary }: {
  photos: string[];
  primaryIdx: number;
  onPhotos: (p: string[]) => void;
  onPrimary: (i: number) => void;
}) {
  const [newUrl, setNewUrl] = useState("");
  const add = () => {
    if (newUrl.trim()) {
      onPhotos([...photos, newUrl.trim()]);
      setNewUrl("");
    }
  };
  const remove = (i: number) => {
    const next = photos.filter((_, idx) => idx !== i);
    onPhotos(next);
    if (primaryIdx >= next.length) onPrimary(0);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          className="flex-1 text-sm"
          placeholder="https://cdn.example.com/photo.jpg"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button variant="outline" size="sm" onClick={add}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      {photos.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-6 text-center text-muted-foreground text-sm">
          <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Добавьте URL фотографии
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((url, i) => (
            <div key={i} className={`relative rounded-lg border-2 overflow-hidden ${i === primaryIdx ? "border-primary" : "border-transparent"}`}>
              <img src={url} alt={`photo-${i}`} className="w-full h-24 object-cover bg-muted" onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />
              <div className="absolute top-1 right-1 flex gap-1">
                <button
                  onClick={() => onPrimary(i)}
                  className={`h-6 w-6 rounded flex items-center justify-center text-xs ${i === primaryIdx ? "bg-primary text-white" : "bg-white/80 text-muted-foreground hover:text-amber-500"}`}
                  title="Сделать главной"
                >
                  <Star className="h-3 w-3" fill={i === primaryIdx ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => remove(i)}
                  className="h-6 w-6 rounded bg-white/80 flex items-center justify-center text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {i === primaryIdx && (
                <div className="absolute bottom-1 left-1 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-medium">
                  Главная
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface StationEditDrawerProps {
  open: boolean;
  onClose: () => void;
  station: ExtStation | null;
  operators: any[];
  onSave: (payload: any, id?: number) => Promise<void>;
}

function StationEditDrawer({ open, onClose, station, operators, onSave }: StationEditDrawerProps) {
  const [section, setSection] = useState<"basic" | "photos" | "connectors" | "prices">("basic");
  const [form, setForm] = useState<DrawerForm>(station ? stationToForm(station as ExtStation) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Reset form when station changes
  React.useEffect(() => {
    if (open) {
      setForm(station ? stationToForm(station as ExtStation) : EMPTY_FORM);
      setSection("basic");
    }
  }, [open, station?.id]);

  const set = useCallback(<K extends keyof DrawerForm>(key: K, val: DrawerForm[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formToPayload(form), station?.id);
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { key: "basic", label: "Основное" },
    { key: "photos", label: "Фотографии" },
    { key: "connectors", label: "Коннекторы" },
    { key: "prices", label: "Цены" },
  ] as const;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[580px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-6 pt-6 pb-0 shrink-0">
          <SheetTitle>{station ? "Редактировать станцию" : "Новая станция"}</SheetTitle>
        </SheetHeader>

        {/* Section tabs */}
        <div className="flex border-b px-6 shrink-0">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${section === s.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {section === "basic" && (
            <>
              <div className="space-y-1.5">
                <Label>Название станции</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Например: Yunusabad DC Hub" />
              </div>
              <div className="space-y-1.5">
                <Label>Адрес</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="ул. Амира Темура, 15" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Широта</Label>
                  <Input type="number" step="any" value={form.lat} onChange={(e) => set("lat", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Долгота</Label>
                  <Input type="number" step="any" value={form.lng} onChange={(e) => set("lng", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Район</Label>
                  <Input value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="Юнусабад" />
                </div>
                <div className="space-y-1.5">
                  <Label>Регион</Label>
                  <Input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Ташкент" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Оператор</Label>
                  <Select value={form.operator_id} onValueChange={(v) => set("operator_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Независимая" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Независимая</SelectItem>
                      {operators?.map((op) => <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Статус</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Свободна</SelectItem>
                      <SelectItem value="occupied">Занята</SelectItem>
                      <SelectItem value="offline">Офлайн</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Мощность (кВт)</Label>
                  <Input type="number" value={form.power_kw} onChange={(e) => set("power_kw", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Регион</Label>
                  <Input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Ташкент" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Удобства</Label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        const next = form.amenities.includes(a)
                          ? form.amenities.filter((x) => x !== a)
                          : [...form.amenities, a];
                        set("amenities", next);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        form.amenities.includes(a)
                          ? "bg-primary text-white border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                      }`}
                    >
                      {AMENITY_LABELS[a] ?? a}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === "photos" && (
            <>
              <SectionHeader>Фотографии станции</SectionHeader>
              <PhotosEditor
                photos={form.photos}
                primaryIdx={form.primary_photo_idx}
                onPhotos={(p) => set("photos", p)}
                onPrimary={(i) => set("primary_photo_idx", i)}
              />
            </>
          )}

          {section === "connectors" && (
            <>
              <SectionHeader>Разъёмы и зарядные точки</SectionHeader>
              <ConnectorsEditor
                connectors={form.connectors}
                onChange={(c) => set("connectors", c)}
              />
            </>
          )}

          {section === "prices" && (
            <>
              <SectionHeader>Ценообразование</SectionHeader>
              <LivePricePreview form={form} onChange={set} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-between items-center shrink-0">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {station ? "Сохранить изменения" : "Создать станцию"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bulk actions dialog ─────────────────────────────────────────────────────
function BulkActionDialog({
  open, onClose, action, count, onApply,
}: {
  open: boolean; onClose: () => void; action: "margin" | "promo" | "status" | null; count: number; onApply: (val: any) => void;
}) {
  const [margin, setMargin] = useState("");
  const [status, setStatus] = useState("free");
  const [discount, setDiscount] = useState("");

  const labels: Record<string, string> = { margin: "Изменить маржу", promo: "Применить промо", status: "Изменить статус" };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{action ? labels[action] : ""} · {count} станций</DialogTitle>
        </DialogHeader>
        {action === "margin" && (
          <div className="space-y-3 py-2">
            <Label>Новая маржа (%)</Label>
            <div className="relative">
              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" type="number" min={0} step={0.5} value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="20" />
            </div>
          </div>
        )}
        {action === "promo" && (
          <div className="space-y-3 py-2">
            <Label>Скидка (%)</Label>
            <div className="relative">
              <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" type="number" min={0} max={100} step={1} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="15" />
            </div>
            <p className="text-xs text-muted-foreground">Установит is_promoted=true и указанную скидку для выбранных станций</p>
          </div>
        )}
        {action === "status" && (
          <div className="space-y-2 py-2">
            <Label>Новый статус</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Свободна</SelectItem>
                <SelectItem value="occupied">Занята</SelectItem>
                <SelectItem value="offline">Офлайн</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter className="gap-2 mt-1">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={() => {
              if (action === "margin") onApply({ margin_pct: Number(margin) });
              if (action === "promo") onApply({ is_promoted: true, discount_pct: Number(discount) });
              if (action === "status") onApply({ status });
            }}
            className="bg-primary hover:bg-primary/90"
          >
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Stations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: stationsResponse, isLoading } = useGetStations();
  const allStations: ExtStation[] = useMemo(() => [
    ...(stationsResponse?.promoted ?? []),
    ...(stationsResponse?.nearby ?? []),
  ], [stationsResponse]);

  const { data: operators } = useGetOperators();
  const createMutation = useCreateStation();
  const deleteMutation = useDeleteStation();
  const statusMutation = useUpdateStationStatus();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<ExtStation | null>(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"margin" | "promo" | "status" | null>(null);

  const filteredStations = useMemo(() => allStations.filter((s) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchSource = sourceFilter === "all" || (s as any).source === sourceFilter;
    return matchSearch && matchStatus && matchSource;
  }), [allStations, searchTerm, statusFilter, sourceFilter]);

  const allSelected = filteredStations.length > 0 && filteredStations.every((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStations.map((s) => s.id)));
  };
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openNew = () => { setEditingStation(null); setDrawerOpen(true); };
  const openEdit = (s: ExtStation) => { setEditingStation(s); setDrawerOpen(true); };

  const handleSave = async (payload: Record<string, unknown>, id?: number) => {
    try {
      if (id) {
        // Use PATCH — accepts all extended fields (photos, district, region, is_promoted…)
        await patchStation(id, payload);
        queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() });
        setDrawerOpen(false);
        toast({ title: "Станция обновлена" });
      } else {
        await new Promise<void>((resolve, reject) =>
          createMutation.mutate(
            { data: payload as any },
            { onSuccess: () => resolve(), onError: reject }
          )
        );
        queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() });
        setDrawerOpen(false);
        toast({ title: "Станция создана" });
      }
    } catch (err) {
      toast({ title: "Ошибка сохранения", description: String(err), variant: "destructive" });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Удалить станцию?")) return;
    deleteMutation.mutate(
      { id },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() }); toast({ title: "Станция удалена" }); } }
    );
  };

  const handleStatusToggle = (id: number, status: StationStatusUpdateStatus) => {
    statusMutation.mutate(
      { id, data: { status } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() }) }
    );
  };

  const applyBulkAction = async (val: any) => {
    const ids = Array.from(selectedIds);
    const updates = ids.map((id) => {
      if (val.status) {
        // Status toggle — use dedicated status endpoint
        return statusMutation.mutateAsync({ id, data: { status: val.status } });
      }
      // margin / promo — use PATCH with only the fields that change
      const patch: Record<string, unknown> = {};
      if (val.is_promoted !== undefined) {
        patch.is_promoted = val.is_promoted;
        patch.discount_pct = val.discount_pct ?? 0;
      }
      if (val.margin_pct !== undefined) {
        const station = allStations.find((s) => s.id === id);
        const costBase = (station as any)?.cost_price_per_kwh;
        if (costBase) {
          patch.price_per_kwh = Math.round(Number(costBase) * (1 + val.margin_pct / 100));
        }
      }
      return patchStation(id, patch);
    });
    const results = await Promise.allSettled(updates);
    const failed = results.filter((r) => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() });
    setSelectedIds(new Set());
    setBulkAction(null);
    if (failed > 0) {
      toast({ title: `${ids.length - failed} обновлено, ${failed} ошибок`, variant: "destructive" });
    } else {
      toast({ title: `Обновлено ${ids.length} станций` });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Зарядные станции</h1>
          <p className="text-muted-foreground text-sm mt-1">Инфраструктура сети · {allStations.length} станций</p>
        </div>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Добавить станцию
        </Button>
      </div>

      {/* Filters */}
      <div className="px-8 pb-4 flex gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по названию или адресу…" className="pl-9 bg-white dark:bg-card border-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-card border-none shadow-sm">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="free">Свободна</SelectItem>
            <SelectItem value="occupied">Занята</SelectItem>
            <SelectItem value="offline">Офлайн</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-card border-none shadow-sm">
            <SelectValue placeholder="Источник" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все источники</SelectItem>
            <SelectItem value="manual">Ручной</SelectItem>
            <SelectItem value="api">API (OCM)</SelectItem>
            <SelectItem value="mock">Демо</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="mx-8 mb-3 flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 shrink-0">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Выбрано {selectedIds.size} станций</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setBulkAction("margin")} className="h-7">
              <Percent className="h-3.5 w-3.5 mr-1" /> Маржа
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAction("promo")} className="h-7">
              <Tag className="h-3.5 w-3.5 mr-1" /> Промо
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAction("status")} className="h-7">
              <ChevronDown className="h-3.5 w-3.5 mr-1" /> Статус
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-7 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 px-8 pb-8 overflow-hidden">
        <Card className="h-full border-none shadow-sm bg-white dark:bg-card flex flex-col">
          <div className="flex-1 overflow-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-none">
                  <TableHead className="w-10 pr-0">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="font-semibold">Станция</TableHead>
                  <TableHead className="font-semibold">Оператор</TableHead>
                  <TableHead className="font-semibold">Источник</TableHead>
                  <TableHead className="font-semibold text-right">Мощность</TableHead>
                  <TableHead className="font-semibold text-right">Цена</TableHead>
                  <TableHead className="font-semibold text-center">Статус</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : filteredStations.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Станций не найдено</TableCell></TableRow>
                ) : (
                  filteredStations.map((station) => {
                    const selected = selectedIds.has(station.id);
                    return (
                      <TableRow
                        key={station.id}
                        className={`border-b border-border/50 hover:bg-muted/30 ${selected ? "bg-primary/5" : ""}`}
                      >
                        <TableCell className="pr-0 w-10">
                          <Checkbox checked={selected} onCheckedChange={() => toggleSelect(station.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{station.name}</span>
                            {station.is_promoted && <Badge className="bg-amber-100 text-amber-700 border-0 shadow-none text-[10px] px-1.5">Промо</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px] ml-5">
                            {station.address}
                          </div>
                        </TableCell>
                        <TableCell>
                          {station.operator?.name ? (
                            <div className="flex items-center gap-2">
                              {station.operator.logo_url && <img src={station.operator.logo_url} className="w-4 h-4 object-contain" alt="" />}
                              <span className="text-sm">{station.operator.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Независимая</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const src = (station as any).source ?? "manual";
                            if (src === "mock") return <Badge className="bg-amber-100 text-amber-800 border-0 shadow-none hover:bg-amber-200 text-xs">Демо</Badge>;
                            if (src === "api") return <Badge className="bg-blue-100 text-blue-800 border-0 shadow-none hover:bg-blue-200 text-xs">OCM</Badge>;
                            return <Badge className="bg-slate-100 text-slate-700 border-0 shadow-none hover:bg-slate-200 text-xs">Ручной</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 font-medium text-sm">
                            <Zap className="h-3 w-3 text-amber-500" />
                            {station.power_kw} кВт
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                          {formatUzs(station.price_per_kwh)}/кВт·ч
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                                {getStatusBadge(station.status)}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                              <DropdownMenuItem onClick={() => handleStatusToggle(station.id, "free")}>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" /> Свободна
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusToggle(station.id, "occupied")}>
                                <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" /> Занята
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusToggle(station.id, "offline")}>
                                <div className="w-2 h-2 rounded-full bg-rose-500 mr-2" /> Офлайн
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(station)}>
                                <Edit2 className="h-4 w-4 mr-2" /> Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => handleDelete(station.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <StationEditDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        station={editingStation}
        operators={operators ?? []}
        onSave={handleSave}
      />

      <BulkActionDialog
        open={!!bulkAction}
        onClose={() => setBulkAction(null)}
        action={bulkAction}
        count={selectedIds.size}
        onApply={applyBulkAction}
      />
    </div>
  );
}
