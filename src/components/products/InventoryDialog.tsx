import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus } from "lucide-react";

interface InventoryDialogProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InventoryDialog = ({ product, open, onOpenChange }: InventoryDialogProps) => {
  const [quantity, setQuantity] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const adjustInventoryMutation = useMutation({
    mutationFn: async ({ add }: { add: boolean }) => {
      const newQuantity = add 
        ? product.stock_quantity + quantity 
        : Math.max(0, product.stock_quantity - quantity);

      const { error } = await supabase
        .from("products")
        .update({ stock_quantity: newQuantity })
        .eq("id", product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Success",
        description: "Inventory updated successfully",
      });
      setQuantity(0);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update inventory",
        variant: "destructive",
      });
    },
  });

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Inventory - {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Current Stock:</span>
            <span className="text-2xl font-bold">{product.stock_quantity}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="Enter quantity"
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => adjustInventoryMutation.mutate({ add: true })}
              disabled={quantity === 0 || adjustInventoryMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Stock
            </Button>
            <Button
              className="flex-1"
              variant="destructive"
              onClick={() => adjustInventoryMutation.mutate({ add: false })}
              disabled={quantity === 0 || adjustInventoryMutation.isPending}
            >
              <Minus className="mr-2 h-4 w-4" />
              Remove Stock
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
