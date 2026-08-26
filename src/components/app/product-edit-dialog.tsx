import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { ProductCategoryPicker } from "@/components/app/product-category-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-client";

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  link: string | null;
  price_cents: number;
  stock_quantity: number;
  active: boolean;
};

function toForm(p: ProductRow) {
  return {
    name: p.name,
    category: p.category,
    price: (Number(p.price_cents ?? 0) / 100).toFixed(2).replace(".", ","),
    stock: String(p.stock_quantity ?? 0),
    description: p.description ?? "",
    image_url: p.image_url ?? "",
    link: p.link ?? "",
    active: p.active,
  };
}

/** Edição completa do produto da loja, sem precisar excluir e recadastrar. */
export function ProductEditDialog({ product }: { product: ProductRow }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(product));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(toForm(product));
  }, [open, product]);

  async function save() {
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Informe a marca/categoria do produto.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({
        name: form.name.trim(),
        category: form.category.trim(),
        price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0,
        stock_quantity: Math.max(0, Number(form.stock) || 0),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        link: form.link.trim() || null,
        active: form.active,
      })
      .eq("id", product.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar o produto.");
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Produto atualizado.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil size={16} /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>
            Atualize nome, foto, preço, estoque, descrição, link e marca do produto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pe-name">Nome do produto</Label>
            <Input
              id="pe-name"
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <ProductCategoryPicker
            id="pe-category"
            value={form.category}
            onChange={(category) => setForm({ ...form, category })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pe-price">Preço (R$)</Label>
              <Input
                id="pe-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe-stock">Estoque</Label>
              <Input
                id="pe-stock"
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-image">Link da foto</Label>
            <Input
              id="pe-image"
              value={form.image_url}
              maxLength={500}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-link">Link do produto</Label>
            <Input
              id="pe-link"
              value={form.link}
              maxLength={500}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-desc">Descrição</Label>
            <Textarea
              id="pe-desc"
              value={form.description}
              maxLength={400}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{form.active ? "Ativo (visível na loja)" : "Inativo (oculto)"}</span>
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
              aria-label="Status do produto"
            />
          </label>
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
