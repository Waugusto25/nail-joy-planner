import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-client";
import { catalogsGreetingMessage, formatPhone, onlyDigits, whatsappLinkTo } from "@/lib/salon";
import { fetchActiveCatalogs, fetchStoreClients, type StoreClient } from "@/lib/store";

type ClientForm = { full_name: string; phone: string; nickname: string; notes: string };

const EMPTY: ClientForm = { full_name: "", phone: "", nickname: "", notes: "" };

export function StoreClientsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClientForm>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const clients = useQuery({ queryKey: ["store-clients"], queryFn: fetchStoreClients });
  const catalogs = useQuery({ queryKey: ["store-catalog-links"], queryFn: fetchActiveCatalogs });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = clients.data ?? [];
    if (!term) return list;
    return list.filter((c) =>
      `${c.full_name} ${c.nickname ?? ""} ${c.phone}`.toLowerCase().includes(term),
    );
  }, [clients.data, search]);

  function set<K extends keyof ClientForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.full_name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      phone: onlyDigits(form.phone),
      nickname: form.nickname.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("store_clients").update(payload).eq("id", editingId)
      : await supabase.from("store_clients").insert(payload);
    if (error) {
      toast.error("Não foi possível salvar o cliente da loja.");
      return;
    }
    toast.success(editingId ? "Cliente atualizado." : "Cliente cadastrado na loja.");
    setForm(EMPTY);
    setEditingId(null);
    await queryClient.invalidateQueries({ queryKey: ["store-clients"] });
  }

  async function remove(client: StoreClient) {
    if (!window.confirm(`Excluir ${client.full_name} da lista da loja?`)) return;
    const { error } = await supabase.from("store_clients").delete().eq("id", client.id);
    if (error) {
      toast.error("Não foi possível excluir. Verifique se há pedidos vinculados.");
      return;
    }
    if (editingId === client.id) {
      setEditingId(null);
      setForm(EMPTY);
    }
    await queryClient.invalidateQueries({ queryKey: ["store-clients"] });
  }

  function openWhatsapp(client: StoreClient) {
    const link = whatsappLinkTo(client.phone, catalogsGreetingMessage(catalogs.data ?? []));
    if (!link) {
      toast.error("Cadastre um telefone válido para enviar a mensagem.");
      return;
    }
    window.open(link, "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <section className="surface-card space-y-3 p-5">
        <h3 className="font-display text-lg">
          {editingId ? "Editar cliente da loja" : "Novo cliente da loja"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sc-name">Nome</Label>
            <Input
              id="sc-name"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Ex: João Pereira"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-phone">WhatsApp</Label>
            <Input
              id="sc-phone"
              inputMode="numeric"
              maxLength={13}
              value={form.phone}
              onChange={(e) => set("phone", onlyDigits(e.target.value))}
              placeholder="35999999999"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-nickname">Apelido (uso interno)</Label>
            <Input
              id="sc-nickname"
              maxLength={80}
              value={form.nickname}
              onChange={(e) => set("nickname", e.target.value)}
              placeholder="Ex: Vizinho da praça"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-notes">Observações</Label>
            <Textarea
              id="sc-notes"
              maxLength={280}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()}>
            {editingId ? "Salvar alterações" : "Cadastrar cliente"}
          </Button>
          {editingId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
            >
              Cancelar edição
            </Button>
          ) : null}
        </div>
      </section>

      <div className="space-y-1">
        <Label htmlFor="sc-search">Buscar cliente</Label>
        <Input
          id="sc-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, apelido ou telefone"
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente da loja cadastrado ainda.</p>
      ) : (
        rows.map((c) => (
          <article key={c.id} className="surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg">{c.full_name}</p>
                {c.nickname ? (
                  <p className="text-xs font-medium text-primary">Apelido: {c.nickname}</p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {c.phone ? formatPhone(c.phone) : "Sem telefone"}
                </p>
                {c.notes ? <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={() => openWhatsapp(c)}
                >
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(c.id);
                    setForm({
                      full_name: c.full_name,
                      phone: c.phone ?? "",
                      nickname: c.nickname ?? "",
                      notes: c.notes ?? "",
                    });
                  }}
                >
                  Editar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void remove(c)}>
                  Excluir
                </Button>
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
