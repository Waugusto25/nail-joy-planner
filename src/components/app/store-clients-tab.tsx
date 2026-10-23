import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronUp, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-client";
import { catalogsGreetingMessage, formatPhone, onlyDigits, whatsappLinkTo } from "@/lib/salon";
import { StoreStatementButton } from "@/components/app/store-statement-button";
import { fetchActiveCatalogs, fetchStoreClients, type StoreClient } from "@/lib/store";
import { confirmDestructive } from "@/components/app/confirm-destructive-dialog";
import { ClientAccordionCard } from "@/components/app/client-accordion-card";

/**
 * Chave de comparação de telefone: DDD + 8 últimos dígitos. Assim (35) 99271-8433 e
 * (35) 9271-8433 (sem o 9) são o mesmo número, mas DDDs diferentes não conflitam.
 */
function phoneKey(phone: string): string | null {
  let d = onlyDigits(phone);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2); // remove código do país
  if (d.length < 10) return null;
  return `${d.slice(0, 2)}-${d.slice(-8)}`;
}

type ClientForm = { full_name: string; phone: string; nickname: string; notes: string };

const EMPTY: ClientForm = { full_name: "", phone: "", nickname: "", notes: "" };

export function StoreClientsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClientForm>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Formulário começa recolhido para a lista de clientes ficar visível sem rolar.
  const [formOpen, setFormOpen] = useState(false);

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
    // Regra: telefone já cadastrado em outra cliente gera aviso e bloqueia o duplicado.
    const key = phoneKey(form.phone);
    const dup = key
      ? (clients.data ?? []).find((c) => c.id !== editingId && phoneKey(c.phone) === key)
      : undefined;
    if (dup) {
      toast.warning(`Este telefone já está cadastrado para ${dup.full_name}. Essa cliente já existe.`);
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
    setFormOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["store-clients"] });
  }

  async function remove(client: StoreClient) {
    const ok = await confirmDestructive({
      title: "Excluir cliente da loja?",
      description: `${client.full_name} será removida da lista de clientes da loja. Pedidos já lançados continuam salvos, mas ela não aparecerá mais para novos pedidos.`,
      confirmLabel: "Excluir cliente",
    });
    if (!ok) return;
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
      {formOpen ? (
      <section className="surface-card space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg">
            {editingId ? "Editar cliente da loja" : "Novo cliente da loja"}
          </h3>
          <Button size="sm" variant="ghost" className="gap-1" aria-expanded
            onClick={() => { setFormOpen(false); setEditingId(null); setForm(EMPTY); }}>
            Recolher <ChevronUp size={16} />
          </Button>
        </div>
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
          <Button
            variant="ghost"
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY);
              setFormOpen(false);
            }}
          >
            {editingId ? "Cancelar edição" : "Cancelar"}
          </Button>
        </div>
      </section>
      ) : (
        <section className="surface-card flex items-center justify-between gap-3 px-5 py-3">
          <h3 className="font-display text-base">Novo cliente da loja</h3>
          <Button size="sm" className="gap-1" aria-expanded={false} onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Novo
          </Button>
        </section>
      )}

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
          <ClientAccordionCard
            key={c.id}
            name={c.full_name}
            nickname={c.nickname}
            phoneLabel={c.phone ? formatPhone(c.phone) : "Sem telefone"}
            whatsappHref={whatsappLinkTo(c.phone, catalogsGreetingMessage(catalogs.data ?? []))}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              {c.notes ? <p className="w-full text-xs text-muted-foreground">{c.notes}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={() => openWhatsapp(c)}
                >
                  WhatsApp
                </Button>
                <StoreStatementButton
                  clientId={c.id}
                  clientName={c.full_name}
                  clientPhone={c.phone ?? ""}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(c.id);
                    setFormOpen(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
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
          </ClientAccordionCard>
        ))
      )}
    </div>
  );
}
