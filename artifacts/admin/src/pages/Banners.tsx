import React, { useState, useEffect, useCallback, useRef } from "react";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Plus, GripVertical, Trash2, RefreshCw, Image as ImageIcon, Palette,
  Eye, EyeOff, Clock, Zap, Save, X, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

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

// ── Types ──────────────────────────────────────────────────────────────────────
interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  background_type: "gradient" | "image";
  gradient_from: string | null;
  gradient_to: string | null;
  cta_text: string | null;
  cta_target: string | null;
  show_countdown: boolean;
  countdown_ends_at: string | null;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

interface BannerForm {
  title: string;
  subtitle: string;
  background_type: "gradient" | "image";
  image_url: string;
  gradient_from: string;
  gradient_to: string;
  cta_text: string;
  cta_target: string;
  show_countdown: boolean;
  countdown_ends_at: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  priority: string;
}

const EMPTY_FORM: BannerForm = {
  title: "", subtitle: "",
  background_type: "gradient",
  image_url: "",
  gradient_from: "#2563EB", gradient_to: "#7C3AED",
  cta_text: "Подробнее", cta_target: "",
  show_countdown: false, countdown_ends_at: "",
  is_active: true, starts_at: "", ends_at: "",
  priority: "0",
};

// ── Banner status ──────────────────────────────────────────────────────────────
function getBannerStatus(b: Banner): "active" | "scheduled" | "ended" | "inactive" {
  const now = new Date();
  if (!b.is_active) return "inactive";
  if (b.ends_at && isBefore(parseISO(b.ends_at), now)) return "ended";
  if (b.starts_at && isAfter(parseISO(b.starts_at), now)) return "scheduled";
  return "active";
}

// ── Countdown formatter ───────────────────────────────────────────────────────
function useCountdown(target: string | null): string {
  const [val, setVal] = useState("");
  useEffect(() => {
    if (!target) { setVal(""); return; }
    const tick = () => {
      const diff = parseISO(target).getTime() - Date.now();
      if (diff <= 0) { setVal("00:00:00"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setVal(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [target]);
  return val;
}

// ── BannerPreview ─────────────────────────────────────────────────────────────
function BannerPreview({ form }: { form: BannerForm }) {
  const countdown = useCountdown(form.show_countdown && form.countdown_ends_at ? form.countdown_ends_at : null);

  const bgStyle: React.CSSProperties =
    form.background_type === "image" && form.image_url
      ? {
          backgroundImage: `url(${form.image_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {
          background: `linear-gradient(135deg, ${form.gradient_from || "#2563EB"}, ${form.gradient_to || "#7C3AED"})`,
        };

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
        <Eye className="h-3 w-3" /> Мобильный предпросмотр (375px)
      </p>
      <div style={{ width: 375 }} className="shrink-0">
        <div
          className="relative rounded-2xl overflow-hidden shadow-lg"
          style={{ ...bgStyle, height: 160 }}
        >
          {/* Overlay for image backgrounds */}
          {form.background_type === "image" && form.image_url && (
            <div className="absolute inset-0 bg-black/40" />
          )}

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {form.show_countdown && countdown && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <Clock className="h-3 w-3 text-white/80" />
                    <span className="text-white/90 text-xs font-mono">{countdown}</span>
                  </div>
                )}
                <h3 className="text-white font-bold text-lg leading-tight drop-shadow">
                  {form.title || "Заголовок баннера"}
                </h3>
                {form.subtitle && (
                  <p className="text-white/85 text-sm mt-0.5 leading-snug">
                    {form.subtitle}
                  </p>
                )}
              </div>
              {/* iON logo mark */}
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0 ml-3">
                <Zap className="h-4 w-4 text-white" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              {form.cta_text ? (
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/30">
                  <span className="text-white text-sm font-medium">{form.cta_text}</span>
                </div>
              ) : (
                <div />
              )}
              {!form.is_active && (
                <Badge variant="secondary" className="text-xs bg-black/30 text-white border-0">
                  Неактивен
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Draggable list item ────────────────────────────────────────────────────────
interface DragItem {
  id: number;
  idx: number;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Banners() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Drag-and-drop state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase()}/api/banners`, { headers: authHeaders() });
      if (r.ok) setBanners(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  // ── Select banner ────────────────────────────────────────────────────────────
  function selectBanner(b: Banner) {
    setSelected(b);
    setIsNew(false);
    setForm({
      title: b.title,
      subtitle: b.subtitle ?? "",
      background_type: b.background_type as "gradient" | "image",
      image_url: b.image_url ?? "",
      gradient_from: b.gradient_from ?? "#2563EB",
      gradient_to: b.gradient_to ?? "#7C3AED",
      cta_text: b.cta_text ?? "",
      cta_target: b.cta_target ?? "",
      show_countdown: b.show_countdown,
      countdown_ends_at: fromISO(b.countdown_ends_at),
      is_active: b.is_active,
      starts_at: fromISO(b.starts_at),
      ends_at: fromISO(b.ends_at),
      priority: String(b.priority),
    });
  }

  function openNew() {
    setSelected(null);
    setIsNew(true);
    setForm({ ...EMPTY_FORM, priority: String(banners.length) });
  }

  // ── Form field setter ────────────────────────────────────────────────────────
  const set = <K extends keyof BannerForm>(k: K, v: BannerForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // ── Build payload ────────────────────────────────────────────────────────────
  function buildPayload() {
    return {
      title:             form.title,
      subtitle:          form.subtitle || null,
      background_type:   form.background_type,
      image_url:         form.background_type === "image" ? (form.image_url || null) : null,
      gradient_from:     form.background_type === "gradient" ? form.gradient_from : null,
      gradient_to:       form.background_type === "gradient" ? form.gradient_to : null,
      cta_text:          form.cta_text || null,
      cta_target:        form.cta_target || null,
      show_countdown:    form.show_countdown,
      // Normalize datetime-local → ISO before sending to API
      countdown_ends_at: form.show_countdown ? toISO(form.countdown_ends_at) : null,
      is_active:         form.is_active,
      starts_at:         toISO(form.starts_at),
      ends_at:           toISO(form.ends_at),
      priority:          Number(form.priority) || 0,
    };
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { toast({ title: "Введите заголовок", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      let r: Response;
      if (isNew) {
        r = await fetch(`${apiBase()}/api/banners`, {
          method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
        });
      } else if (selected) {
        r = await fetch(`${apiBase()}/api/banners/${selected.id}`, {
          method: "PATCH", headers: authHeaders(), body: JSON.stringify(payload),
        });
      } else return;

      if (!r.ok) throw new Error(await r.text());
      const saved: Banner = await r.json();
      await fetchBanners();
      selectBanner(saved);
      setIsNew(false);
      toast({ title: isNew ? "Баннер создан" : "Баннер сохранён" });
    } catch (err) {
      toast({ title: "Ошибка сохранения", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function toggleActive(b: Banner) {
    try {
      const r = await fetch(`${apiBase()}/api/banners/${b.id}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ is_active: !b.is_active }),
      });
      if (!r.ok) throw new Error(await r.text());
      await fetchBanners();
      if (selected?.id === b.id) setForm(prev => ({ ...prev, is_active: !b.is_active }));
    } catch (err) {
      toast({ title: "Ошибка", description: String(err), variant: "destructive" });
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return;
    try {
      const r = await fetch(`${apiBase()}/api/banners/${deleteId}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!r.ok) throw new Error(await r.text());
      await fetchBanners();
      if (selected?.id === deleteId) { setSelected(null); setIsNew(false); }
      toast({ title: "Баннер удалён" });
    } catch (err) {
      toast({ title: "Ошибка удаления", description: String(err), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  // ── Drag-and-drop reorder ────────────────────────────────────────────────────
  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  async function onDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx == null || fromIdx === toIdx) { setDragOverIdx(null); return; }

    const reordered = [...banners];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Reassign priorities by position
    const withPriority = reordered.map((b, i) => ({ ...b, priority: i }));
    setBanners(withPriority);
    setDragOverIdx(null);
    dragIdx.current = null;

    // Persist
    setReordering(true);
    try {
      const r = await fetch(`${apiBase()}/api/banners/reorder`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(withPriority.map(b => ({ id: b.id, priority: b.priority }))),
      });
      if (!r.ok) throw new Error(await r.text());
      const updated: Banner[] = await r.json();
      setBanners(updated);
    } catch (err) {
      toast({ title: "Ошибка сортировки", description: String(err), variant: "destructive" });
      await fetchBanners(); // rollback
    } finally {
      setReordering(false);
    }
  }

  function onDragEnd() {
    dragIdx.current = null;
    setDragOverIdx(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const showPanel = isNew || selected !== null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: list ── */}
      <div className={`flex flex-col border-r ${showPanel ? "w-80 flex-shrink-0" : "flex-1"}`}>
        {/* Header */}
        <div className="px-4 py-4 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold">Баннеры</h1>
            <p className="text-xs text-muted-foreground">{banners.length} баннеров · перетащите для сортировки</p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" onClick={fetchBanners} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading || reordering ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Новый
            </Button>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : banners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <ImageIcon className="h-10 w-10 opacity-20" />
              <p className="text-sm">Нет баннеров</p>
              <Button variant="outline" size="sm" onClick={openNew}>Создать первый</Button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {banners.map((b, idx) => {
                const status = getBannerStatus(b);
                const isSelected = selected?.id === b.id && !isNew;
                const isDragOver = dragOverIdx === idx;

                return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDrop={(e) => onDrop(e, idx)}
                    onDragEnd={onDragEnd}
                    onClick={() => selectBanner(b)}
                    className={`group flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-muted/40"
                    } ${isDragOver ? "border-primary/50 bg-primary/10 scale-[0.98]" : ""}`}
                  >
                    {/* Drag handle */}
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />

                    {/* Thumbnail */}
                    <div
                      className="w-12 h-8 rounded-md flex-shrink-0 overflow-hidden"
                      style={
                        b.background_type === "image" && b.image_url
                          ? { backgroundImage: `url(${b.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                          : { background: `linear-gradient(135deg, ${b.gradient_from ?? "#2563EB"}, ${b.gradient_to ?? "#7C3AED"})` }
                      }
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          status === "active" ? "bg-emerald-500" :
                          status === "scheduled" ? "bg-blue-500" :
                          status === "ended" ? "bg-gray-400" : "bg-amber-500"
                        }`} />
                        <span className="text-xs text-muted-foreground">
                          {status === "active" ? "Активен" :
                           status === "scheduled" ? "Запланирован" :
                           status === "ended" ? "Завершён" : "Неактивен"}
                          {" · "}#{b.priority}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded hover:bg-background"
                        title={b.is_active ? "Скрыть" : "Показать"}
                        onClick={(e) => { e.stopPropagation(); toggleActive(b); }}
                      >
                        {b.is_active
                          ? <Eye className="h-3.5 w-3.5 text-emerald-600" />
                          : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      <button
                        className="p-1 rounded hover:bg-background"
                        title="Удалить"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(b.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: editor + preview ── */}
      {showPanel && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Panel header */}
          <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold">
                {isNew ? "Новый баннер" : selected?.title}
              </h2>
              <p className="text-xs text-muted-foreground">Редактор и предпросмотр</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="icon"
                onClick={() => { setSelected(null); setIsNew(false); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {/* Form */}
            <ScrollArea className="w-96 flex-shrink-0 border-r">
              <div className="px-5 py-4 space-y-5">
                {/* Basic */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Заголовок *</Label>
                    <Input
                      placeholder="Летняя скидка 20%!"
                      value={form.title}
                      onChange={e => set("title", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Подзаголовок</Label>
                    <Input
                      placeholder="Успейте зарядиться по акционной цене"
                      value={form.subtitle}
                      onChange={e => set("subtitle", e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Background */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Фон</Label>
                  <Tabs
                    value={form.background_type}
                    onValueChange={v => set("background_type", v as "gradient" | "image")}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="gradient" className="flex-1 gap-1.5">
                        <Palette className="h-3.5 w-3.5" /> Градиент
                      </TabsTrigger>
                      <TabsTrigger value="image" className="flex-1 gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" /> Изображение
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="gradient" className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Цвет 1</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={form.gradient_from}
                              onChange={e => set("gradient_from", e.target.value)}
                              className="w-9 h-9 rounded border cursor-pointer"
                            />
                            <Input
                              value={form.gradient_from}
                              onChange={e => set("gradient_from", e.target.value)}
                              className="font-mono text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Цвет 2</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={form.gradient_to}
                              onChange={e => set("gradient_to", e.target.value)}
                              className="w-9 h-9 rounded border cursor-pointer"
                            />
                            <Input
                              value={form.gradient_to}
                              onChange={e => set("gradient_to", e.target.value)}
                              className="font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      {/* Gradient preview strip */}
                      <div
                        className="h-2 rounded-full w-full"
                        style={{ background: `linear-gradient(135deg, ${form.gradient_from}, ${form.gradient_to})` }}
                      />
                    </TabsContent>
                    <TabsContent value="image" className="mt-3 space-y-1.5">
                      <Label className="text-xs">URL изображения</Label>
                      <Input
                        placeholder="https://example.com/banner.jpg"
                        value={form.image_url}
                        onChange={e => set("image_url", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Рекомендуемый размер: 750×320px. Поверх фото накладывается затемняющий слой.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>

                <Separator />

                {/* CTA */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Кнопка (CTA)</Label>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Текст кнопки</Label>
                    <Input
                      placeholder="Подробнее"
                      value={form.cta_text}
                      onChange={e => set("cta_text", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ссылка / экран</Label>
                    <Input
                      placeholder="/stations?promo=summer"
                      value={form.cta_target}
                      onChange={e => set("cta_target", e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Countdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Обратный отсчёт</Label>
                    <Switch
                      checked={form.show_countdown}
                      onCheckedChange={v => set("show_countdown", v)}
                    />
                  </div>
                  {form.show_countdown && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Конец акции</Label>
                      <Input
                        type="datetime-local"
                        value={form.countdown_ends_at}
                        onChange={e => set("countdown_ends_at", e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Settings */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Настройки публикации</Label>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Активен</Label>
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={v => set("is_active", v)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Начало показа</Label>
                      <Input
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={e => set("starts_at", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Конец показа</Label>
                      <Input
                        type="datetime-local"
                        value={form.ends_at}
                        onChange={e => set("ends_at", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Приоритет (выше = раньше)</Label>
                    <Input
                      type="number" min="0" placeholder="0"
                      value={form.priority}
                      onChange={e => set("priority", e.target.value)}
                    />
                  </div>
                </div>

                {/* Save button */}
                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1.5" />
                  {saving ? "Сохранение…" : isNew ? "Создать баннер" : "Сохранить"}
                </Button>
              </div>
            </ScrollArea>

            {/* Live preview */}
            <div className="flex-1 bg-muted/20 flex flex-col overflow-auto">
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                <BannerPreview form={form} />

                {/* Color swatch strip for gradient */}
                {form.background_type === "gradient" && (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">Градиент</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-border"
                        style={{ background: form.gradient_from }}
                      />
                      <div
                        className="h-px flex-1 w-20"
                        style={{ background: `linear-gradient(to right, ${form.gradient_from}, ${form.gradient_to})` }}
                      />
                      <div
                        className="w-5 h-5 rounded-full border border-border"
                        style={{ background: form.gradient_to }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {form.gradient_from} → {form.gradient_to}
                    </p>
                  </div>
                )}

                {/* Info cards */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                  <div className="rounded-lg border bg-card p-3 text-center">
                    <p className="text-xs text-muted-foreground">Статус</p>
                    <p className={`text-sm font-semibold mt-0.5 ${form.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {form.is_active ? "Активен" : "Неактивен"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3 text-center">
                    <p className="text-xs text-muted-foreground">Приоритет</p>
                    <p className="text-sm font-semibold mt-0.5">#{form.priority || "0"}</p>
                  </div>
                  {form.starts_at && (
                    <div className="rounded-lg border bg-card p-3 text-center col-span-2">
                      <p className="text-xs text-muted-foreground">Период показа</p>
                      <p className="text-xs font-medium mt-0.5">
                        {form.starts_at ? format(new Date(form.starts_at), "d MMM yyyy, HH:mm", { locale: ru }) : "—"}
                        {" → "}
                        {form.ends_at ? format(new Date(form.ends_at), "d MMM yyyy, HH:mm", { locale: ru }) : "бессрочно"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить баннер?</AlertDialogTitle>
            <AlertDialogDescription>
              Баннер будет удалён из системы и перестанет показываться пользователям.
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
