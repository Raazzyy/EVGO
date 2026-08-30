import React from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatUzs } from "@/lib/formatUzs";
import { Search, Wallet as WalletIcon } from "lucide-react";
import { format } from "date-fns";

interface WalletTxn {
  id: number; type: string; amount: number; balance_after: number;
  comment: string | null; created_at: string;
}
interface WalletHold {
  id: number; amount: number; status: string; created_at: string; expires_at: string;
}
interface WalletData {
  user: { id: string; phone: string | null; name: string | null };
  balance: number; held: number; available: number;
  transactions: WalletTxn[]; holds: WalletHold[];
}

const TYPE_LABEL: Record<string, string> = {
  topup: "Пополнение", charge: "Зарядка", refund: "Возврат", adjustment: "Корректировка",
};

export default function Wallet() {
  const [userId, setUserId] = React.useState("");
  const [data, setData] = React.useState<WalletData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Форма корректировки
  const [adjAmount, setAdjAmount] = React.useState("");
  const [adjComment, setAdjComment] = React.useState("");
  const [adjBusy, setAdjBusy] = React.useState(false);

  const load = React.useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await customFetch<WalletData>(`/api/admin/wallet/${encodeURIComponent(id.trim())}`);
      setData(res);
    } catch (e: any) {
      setError(e?.data?.error ?? "Пользователь или кошелёк не найден");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const adjust = async () => {
    if (!data) return;
    const amount = Number(adjAmount);
    if (!Number.isFinite(amount) || amount === 0) { setError("Сумма — число и не 0"); return; }
    if (!adjComment.trim()) { setError("Комментарий обязателен"); return; }
    setAdjBusy(true); setError(null);
    try {
      await customFetch(`/api/admin/wallet/${encodeURIComponent(data.user.id)}/adjust`, {
        method: "POST",
        body: JSON.stringify({ amount, comment: adjComment.trim() }),
      });
      setAdjAmount(""); setAdjComment("");
      await load(data.user.id);
    } catch (e: any) {
      setError(e?.data?.error ?? "Не удалось применить корректировку");
    } finally {
      setAdjBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-auto">
      <div className="p-8 pb-4 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <WalletIcon className="h-6 w-6" /> Кошельки
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Баланс, журнал и ручная корректировка</p>
      </div>

      <div className="px-8 pb-4 flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ID пользователя…"
            className="pl-9 bg-white dark:bg-card"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(userId); }}
          />
        </div>
        <Button onClick={() => load(userId)} disabled={loading}>
          {loading ? "Загрузка…" : "Найти"}
        </Button>
      </div>

      {error && <div className="px-8 pb-2 text-sm text-red-500">{error}</div>}

      {data && (
        <div className="px-8 pb-8 space-y-6">
          {/* Итог */}
          <Card className="p-6 border-none shadow-sm bg-white dark:bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">
                  {data.user.name ?? "Без имени"} · {data.user.phone ?? data.user.id}
                </div>
                <div className="text-3xl font-bold mt-1">{formatUzs(data.balance)}</div>
                {data.held > 0 && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Заморожено {formatUzs(data.held)} · Доступно {formatUzs(data.available)}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Корректировка */}
          <Card className="p-6 border-none shadow-sm bg-white dark:bg-card">
            <h2 className="font-semibold mb-3">Ручная корректировка</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="number"
                placeholder="Сумма (+/−), сум"
                className="sm:w-48"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
              />
              <Input
                placeholder="Комментарий (обязательно)"
                className="flex-1"
                value={adjComment}
                onChange={(e) => setAdjComment(e.target.value)}
              />
              <Button onClick={adjust} disabled={adjBusy}>
                {adjBusy ? "…" : "Применить"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Плюс — начислить, минус — списать. Действие подписывается вашей почтой и попадает в журнал.
            </p>
          </Card>

          {/* Активные холды */}
          {data.holds.filter((h) => h.status === "active").length > 0 && (
            <Card className="p-4 border-none shadow-sm bg-white dark:bg-card">
              <h2 className="font-semibold mb-2 px-2">Активные холды</h2>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Сумма</TableHead><TableHead>Создан</TableHead><TableHead>Истекает</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.holds.filter((h) => h.status === "active").map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatUzs(h.amount)}</TableCell>
                      <TableCell>{format(new Date(h.created_at), "dd.MM HH:mm")}</TableCell>
                      <TableCell>{format(new Date(h.expires_at), "dd.MM HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Журнал */}
          <Card className="border-none shadow-sm bg-white dark:bg-card overflow-hidden">
            <div className="p-4 font-semibold">Журнал операций</div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Баланс после</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead className="text-right">Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Операций нет</TableCell></TableRow>
                ) : data.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell><Badge variant="secondary">{TYPE_LABEL[t.type] ?? t.type}</Badge></TableCell>
                    <TableCell className={`text-right font-medium ${t.amount > 0 ? "text-emerald-600" : ""}`}>
                      {t.amount > 0 ? "+" : ""}{formatUzs(t.amount)}
                    </TableCell>
                    <TableCell className="text-right">{formatUzs(t.balance_after)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{t.comment ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{format(new Date(t.created_at), "dd.MM.yy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
