import React, { useState } from "react";
import { 
  useGetOperators,
  useCreateOperator,
  useUpdateOperator,
  useDeleteOperator,
  getGetOperatorsQueryKey,
  Operator
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Briefcase, Trash2, Edit2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Operators() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: operators, isLoading } = useGetOperators();
  const createMutation = useCreateOperator();
  const updateMutation = useUpdateOperator();
  const deleteMutation = useDeleteOperator();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    logo_url: ""
  });

  const handleDelete = (id: number) => {
    if (confirm("Delete this operator? Stations belonging to this operator will become independent.")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetOperatorsQueryKey() });
            toast({ title: "Operator deleted" });
          }
        }
      );
    }
  };

  const openNewForm = () => {
    setEditingOperator(null);
    setFormData({ name: "", logo_url: "" });
    setIsFormOpen(true);
  };

  const openEditForm = (operator: Operator) => {
    setEditingOperator(operator);
    setFormData({
      name: operator.name,
      logo_url: operator.logo_url || ""
    });
    setIsFormOpen(true);
  };

  const submitForm = () => {
    const payload = {
      name: formData.name,
      logo_url: formData.logo_url || null
    };

    if (editingOperator) {
      updateMutation.mutate(
        { id: editingOperator.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetOperatorsQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Operator updated" });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetOperatorsQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Operator created" });
          }
        }
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Network Operators</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage partner charging networks and brands</p>
        </div>
        <Button onClick={openNewForm} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Add Operator
        </Button>
      </div>

      <div className="flex-1 px-8 pb-8 overflow-hidden mt-4">
        <Card className="h-full border-none shadow-sm bg-white dark:bg-card flex flex-col">
          <div className="flex-1 overflow-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-none">
                  <TableHead className="font-semibold w-[300px]">Operator Brand</TableHead>
                  <TableHead className="font-semibold text-right">Stations Owned</TableHead>
                  <TableHead className="font-semibold text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : operators?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No operators found.</TableCell></TableRow>
                ) : (
                  operators?.map((op) => (
                    <TableRow key={op.id} className="border-b border-border/50 hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-4">
                          {op.logo_url ? (
                            <img src={op.logo_url} alt={op.name} className="w-10 h-10 rounded-md object-contain bg-white border" />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                              <Briefcase className="h-5 w-5" />
                            </div>
                          )}
                          <span className="font-medium text-base">{op.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="font-semibold text-foreground">{op.station_count || 0}</span> stations
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(op)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(op.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingOperator ? "Edit Operator" : "Add Operator"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. ChargePoint" 
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL (optional)</Label>
              <Input 
                value={formData.logo_url} 
                onChange={e => setFormData({...formData, logo_url: e.target.value})} 
                placeholder="https://example.com/logo.png" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} className="bg-primary hover:bg-primary/90">
              {editingOperator ? "Save Changes" : "Create Operator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
