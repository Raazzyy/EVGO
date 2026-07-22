import React from "react";
import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { MapPin, BatteryCharging, Users, DollarSign, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboard();

  if (isLoading || !stats) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Mock data for charts
  const mockTimeSeriesData = [
    { name: 'Mon', sessions: Math.floor(stats.sessions_today * 0.8) },
    { name: 'Tue', sessions: Math.floor(stats.sessions_today * 1.1) },
    { name: 'Wed', sessions: Math.floor(stats.sessions_today * 0.9) },
    { name: 'Thu', sessions: Math.floor(stats.sessions_today * 1.2) },
    { name: 'Fri', sessions: Math.floor(stats.sessions_today * 1.5) },
    { name: 'Sat', sessions: Math.floor(stats.sessions_today * 0.7) },
    { name: 'Sun', sessions: stats.sessions_today },
  ];

  const statusData = [
    { name: 'Free', value: stats.free_stations, color: '#10b981' },
    { name: 'Occupied', value: stats.occupied_stations, color: '#f59e0b' },
    { name: 'Offline', value: stats.offline_stations, color: '#ef4444' },
  ];

  const statCards = [
    { title: "Total Revenue", value: `$${stats.total_revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`, sub: `+$${stats.revenue_today.toLocaleString()} today`, icon: DollarSign },
    { title: "Active Sessions", value: stats.active_sessions.toLocaleString(), sub: `${stats.sessions_today} total today`, icon: BatteryCharging },
    { title: "Total Stations", value: stats.total_stations.toLocaleString(), sub: `${stats.free_stations} free right now`, icon: MapPin },
    { title: "Total Users", value: stats.total_users.toLocaleString(), sub: "Active members", icon: Users },
  ];

  return (
    <div className="flex-1 overflow-auto bg-[#F7F8FA] dark:bg-background">
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Operations Center</h1>
            <p className="text-muted-foreground mt-1">Real-time network overview</p>
          </div>
          <div className="flex items-center gap-2 text-sm bg-card px-3 py-1.5 rounded-full border shadow-sm">
            <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span className="font-medium">System Healthy</span>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, i) => (
            <Card key={i} className="shadow-sm border-none bg-white dark:bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm border-none bg-white dark:bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Sessions Over Time (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockTimeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <RechartsTooltip 
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-white dark:bg-card flex flex-col">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Station Status</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4 w-full">
                {statusData.map((s, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="text-lg font-bold mt-1">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Operators Table (if available) */}
        {stats.top_operators && stats.top_operators.length > 0 && (
          <Card className="shadow-sm border-none bg-white dark:bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Top Operators by Stations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.top_operators.map(op => (
                  <div key={op.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {op.logo_url ? (
                        <img src={op.logo_url} alt={op.name} className="w-10 h-10 rounded-md object-contain bg-white" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center font-bold text-muted-foreground">
                          {op.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium">{op.name}</span>
                    </div>
                    <div className="font-semibold">{op.station_count} stations</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
