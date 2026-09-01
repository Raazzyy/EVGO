import React, { useState } from "react";
import { 
  useGetSupportTickets,
  useUpdateSupportTicket,
  getGetSupportTicketsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Clock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Support() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: tickets, isLoading } = useGetSupportTickets();
  const updateMutation = useUpdateSupportTicket();

  const filteredTickets = tickets?.filter(t => 
    statusFilter === "all" ? true : t.status === statusFilter
  );

  const handleStatusChange = (id: number, newStatus: string) => {
    updateMutation.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSupportTicketsQueryKey() });
          toast({ title: "Ticket status updated" });
        }
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'open': return <Badge className="bg-rose-100 text-rose-800 border-0">Открыто</Badge>;
      case 'in_progress': return <Badge className="bg-amber-100 text-amber-800 border-0">В работе</Badge>;
      case 'resolved': return <Badge className="bg-emerald-100 text-emerald-800 border-0">Решено</Badge>;
      case 'closed': return <Badge variant="outline" className="text-muted-foreground">Закрыто</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Поддержка</h1>
          <p className="text-muted-foreground text-sm mt-1">Обращения пользователей и отчёты об оборудовании</p>
        </div>
      </div>

      <div className="px-8 pb-4 flex gap-4 shrink-0">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] bg-white dark:bg-card border-none shadow-sm">
            <SelectValue placeholder="Фильтр статуса" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все обращения</SelectItem>
            <SelectItem value="open">Открытые (нужно действие)</SelectItem>
            <SelectItem value="in_progress">В работе</SelectItem>
            <SelectItem value="resolved">Решено</SelectItem>
            <SelectItem value="closed">Закрыто</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 px-8 pb-8 overflow-hidden">
        <Card className="h-full border-none shadow-sm bg-white dark:bg-card flex flex-col">
          <div className="flex-1 overflow-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-none">
                  <TableHead className="font-semibold w-[100px]">ID обращения</TableHead>
                  <TableHead className="font-semibold w-[300px]">Тема / Сообщение</TableHead>
                  <TableHead className="font-semibold">Пользователь</TableHead>
                  <TableHead className="font-semibold">Создано</TableHead>
                  <TableHead className="font-semibold text-right w-[180px]">Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Загрузка…</TableCell></TableRow>
                ) : filteredTickets?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Обращения не найдены.</TableCell></TableRow>
                ) : (
                  filteredTickets?.map((ticket) => (
                    <TableRow key={ticket.id} className="border-b border-border/50 hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{String(ticket.id).padStart(5, '0')}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{ticket.subject}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-[400px]">
                          {ticket.message}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {ticket.user_email || 'Anonymous'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(ticket.created_at), "d MMM, HH:mm", { locale: ru })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select 
                          value={ticket.status} 
                          onValueChange={(v) => handleStatusChange(ticket.id, v)}
                        >
                          <SelectTrigger className="w-full h-8 border-none shadow-none bg-transparent hover:bg-muted focus:ring-0 px-2 [&>span]:flex [&>span]:items-center [&>span]:w-full [&>span]:justify-end">
                            <SelectValue>{getStatusBadge(ticket.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="open">Открыто</SelectItem>
                            <SelectItem value="in_progress">В работе</SelectItem>
                            <SelectItem value="resolved">Решено</SelectItem>
                            <SelectItem value="closed">Закрыто</SelectItem>
                          </SelectContent>
                        </Select>
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
