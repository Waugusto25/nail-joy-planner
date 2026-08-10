import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";

export type CatalogRow = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
};

/** Edição completa do catálogo: título, capa, link, descrição e status. */
export function CatalogEditDialog({ catalog }: { catalog: CatalogRow }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: catalog.title,
    url: catalog.url,
    description: catalog.description ?? "",
    image_url: catalog.image_url ?? "",
    active: catalog.active,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: catalog.title,
      url: catalog.url,
      description: catalog.description ?? "",
      image_url: catalog.image_url ?? "",
      active: catalog.active,
    });
  }, [open, catalog]);

  async function save() {
    if (!/^https?:\/\//.test(form.url.trim())) {
      toast.error("Informe um link válido começando com https://");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("catalogs")
      .update({
        title: form.title.trim() || "Catálogo",
        url: form.url.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        active: form.active,
      })
      .eq("id", catalog.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as alterações.");
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Catálogo atualizado.");
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
          <DialogTitle>Editar catálogo</DialogTitle>
          <DialogDescription>
            Atualize a capa, o link da revista virtual e os textos sem precisar apagar o catálogo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-edit-title">Nome/Título</Label>
            <Input
              id="cat-edit-title"
              value={form.title}
              maxLength={80}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-edit-image">Link da foto de capa</Label>
            <Input
              id="cat-edit-image"
              value={form.image_url}
              maxLength={500}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-edit-url">Link do PDF / revista virtual</Label>
            <Input
              id="cat-edit-url"
              value={form.url}
              maxLength={500}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-edit-desc">Descrição</Label>
            <Input
              id="cat-edit-desc"
              value={form.description}
              maxLength={200}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{form.active ? "Ativo (visível para as clientes)" : "Inativo (oculto)"}</span>
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
              aria-label="Status do catálogo"
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