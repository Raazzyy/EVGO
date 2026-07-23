import React, { useState } from "react";
import { 
  useGetSessions,
  useStopSession,
  getGetSessionsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, Zap, MapPin, StopCircle } from "lucide-react";
import { formatUzs } from "@/lib/formatUzs";
import { useToast } from "@/hooks/use-toast";

export default function Sessions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: sessions, isLoading } = useGetSessions(statusFilter !== "all" ? { status: statusFilter as any } : undefined);
  const stopMutation = useStopSession();

  const handleStop = (id: number) => {
    if (confirm("Force stop this active charging session?")) {
      stopMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
            toast({ title: "Session stopped successfully" });
          }
        }
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return <Badge className="bg-blue-100 text-blue-800 border-0">Charging</Badge>;
      case 'completed': return <Badge className="bg-emerald-100 text-emerald-800 border-0">Completed</Badge>;
      case 'cancelled': return <Badge className="bg-rose-100 text-rose-800 border-0">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDuration = (start: string, end?: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const mins = Math.floor((endTime - startTime) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Charging Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">Live transaction log and historical records</p>
        </div>
      </div>

      <div className="px-8 pb-4 flex gap-4 shrink-0">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] bg-white dark:bg-card border-none shadow-sm">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            <SelectItem value="active">Active (Charging)</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled/Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 px-8 pb-8 overflow-hidden">
        <Card className="h-full border-none shadow-sm bg-white dark:bg-card flex flex-col">
          <div className="flex-1 overflow-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-none">
                  <TableHead className="font-semibold w-[250px]">Station</TableHead>
                  <TableHead className="font-semibold">User ID</TableHead>
                  <TableHead className="font-semibold">Start Time</TableHead>
                  <TableHead className="font-semibold text-right">Duration</TableHead>
                  <TableHead className="font-semibold text-right">Energy / Cost</TableHead>
                  <TableHead className="font-semibold text-center w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : sessions?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sessions found.</TableCell></TableRow>
                ) : (
                  sessions?.map((session) => (
                    <TableRow key={session.id} className="border-b border-border/50 hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium text-sm text-foreground flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {session.station?.name || `Station #${session.station_id}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Connector: {session.connector_type || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {session.user_id ? session.user_id.split('-')[0] : 'Guest'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(session.started_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm font-medium">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {getDuration(session.started_at, session.ended_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {session.status === 'active' ? (
                          <span className="text-xs text-muted-foreground italic flex items-center justify-end gap-1"><Zap className="h-3 w-3 animate-pulse text-blue-500"/> Metering...</span>
                        ) : (
                          <>
                            <div className="text-sm font-medium">{session.energy_kwh?.toFixed(2)} кВт·ч</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{formatUzs(session.cost ?? 0)}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(session.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        {session.status === 'active' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleStop(session.id)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 h-8"
                          >
                            <StopCircle className="h-4 w-4 mr-1" /> Stop
                          </Button>
                        )}
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
