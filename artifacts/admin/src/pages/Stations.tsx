import React, { useState } from "react";
import { 
  useGetStations, 
  useGetOperators,
  useCreateStation, 
  useUpdateStation, 
  useDeleteStation, 
  useUpdateStationStatus,
  getGetStationsQueryKey,
  Station,
  StationStatusUpdateStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, MoreHorizontal, MapPin, Zap, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Stations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: stationsResponse, isLoading } = useGetStations();
  const stations: Station[] = [
    ...(stationsResponse?.promoted ?? []),
    ...(stationsResponse?.nearby ?? []),
  ];
  const { data: operators } = useGetOperators();
  
  const createMutation = useCreateStation();
  const updateMutation = useUpdateStation();
  const deleteMutation = useDeleteStation();
  const statusMutation = useUpdateStationStatus();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    lat: "0",
    lng: "0",
    power_kw: "50",
    price_per_kwh: "0.45",
    status: "free" as StationStatusUpdateStatus,
    operator_id: ""
  });

  const filteredStations = stations?.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusToggle = (id: number, newStatus: StationStatusUpdateStatus) => {
    statusMutation.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() });
          toast({ title: "Status updated" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this station?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() });
            toast({ title: "Station deleted" });
          }
        }
      );
    }
  };

  const openNewForm = () => {
    setEditingStation(null);
    setFormData({
      name: "", address: "", lat: "0", lng: "0", power_kw: "50", price_per_kwh: "0.45", status: "free", operator_id: ""
    });
    setIsFormOpen(true);
  };

  const openEditForm = (station: Station) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      address: station.address,
      lat: String(station.lat),
      lng: String(station.lng),
      power_kw: String(station.power_kw),
      price_per_kwh: String(station.price_per_kwh),
      status: station.status as StationStatusUpdateStatus,
      operator_id: station.operator_id ? String(station.operator_id) : ""
    });
    setIsFormOpen(true);
  };

  const submitForm = () => {
    const payload = {
      name: formData.name,
      address: formData.address,
      lat: Number(formData.lat),
      lng: Number(formData.lng),
      power_kw: Number(formData.power_kw),
      price_per_kwh: Number(formData.price_per_kwh),
      status: formData.status as any,
      operator_id: formData.operator_id ? Number(formData.operator_id) : undefined,
      source: "manual" as any
    };

    if (editingStation) {
      updateMutation.mutate(
        { id: editingStation.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Station updated" });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetStationsQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Station created" });
          }
        }
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'free': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none">Available</Badge>;
      case 'occupied': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 shadow-none">In Use</Badge>;
      case 'offline': return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none">Offline</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Charging Stations</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage infrastructure network and hardware status</p>
        </div>
        <Button onClick={openNewForm} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Add Station
        </Button>
      </div>

      <div className="px-8 pb-4 flex gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or address..." 
            className="pl-9 bg-white dark:bg-card border-none shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white dark:bg-card border-none shadow-sm">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="free">Available</SelectItem>
            <SelectItem value="occupied">In Use</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 px-8 pb-8 overflow-hidden">
        <Card className="h-full border-none shadow-sm bg-white dark:bg-card flex flex-col">
          <div className="flex-1 overflow-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-none">
                  <TableHead className="font-semibold">Station Name</TableHead>
                  <TableHead className="font-semibold">Operator</TableHead>
                  <TableHead className="font-semibold text-right">Power</TableHead>
                  <TableHead className="font-semibold text-right">Price</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filteredStations?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No stations found.</TableCell></TableRow>
                ) : (
                  filteredStations?.map((station) => (
                    <TableRow key={station.id} className="border-b border-border/50 hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {station.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[300px]">
                          {station.address}
                        </div>
                      </TableCell>
                      <TableCell>
                        {station.operator?.name ? (
                          <div className="flex items-center gap-2">
                            {station.operator.logo_url ? (
                              <img src={station.operator.logo_url} className="w-5 h-5 object-contain" alt="" />
                            ) : null}
                            <span className="text-sm">{station.operator.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Independent</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 font-medium text-sm">
                          <Zap className="h-3 w-3 text-amber-500" />
                          {station.power_kw} kW
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ${station.price_per_kwh.toFixed(2)}/kWh
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                              {getStatusBadge(station.status)}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-[140px]">
                            <DropdownMenuItem onClick={() => handleStatusToggle(station.id, "free")}>
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" /> Set Available
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusToggle(station.id, "occupied")}>
                              <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" /> Set In Use
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusToggle(station.id, "offline")}>
                              <div className="w-2 h-2 rounded-full bg-rose-500 mr-2" /> Set Offline
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
                            <DropdownMenuItem onClick={() => openEditForm(station)}>
                              <Edit2 className="h-4 w-4 mr-2" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => handleDelete(station.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingStation ? "Edit Station" : "Add New Station"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Downtown Fast Hub" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Address</Label>
                <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="123 Main St, City" />
              </div>
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input type="number" step="any" value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input type="number" step="any" value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Power (kW)</Label>
                <Input type="number" value={formData.power_kw} onChange={e => setFormData({...formData, power_kw: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Price per kWh ($)</Label>
                <Input type="number" step="0.01" value={formData.price_per_kwh} onChange={e => setFormData({...formData, price_per_kwh: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={formData.operator_id} onValueChange={v => setFormData({...formData, operator_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Independent (None)</SelectItem>
                    {operators?.map(op => (
                      <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Initial Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Available</SelectItem>
                    <SelectItem value="occupied">In Use</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} className="bg-primary hover:bg-primary/90">
              {editingStation ? "Save Changes" : "Create Station"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
