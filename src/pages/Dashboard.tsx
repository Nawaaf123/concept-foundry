import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingBag, FileText, DollarSign } from "lucide-react";

const Dashboard = () => {
  const stats = [
    {
      title: "Total Products",
      value: "0",
      icon: Package,
      description: "Active products in catalog",
    },
    {
      title: "Total Shops",
      value: "0",
      icon: ShoppingBag,
      description: "Customer shops registered",
    },
    {
      title: "Total Invoices",
      value: "0",
      icon: FileText,
      description: "Invoices created this month",
    },
    {
      title: "Total Revenue",
      value: "$0",
      icon: DollarSign,
      description: "Revenue this month",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Welcome to your sales management dashboard</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Welcome to your Sales Management Application! Here's what you can do:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Manage your product catalog</li>
              <li>Track customer shops and their information</li>
              <li>Create and manage invoices</li>
              <li>Monitor sales and revenue</li>
              <li>Manage user roles and permissions</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
