import React from "react";
import { useGetUsers } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Search, Mail, Phone, Leaf } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatUzs } from "@/lib/formatUzs";

export default function Users() {
  const { data: users, isLoading } = useGetUsers();
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredUsers = users?.filter(u => {
    // email может быть null (регистрация по телефону), name тоже — защищаемся.
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Каталог клиентов</h1>
          <p className="text-muted-foreground text-sm mt-1">Пользователи приложения и уровни подписки</p>
        </div>
      </div>

      <div className="px-8 pb-4 flex gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по email или имени…" 
            className="pl-9 bg-white dark:bg-card border-none shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 px-8 pb-8 overflow-hidden">
        <Card className="h-full border-none shadow-sm bg-white dark:bg-card flex flex-col">
          <div className="flex-1 overflow-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-none">
                  <TableHead className="font-semibold">Клиент</TableHead>
                  <TableHead className="font-semibold">Уровень</TableHead>
                  <TableHead className="font-semibold text-right">Сессии</TableHead>
                  <TableHead className="font-semibold text-right">Всего энергии</TableHead>
                  <TableHead className="font-semibold text-right">Потрачено</TableHead>
                  <TableHead className="font-semibold text-right">Эко-вклад</TableHead>
                  <TableHead className="font-semibold text-right">Регистрация</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Загрузка…</TableCell></TableRow>
                ) : filteredUsers?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Пользователи не найдены.</TableCell></TableRow>
                ) : (
                  filteredUsers?.map((user) => (
                    <TableRow key={user.id} className="border-b border-border/50 hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium">{user.name || 'Без имени'}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email || '—'}</span>
                          {user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {user.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.membership_tier === 'premium' ? (
                          <Badge className="bg-violet-100 text-violet-800 border-0">Премиум</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Базовый</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {user.total_sessions || 0}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {(user.total_energy_kwh || 0).toFixed(1)} кВт·ч
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatUzs(Math.round(user.total_spent || 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-emerald-600 font-medium">
                          <Leaf className="h-3 w-3" />
                          {(user.co2_saved_kg || 0).toFixed(1)} кг
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {user.created_at ? format(new Date(user.created_at), "LLL yyyy", { locale: ru }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
