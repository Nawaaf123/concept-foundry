import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const shopSchema = z.object({
  name: z.string().trim().min(1, "Shop name is required").max(100, "Name must be less than 100 characters"),
  owner_name: z.string().trim().max(100, "Owner name must be less than 100 characters").optional(),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters").optional().or(z.literal("")),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional(),
});

type ShopFormValues = z.infer<typeof shopSchema>;

interface ShopFormProps {
  shop?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ShopForm = ({ shop, onSuccess, onCancel }: ShopFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      name: shop?.name || "",
      owner_name: shop?.owner_name || "",
      phone: shop?.phone || "",
      email: shop?.email || "",
      address: shop?.address || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: ShopFormValues) => {
      const shopData = {
        name: values.name,
        owner_name: values.owner_name || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
      };

      if (shop) {
        const { error } = await supabase
          .from("shops")
          .update(shopData)
          .eq("id", shop.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shops").insert({
          ...shopData,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Shop ${shop ? "updated" : "created"} successfully`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save shop",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ShopFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shop Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter shop name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="owner_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Owner Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter owner name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1234567890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="shop@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter shop address"
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : shop ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
