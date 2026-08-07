import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useSession";
import { adminUpdateClientFn } from "@/lib/auth.functions";
import {
  APPOINTMENT_STATUS,
  WEEKDAYS,
  formatDayLabel,
  formatPhone,
  formatPrice,
  onlyDigits,
  shortTime,
  whatsappLinkTo,
} from "@/lib/salon";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — Jannah Nails" },
      {
        name: "description",
        content: "Gestão de clientes, agenda, serviços, loja e catálogos da Jannah Nails.",
      },
      { property: "og:title", content: "Painel administrativo — Jannah Nails" },
      { property: "og:description", content: "Gestão completa do studio Jannah Nails." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPanel,
});

function AdminPanel() {
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();
  const isAdmin = profile.data?.isAdmin;

  useEffect(() => {
    if (profile.data && !isAdmin) void navigate({ to: "/painel", replace: true });
  }, [profile.data, isAdmin, navigate]);

  if (!isAdmin) {
    return (
      <div className="bg-petal min-h-screen">
        <AppHeader title="Painel administrativo" />
        <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="bg-petal min-h-screen pb-16">
      <AppHeader title="Painel administrativo" subtitle="Janaina Silva" />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <Tabs defaultValue="agenda">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="horarios">Horários</TabsTrigger>
            <TabsTrigger value="loja">Loja</TabsTrigger>
            <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
          </TabsList>
          <TabsContent value="agenda" className="pt-6">
            <AgendaTab />
          </TabsContent>
          <TabsContent value="clientes" className="pt-6">
            <ClientsTab />
          </TabsContent>
          <TabsContent value="servicos" className="pt-6">
            <ServicesTab />
          </TabsContent>
          <TabsContent value="horarios" className="pt-6">
            <SlotsTab />
          </TabsContent>
          <TabsContent value="loja" className="pt-6">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="catalogos" className="pt-6">
            <CatalogsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AgendaTab() {
  const queryClient = useQueryClient();
  const appointments = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(name)")
        .order("day", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const clients = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    toast.success("Agendamento atualizado.");
    await queryClient.invalidateQueries();
  }

  const rows = appointments.data ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>;

  return (
    <div className="space-y-3">
      {rows.map((a) => {
        const client = (clients.data ?? []).find((c) => c.id === a.client_id) ?? null;
        return (
          <article key={a.id} className="surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg">{client?.full_name ?? "Cliente"}</p>
                <p className="text-sm capitalize text-muted-foreground">
                  {formatDayLabel(a.day)} · {shortTime(a.start_time)} ·{" "}
                  {(a.services as { name: string } | null)?.name}
                </p>
                <p className="text-sm">
                  {formatPrice(a.price_cents)} {a.discount_applied ? "· fidelidade -20%" : ""}
                </p>
                {client ? (
                  <p className="text-xs text-muted-foreground">
                    {formatPhone(client.phone)} · ID {client.login_id}
                  </p>
                ) : null}
              </div>
              <Badge variant="secondary">{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void setStatus(a.id, "confirmado")}>
                Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => void setStatus(a.id, "concluido")}>
                Concluir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void setStatus(a.id, "cancelado")}>
                Cancelar
              </Button>
              {client && whatsappLinkTo(client.phone, "") ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      whatsappLinkTo(
                        client.phone,
                        `Olá, ${client.full_name}! Seu horário de ${(a.services as { name: string } | null)?.name} em ${formatDayLabel(a.day)} às ${shortTime(a.start_time)} está confirmado. — Jannah Nails`,
                      )!,
                      "_blank",
                      "noopener",
                    )
                  }
                >
                  WhatsApp
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
      <BlockedDates />
    </div>
  );
}

function BlockedDates() {
  const queryClient = useQueryClient();
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const blocked = useQuery({
    queryKey: ["admin-blocked"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocked_dates").select("*").order("day");
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    if (!day) return;
    const { error } = await supabase.from("blocked_dates").insert({ day, reason: reason || null });
    if (error) {
      toast.error("Não foi possível bloquear essa data.");
      return;
    }
    setDay("");
    setReason("");
    await queryClient.invalidateQueries();
  }

  async function remove(id: string) {
    await supabase.from("blocked_dates").delete().eq("id", id);
    await queryClient.invalidateQueries();
  }

  return (
    <section className="surface-card p-5">
      <h2 className="font-display text-lg">Datas indisponíveis</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="block-day">Data</Label>
          <Input id="block-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="block-reason">Motivo</Label>
          <Input
            id="block-reason"
            value={reason}
            maxLength={80}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Folga"
          />
        </div>
        <Button onClick={() => void add()}>Bloquear</Button>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {(blocked.data ?? []).map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3">
            <span className="capitalize">
              {formatDayLabel(b.day)} {b.reason ? `· ${b.reason}` : ""}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void remove(b.id)}>
              Remover
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClientsTab() {
  const queryClient = useQueryClient();
  const clients = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  async function save(clientId: string) {
    try {
      await adminUpdateClientFn({ data: { clientId, phone } });
      toast.success("Telefone e senha da cliente atualizados.");
      setEditing(null);
      await queryClient.invalidateQueries();
    } catch {
      toast.error("Não foi possível atualizar.");
    }
  }

  return (
    <div className="space-y-3">
      {(clients.data ?? []).map((c) => (
        <article key={c.id} className="surface-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg">{c.full_name}</p>
              <p className="text-sm text-muted-foreground">
                ID {c.login_id} · {formatPhone(c.phone)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!whatsappLinkTo(c.phone, "")}
                onClick={() =>
                  window.open(
                    whatsappLinkTo(
                      c.phone,
                      `Olá, ${c.full_name}! Aqui é a Janaina da Jannah Nails.`,
                    )!,
                    "_blank",
                    "noopener",
                  )
                }
              >
                WhatsApp
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(editing === c.id ? null : c.id);
                  setPhone(c.phone);
                }}
              >
                Editar telefone
              </Button>
            </div>
          </div>
          {editing === c.id ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor={`phone-${c.id}`}>Novo telefone (nova senha)</Label>
                <Input
                  id={`phone-${c.id}`}
                  inputMode="numeric"
                  maxLength={13}
                  value={phone}
                  onChange={(e) => setPhone(onlyDigits(e.target.value))}
                />
              </div>
              <Button onClick={() => void save(c.id)}>Salvar</Button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ServicesTab() {
  const queryClient = useQueryClient();
  const services = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  async function update(
    id: string,
    patch: { price_cents?: number; duration_minutes?: number; active?: boolean },
  ) {
    const { error } = await supabase.from("services").update(patch).eq("id", id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    await queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-3">
      {(services.data ?? []).map((s) => (
        <article key={s.id} className="surface-card flex flex-wrap items-end gap-4 p-4">
          {s.image_url ? (
            <img src={s.image_url} alt={s.name} className="h-20 w-20 rounded-xl object-cover" />
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`price-${s.id}`}>{s.name} — preço (R$)</Label>
            <Input
              id={`price-${s.id}`}
              defaultValue={(s.price_cents / 100).toFixed(2)}
              onBlur={(e) =>
                void update(s.id, {
                  price_cents: Math.round(Number(e.target.value.replace(",", ".")) * 100) || s.price_cents,
                })
              }
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`dur-${s.id}`}>Duração (min)</Label>
            <Input
              id={`dur-${s.id}`}
              defaultValue={s.duration_minutes}
              onBlur={(e) =>
                void update(s.id, { duration_minutes: Number(e.target.value) || s.duration_minutes })
              }
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`active-${s.id}`}
              checked={s.active}
              onCheckedChange={(checked) => void update(s.id, { active: checked })}
            />
            <Label htmlFor={`active-${s.id}`}>Ativo</Label>
          </div>
        </article>
      ))}
    </div>
  );
}

function SlotsTab() {
  const queryClient = useQueryClient();
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState("09:00");
  const slots = useQuery({
    queryKey: ["admin-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("*")
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    const { error } = await supabase
      .from("schedule_slots")
      .insert({ weekday, start_time: `${time}:00` });
    if (error) {
      toast.error("Esse horário já existe.");
      return;
    }
    await queryClient.invalidateQueries();
  }

  async function remove(id: string) {
    await supabase.from("schedule_slots").delete().eq("id", id);
    await queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-5">
      <section className="surface-card flex flex-wrap items-end gap-3 p-5">
        <div className="space-y-1">
          <Label htmlFor="slot-weekday">Dia da semana</Label>
          <select
            id="slot-weekday"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {WEEKDAYS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="slot-time">Horário</Label>
          <Input id="slot-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Button onClick={() => void add()}>Adicionar horário</Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WEEKDAYS.map((label, index) => {
          const rows = (slots.data ?? []).filter((s) => s.weekday === index);
          return (
            <section key={label} className="surface-card p-4">
              <p className="font-display text-lg">{label}</p>
              {rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sem atendimento.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {rows.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>{shortTime(s.start_time)}</span>
                      <Button variant="ghost" size="sm" onClick={() => void remove(s.id)}>
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ProductsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    category: "esmalte",
    price: "",
    description: "",
    image_url: "",
  });
  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome do produto.");
      return;
    }
    const { error } = await supabase.from("products").insert({
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0,
    });
    if (error) {
      toast.error("Não foi possível cadastrar.");
      return;
    }
    setForm({ name: "", category: "esmalte", price: "", description: "", image_url: "" });
    await queryClient.invalidateQueries();
  }

  async function remove(id: string) {
    await supabase.from("products").delete().eq("id", id);
    await queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-5">
      <section className="surface-card grid gap-3 p-5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="p-name">Produto</Label>
          <Input
            id="p-name"
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-category">Categoria</Label>
          <select
            id="p-category"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="esmalte">Esmalte</option>
            <option value="perfume">Perfume</option>
            <option value="bijuteria">Bijuteria</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-price">Preço (R$)</Label>
          <Input
            id="p-price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="25,00"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-image">Link da foto</Label>
          <Input
            id="p-image"
            value={form.image_url}
            maxLength={500}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="p-desc">Descrição</Label>
          <Textarea
            id="p-desc"
            value={form.description}
            maxLength={400}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <Button className="sm:col-span-2" onClick={() => void add()}>
          Cadastrar produto
        </Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(products.data ?? []).map((p) => (
          <article key={p.id} className="surface-card overflow-hidden">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-32 w-full object-cover" />
            ) : null}
            <div className="space-y-2 p-4">
              <Badge variant="secondary">{p.category}</Badge>
              <p className="font-display text-lg">{p.name}</p>
              <p className="text-sm">{formatPrice(p.price_cents)}</p>
              <Button variant="ghost" size="sm" onClick={() => void remove(p.id)}>
                Remover
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CatalogsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", url: "", description: "", image_url: "" });
  const catalogs = useQuery({
    queryKey: ["admin-catalogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    if (!/^https?:\/\//.test(form.url)) {
      toast.error("Informe um link válido começando com https://");
      return;
    }
    const { error } = await supabase.from("catalogs").insert({
      title: form.title.trim() || "Catálogo",
      url: form.url.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
    });
    if (error) {
      toast.error("Não foi possível cadastrar.");
      return;
    }
    setForm({ title: "", url: "", description: "", image_url: "" });
    await queryClient.invalidateQueries();
  }

  async function remove(id: string) {
    await supabase.from("catalogs").delete().eq("id", id);
    await queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-5">
      <section className="surface-card grid gap-3 p-5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="c-title">Título</Label>
          <Input
            id="c-title"
            value={form.title}
            maxLength={80}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Revista Parceira"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-url">Link do catálogo</Label>
          <Input
            id="c-url"
            value={form.url}
            maxLength={500}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-image">Link da capa</Label>
          <Input
            id="c-image"
            value={form.image_url}
            maxLength={500}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-desc">Descrição</Label>
          <Input
            id="c-desc"
            value={form.description}
            maxLength={200}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <Button className="sm:col-span-2" onClick={() => void add()}>
          Publicar catálogo
        </Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {(catalogs.data ?? []).map((c) => (
          <article key={c.id} className="surface-card p-4">
            <p className="font-display text-lg">{c.title}</p>
            <p className="break-all text-xs text-muted-foreground">{c.url}</p>
            <Button variant="ghost" size="sm" onClick={() => void remove(c.id)}>
              Remover
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}