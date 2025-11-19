import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Package, ShoppingBag, FileText, Users, LayoutDashboard, BarChart3, TrendingUp } from "lucide-react";
import mrFogLogo from "@/assets/mr-fog-logo.jpg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const { data: userRole } = useQuery({
    queryKey: ["userRole", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      return data?.role;
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
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
    { icon: ShoppingBag, label: "Shops", path: "/shops" },
    { icon: FileText, label: "Invoices", path: "/invoices" },
    { icon: TrendingUp, label: "Sales Performance", path: "/sales-performance", adminOnly: true },
    { icon: Users, label: "Users", path: "/users", adminOnly: true },
  ];

  // Filter nav items based on user role
  const navItems = allNavItems.filter(item => !item.adminOnly || userRole === "admin");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <img src={mrFogLogo} alt="MR FOG" className="h-8 object-contain" />
              <span className="text-sm font-medium text-muted-foreground">Sales Manager</span>
            </div>
            <nav className="hidden md:flex gap-6">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-6">
        {children}
      </main>
    </div>
  );
};
