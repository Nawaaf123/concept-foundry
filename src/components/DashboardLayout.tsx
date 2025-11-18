import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Package, ShoppingBag, FileText, Users, LayoutDashboard } from "lucide-react";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Package, label: "Products", path: "/products" },
    { icon: ShoppingBag, label: "Shops", path: "/shops" },
    { icon: FileText, label: "Invoices", path: "/invoices" },
    { icon: Users, label: "Users", path: "/users" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-primary">Sales Manager</h1>
            <nav className="hidden md:flex gap-6">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
