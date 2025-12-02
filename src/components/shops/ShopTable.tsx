import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Mail, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";

interface ShopTableProps {
  shops: any[];
  onEdit: (shop: any) => void;
  isAdmin: boolean;
  onRefetch: () => void;
}

export const ShopTable = ({ shops, onEdit, isAdmin, onRefetch }: ShopTableProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast({
        title: "Success",
        description: "Shop deleted successfully",
      });
      setDeleteId(null);
      onRefetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete shop",
        variant: "destructive",
      });
      setDeleteId(null);
    },
  });

  if (shops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No shops found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add your first customer shop to get started
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {shops.map((shop) => (
          <Card key={shop.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-base">{shop.name}</h3>
                  {shop.owner_name && (
                    <p className="text-sm text-muted-foreground">{shop.owner_name}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(shop)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteId(shop.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {shop.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <a href={`tel:${shop.phone}`} className="hover:text-primary">
                      {shop.phone}
                    </a>
                  </div>
                )}
                {shop.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <a href={`mailto:${shop.email}`} className="hover:text-primary truncate">
                      {shop.email}
                    </a>
                  </div>
                )}
                {(shop.street_address || shop.city || shop.state) && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      {shop.street_address && <div>{shop.street_address}</div>}
                      {shop.street_address_line_2 && <div>{shop.street_address_line_2}</div>}
                      {(shop.city || shop.state || shop.zip_code) && (
                        <div>{[shop.city, shop.state, shop.zip_code].filter(Boolean).join(", ")}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.map((shop) => (
              <TableRow key={shop.id}>
                <TableCell className="font-medium">{shop.name}</TableCell>
                <TableCell>{shop.owner_name || "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    {shop.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{shop.phone}</span>
                      </div>
                    )}
                    {shop.email && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{shop.email}</span>
                      </div>
                    )}
                    {!shop.phone && !shop.email && "-"}
                  </div>
                </TableCell>
                <TableCell>
                  {(shop.street_address || shop.city || shop.state) ? (
                    <div className="flex items-start gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <div className="line-clamp-2">
                        {shop.street_address && <div>{shop.street_address}</div>}
                        {shop.street_address_line_2 && <div>{shop.street_address_line_2}</div>}
                        {(shop.city || shop.state || shop.zip_code) && (
                          <div>
                            {[shop.city, shop.state, shop.zip_code].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(shop)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(shop.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shop</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shop? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
