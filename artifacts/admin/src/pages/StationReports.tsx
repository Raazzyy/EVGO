import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Flag, CheckCircle, XCircle, RefreshCw, MapPin, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type ReportStatus = "new" | "confirmed" | "rejected";

type ReportReason =
  | "not_working"
  | "wrong_price"
  | "wrong_location"
  | "wrong_connectors"
  | "permanently_closed"
  | "other";

interface StationReport {
  id: number;
  station_id: number;
  user_id: string;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  station?: {
    id: number;
    name: string;
    address: string;
    verified_at: string | null;
  };
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem("admin_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return null as T;
  return res.json();
}

const REASON_LABELS: Record<ReportReason, string> = {
  not_working: "Не работает",
  wrong_price: "Неверная цена",
  wrong_location: "Неверное место",
  wrong_connectors: "Не те разъёмы",
  permanently_closed: "Станции нет",
  other: "Другое",
};

// «Станции нет» и «не работает» означают, что человек приехал впустую —
// такие жалобы разбираются первыми.
const REASON_STYLES: Record<ReportReason, string> = {
  not_working: "bg-red-100 text-red-700",
  permanently_closed: "bg-red-100 text-red-700",
  wrong_price: "bg-amber-100 text-amber-700",
  wrong_location: "bg-amber-100 text-amber-700",
  wrong_connectors: "bg-amber-100 text-amber-700",
  other: "bg-slate-100 text-slate-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StationReports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<ReportStatus>("new");

  const { data: reports = [], isLoading, refetch, isFetching } = useQuery<StationReport[]>({
    queryKey: ["admin", "station-reports", status],
    queryFn: () => apiFetch<StationReport[]>(`/api/admin/station-reports?status=${status}`),
    refetchInterval: 60_000,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, next }: { id: number; next: "confirmed" | "rejected" }) =>
      apiFetch<StationReport>(`/api/admin/station-reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "station-reports"] });
      toast({
        title: vars.next === "confirmed" ? "Подтверждено" : "Отклонено",
        description:
          vars.next === "confirmed"
            ? "Жалоба учтена — не забудьте исправить данные станции"
            : "Данные станции признаны верными",
      });
    },
    onError: (e: Error) =>
      toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Жалобы на станции</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Пользователи сообщают о неточностях прямо со станции. Это основной
            источник правок: данные приходят из OpenChargeMap и устаревают.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as ReportStatus)}>
        <TabsList>
          <TabsTrigger value="new">Новые</TabsTrigger>
          <TabsTrigger value="confirmed">Подтверждённые</TabsTrigger>
          <TabsTrigger value="rejected">Отклонённые</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            {status === "new"
              ? `Ожидают разбора: ${reports.length}`
              : `Записей: ${reports.length}`}
          </CardTitle>
          <CardDescription>
            {status === "new"
              ? "«Не работает» и «станции нет» означают, что человек приехал впустую — разбирайте их первыми"
              : "История разобранных жалоб"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Загрузка…</p>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mt-3">
                {status === "new" ? "Нет новых жалоб" : "Здесь пока пусто"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Станция</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead>Комментарий</TableHead>
                    <TableHead className="whitespace-nowrap">Когда</TableHead>
                    {status === "new" ? (
                      <TableHead className="text-right">Действия</TableHead>
                    ) : (
                      <TableHead>Разобрал</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.station ? (
                          <Link
                            href="/stations"
                            className="group inline-flex items-start gap-2"
                          >
                            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                            <span>
                              <span className="font-medium group-hover:underline">
                                {r.station.name}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {r.station.address}
                              </span>
                              {!r.station.verified_at && (
                                <span className="block text-xs text-amber-600 mt-0.5">
                                  никогда не проверялась
                                </span>
                              )}
                            </span>
                            <ExternalLink className="h-3 w-3 mt-1 opacity-0 group-hover:opacity-60" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            станция #{r.station_id} удалена
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className={REASON_STYLES[r.reason]}>
                          {REASON_LABELS[r.reason]}
                        </Badge>
                      </TableCell>

                      <TableCell className="max-w-xs">
                        {r.comment ? (
                          <span className="text-sm">{r.comment}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(r.created_at)}
                      </TableCell>

                      {status === "new" ? (
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="mr-2"
                            disabled={resolveMutation.isPending}
                            onClick={() =>
                              resolveMutation.mutate({ id: r.id, next: "confirmed" })
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Подтвердить
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={resolveMutation.isPending}
                            onClick={() =>
                              resolveMutation.mutate({ id: r.id, next: "rejected" })
                            }
                          >
                            <XCircle className="h-4 w-4 mr-1.5" />
                            Отклонить
                          </Button>
                        </TableCell>
                      ) : (
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {r.resolved_by ?? "—"}
                          {r.resolved_at && (
                            <span className="block text-xs">
                              {formatDate(r.resolved_at)}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
