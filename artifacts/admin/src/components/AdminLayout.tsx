import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Zap, 
  LayoutDashboard, 
  MapPin, 
  Briefcase, 
  BatteryCharging, 
  Users, 
  LifeBuoy, 
  Car,
  LogOut,
  Tag,
  Image,
  TrendingUp,
  Wallet as WalletIcon,
  Flag,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token && location !== "/login") {
      setLocation("/login");
    }
  }, [location, setLocation]);

  if (location === "/login") {
    return <>{children}</>;
  }

  const navItems = [
    { label: "Dashboard",    icon: LayoutDashboard, path: "/" },
    { label: "Финансы",      icon: TrendingUp,      path: "/finance" },
    { label: "Кошельки",     icon: WalletIcon,      path: "/wallet" },
    { label: "Станции",      icon: MapPin,           path: "/stations" },
    { label: "Жалобы",       icon: Flag,             path: "/station-reports" },
    { label: "Операторы",    icon: Briefcase,        path: "/operators" },
    { label: "Сессии",       icon: BatteryCharging,  path: "/sessions" },
    { label: "Пользователи", icon: Users,            path: "/users" },
    { label: "Промо",        icon: Tag,              path: "/promos" },
    { label: "Баннеры",      icon: Image,            path: "/banners" },
    { label: "Автомобили",   icon: Car,              path: "/vehicles" },
    { label: "Поддержка",    icon: LifeBuoy,         path: "/support" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setLocation("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar">
            <div className="flex items-center gap-2 text-sidebar-foreground">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">VoltAdmin</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.path} className="flex items-center gap-3">
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-2 border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
