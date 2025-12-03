import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Package, ShoppingBag, FileText, Users, LayoutDashboard, BarChart3, TrendingUp, Menu, X } from "lucide-react";
import mrFogLogo from "@/assets/mr-fog-logo.jpg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: userRole } = useQuery({
    queryKey: ["userRole", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.role || null;
    },
    enabled: !!user?.id,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const allNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Package, label: "Products", path: "/products" },
    { icon: BarChart3, label: "Analytics", path: "/analytics", adminOnly: true },
    { icon: ShoppingBag, label: "Shops", path: "/shops" },
    { icon: FileText, label: "Invoices", path: "/invoices" },
    { icon: TrendingUp, label: "Sales Performance", path: "/sales-performance", adminOnly: true },
    { icon: Users, label: "Users", path: "/users", adminOnly: true },
  ];

  // Filter nav items based on user role
  const navItems = allNavItems.filter(item => !item.adminOnly || userRole === "admin");

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const isActiveRoute = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-14 md:h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4 md:gap-8">
            {/* Mobile Menu Trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 p-4 border-b">
                    <img src={mrFogLogo} alt="MR FOG" className="h-8 object-contain" />
                    <span className="text-sm font-medium text-muted-foreground">Sales Manager</span>
                  </div>
                  <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => handleNavigation(item.path)}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md transition-colors",
                          isActiveRoute(item.path)
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </button>
                    ))}
                  </nav>
                  <div className="p-4 border-t">
                    <p className="text-xs text-muted-foreground mb-3 truncate">{user?.email}</p>
                    <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <div className="flex items-center gap-2 md:gap-3">
              <img src={mrFogLogo} alt="MR FOG" className="h-7 md:h-8 object-contain" />
              <span className="text-xs md:text-sm font-medium text-muted-foreground hidden sm:block">Sales Manager</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex gap-1 lg:gap-4">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                    isActiveRoute(item.path)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-primary hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Desktop User Info */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Sign Out */}
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="md:hidden h-9 w-9">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
};
