import { useState } from "react";
import { Car, CheckCircle, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface ManualVehicle {
  id: number;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  connector_type: string;
  battery_kwh: number;
  range_km: number;
  user_id: string | null;
  body_style: string | null;
  vehicle_type: string | null;
  is_verified: boolean;
  data_source: string;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem("admin_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return null as T;
  return res.json();
}

const CONNECTOR_COLORS: Record<string, string> = {
  CCS2:    "bg-blue-100 text-blue-700",
  CHAdeMO: "bg-orange-100 text-orange-700",
  Type2:   "bg-green-100 text-green-700",
  "GB-T":  "bg-purple-100 text-purple-700",
};

export default function Vehicles() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: manualVehicles = [], isLoading, refetch } = useQuery<ManualVehicle[]>({
    queryKey: ["admin", "vehicles", "manual"],
    queryFn: () => apiFetch<ManualVehicle[]>("/api/admin/vehicles/manual"),
    refetchInterval: 30_000,
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) => apiFetch<ManualVehicle>(`/api/admin/vehicles/${id}/verify`, { method: "PATCH" }),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["admin", "vehicles"] });
      toast({ title: "Verified", description: `${v.name} has been verified and made public.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch<null>(`/api/vehicles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "vehicles"] });
      toast({ title: "Deleted", description: "Vehicle removed." });
      setDeletingId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicles</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Review user-submitted vehicles and verify or remove them
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl">{manualVehicles.filter(v => !v.is_verified).length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting admin verification</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Manual</CardDescription>
            <CardTitle className="text-3xl">{manualVehicles.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All user-submitted records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connectors</CardDescription>
            <CardTitle className="text-3xl">
              {new Set(manualVehicles.map(v => v.connector_type)).size}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Unique connector types</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            User-Submitted Vehicles
          </CardTitle>
          <CardDescription>
            These vehicles were added manually by users. Verify them to make them visible in the global dataset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : manualVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-sm">No pending submissions — all caught up!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Connector</TableHead>
                  <TableHead className="text-right">Battery</TableHead>
                  <TableHead className="text-right">Range</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualVehicles.map(v => (
                  <TableRow key={v.id} className={v.is_verified ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      <div>{v.name}</div>
                      {(v.make || v.year) && (
                        <div className="text-xs text-muted-foreground">{[v.make, v.model, v.year].filter(Boolean).join(" ")}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CONNECTOR_COLORS[v.connector_type] ?? "bg-gray-100 text-gray-700"}`}>
                        {v.connector_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{v.battery_kwh} кВт·ч</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Math.round(v.range_km)} км</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.body_style ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{v.user_id ?? "anonymous"}</TableCell>
                    <TableCell>
                      {v.is_verified ? (
                        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 gap-1">
                          <CheckCircle className="h-3 w-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
                          <AlertTriangle className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!v.is_verified && (
                          <Button
                            size="sm" variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50 gap-1 h-7 px-2"
                            onClick={() => verifyMutation.mutate(v.id)}
                            disabled={verifyMutation.isPending}
                          >
                            <CheckCircle className="h-3 w-3" /> Verify
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 h-7 px-2" onClick={() => setDeletingId(v.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove <strong>{v.name}</strong> from the database.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate(v.id)}
                                disabled={deleteMutation.isPending}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
