import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="text-center space-y-6 p-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-foreground">Sales Management App</h1>
          <p className="text-xl text-muted-foreground">Streamline your sales operations</p>
        </div>
        <Button 
          onClick={() => navigate("/auth")} 
          size="lg"
          className="mt-8"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Index;
