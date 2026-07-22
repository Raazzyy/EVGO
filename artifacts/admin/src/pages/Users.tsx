import React from "react";
import { useGetUsers } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Search, Mail, Phone, Leaf } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Users() {
  const { data: users, isLoading } = useGetUsers();
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredUsers = users?.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8FA] dark:bg-background overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage app users and membership tiers</p>
        </div>
      </div>

      <div className="px-8 pb-4 flex gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by email or name..." 
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
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Tier</TableHead>
                  <TableHead className="font-semibold text-right">Sessions</TableHead>
                  <TableHead className="font-semibold text-right">Total Energy</TableHead>
                  <TableHead className="font-semibold text-right">Total Spent</TableHead>
                  <TableHead className="font-semibold text-right">Impact</TableHead>
                  <TableHead className="font-semibold text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filteredUsers?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
                ) : (
                  filteredUsers?.map((user) => (
                    <TableRow key={user.id} className="border-b border-border/50 hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium">{user.name || 'Unnamed User'}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
                          {user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {user.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.membership_tier === 'premium' ? (
                          <Badge className="bg-violet-100 text-violet-800 border-0">Premium</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Basic</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {user.total_sessions || 0}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {(user.total_energy_kwh || 0).toFixed(1)} kWh
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ${(user.total_spent || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-emerald-600 font-medium">
                          <Leaf className="h-3 w-3" />
                          {(user.co2_saved_kg || 0).toFixed(1)} kg
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {user.created_at ? format(new Date(user.created_at), "MMM yyyy") : '-'}
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
