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
import { adminDeleteClientFn, adminUpdateClientFn } from "@/lib/auth.functions";
import { SERVICE_IMAGE_BUCKET, StorageImage } from "@/components/app/storage-image";
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
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>;

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
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
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

  async function removeClient(clientId: string, name: string) {
    if (
      !window.confirm(
        `Excluir a cliente ${name}? A conta e todos os agendamentos dela serão apagados.`,
      )
    ) {
      return;
    }
    try {
      await adminDeleteClientFn({ data: { clientId } });
      toast.success("Cliente excluída.");
      await queryClient.invalidateQueries();
    } catch {
      toast.error("Não foi possível excluir a cliente.");
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
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void removeClient(c.id, c.full_name)}
              >
                Excluir
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
  const [uploading, setUploading] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
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
    patch: {
      price_cents?: number;
      duration_minutes?: number;
      active?: boolean;
      image_url?: string;
    },
  ) {
    const { error } = await supabase.from("services").update(patch).eq("id", id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    await queryClient.invalidateQueries();
  }

  async function uploadImage(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `servicos/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(SERVICE_IMAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  }

  async function changeImage(id: string, file: File) {
    setUploading(id);
    try {
      const path = await uploadImage(file);
      await update(id, { image_url: path });
      toast.success("Foto atualizada.");
    } catch {
      toast.error("Não foi possível enviar a foto.");
    } finally {
      setUploading(null);
    }
  }

  async function createService() {
    const price = Math.round(Number(newPrice.replace(",", ".")) * 100);
    const duration = Number(newDuration);
    if (newName.trim().length < 3 || !price || !duration) {
      toast.error("Informe nome, preço e duração.");
      return;
    }
    setCreating(true);
    try {
      const image_url = newFile ? await uploadImage(newFile) : null;
      const { error } = await supabase.from("services").insert({
        name: newName.trim(),
        price_cents: price,
        duration_minutes: duration,
        image_url,
        loyalty_eligible: false,
        sort_order: 99,
      });
      if (error) throw error;
      toast.success("Procedimento avulso criado (não conta fidelidade).");
      setNewName("");
      setNewPrice("");
      setNewDuration("60");
      setNewFile(null);
      await queryClient.invalidateQueries();
    } catch {
      toast.error("Não foi possível criar o procedimento.");
    } finally {
      setCreating(false);
    }
  }

  async function removeService(id: string, name: string) {
    if (!window.confirm(`Excluir o procedimento avulso ${name}?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir (pode ter agendamentos).");
      return;
    }
    await queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-5">
      <section className="surface-card space-y-3 p-5">
        <p className="font-display text-lg">Novo procedimento avulso</p>
        <p className="text-sm text-muted-foreground">
          Procedimentos avulsos não somam pontos nem aparecem no cartão de fidelidade.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-service-name">Nome</Label>
            <Input
              id="new-service-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              placeholder="Blindagem de unhas"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-service-price">Preço (R$)</Label>
            <Input
              id="new-service-price"
              className="w-28"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="60,00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-service-duration">Duração (min)</Label>
            <Input
              id="new-service-duration"
              className="w-24"
              inputMode="numeric"
              value={newDuration}
              onChange={(e) => setNewDuration(onlyDigits(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-service-image">Foto</Label>
            <Input
              id="new-service-image"
              type="file"
              accept="image/*"
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={() => void createService()} disabled={creating}>
            {creating ? "Salvando..." : "Criar procedimento"}
          </Button>
        </div>
      </section>

      {(services.data ?? []).map((s) => (
        <article key={s.id} className="surface-card flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-2">
            <StorageImage
              url={s.image_url}
              alt={s.name}
              className="h-20 w-20 rounded-xl object-cover"
            />
            <div className="space-y-1">
              <Label htmlFor={`img-${s.id}`} className="text-xs">
                {uploading === s.id ? "Enviando foto..." : "Trocar foto"}
              </Label>
              <Input
                id={`img-${s.id}`}
                type="file"
                accept="image/*"
                className="w-52"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void changeImage(s.id, file);
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`price-${s.id}`}>{s.name} — preço (R$)</Label>
            <Input
              id={`price-${s.id}`}
              defaultValue={(s.price_cents / 100).toFixed(2)}
              onBlur={(e) =>
                void update(s.id, {
                  price_cents:
                    Math.round(Number(e.target.value.replace(",", ".")) * 100) || s.price_cents,
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
                void update(s.id, {
                  duration_minutes: Number(e.target.value) || s.duration_minutes,
                })
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
          <div className="flex items-center gap-3">
            <Badge variant={s.loyalty_eligible ? "secondary" : "outline"}>
              {s.loyalty_eligible ? "Fidelidade" : "Avulso"}
            </Badge>
            {!s.loyalty_eligible ? (
              <Button variant="ghost" size="sm" onClick={() => void removeService(s.id, s.name)}>
                Excluir
              </Button>
            ) : null}
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
  const [breakWeekday, setBreakWeekday] = useState(1);
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [breakLabel, setBreakLabel] = useState("Almoço");
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

  const breaks = useQuery({
    queryKey: ["admin-breaks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_breaks")
        .select("*")
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  async function addBreak() {
    if (breakEnd <= breakStart) {
      toast.error("O fim do intervalo deve ser depois do início.");
      return;
    }
    const { error } = await supabase.from("schedule_breaks").insert({
      weekday: breakWeekday,
      start_time: `${breakStart}:00`,
      end_time: `${breakEnd}:00`,
      label: breakLabel.trim() || null,
    });
    if (error) {
      toast.error("Não foi possível salvar o intervalo.");
      return;
    }
    toast.success("Intervalo salvo.");
    await queryClient.invalidateQueries();
  }

  async function removeBreak(id: string) {
    await supabase.from("schedule_breaks").delete().eq("id", id);
    await queryClient.invalidateQueries();
  }

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
          <Input
            id="slot-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <Button onClick={() => void add()}>Adicionar horário</Button>
      </section>

      <section className="surface-card space-y-3 p-5">
        <p className="font-display text-lg">Intervalos (almoço / café)</p>
        <p className="text-sm text-muted-foreground">
          Horários dentro do intervalo não aparecem para a cliente, e procedimentos que invadiriam a
          pausa também são bloqueados.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="break-weekday">Dia da semana</Label>
            <select
              id="break-weekday"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={breakWeekday}
              onChange={(e) => setBreakWeekday(Number(e.target.value))}
            >
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="break-start">Início</Label>
            <Input
              id="break-start"
              type="time"
              value={breakStart}
              onChange={(e) => setBreakStart(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="break-end">Fim</Label>
            <Input
              id="break-end"
              type="time"
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="break-label">Nome</Label>
            <Input
              id="break-label"
              value={breakLabel}
              maxLength={40}
              onChange={(e) => setBreakLabel(e.target.value)}
            />
          </div>
          <Button onClick={() => void addBreak()}>Adicionar intervalo</Button>
        </div>
        {(breaks.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum intervalo cadastrado.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(breaks.data ?? []).map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <span>
                  {WEEKDAYS[b.weekday]} · {shortTime(b.start_time)} às {shortTime(b.end_time)}
                  {b.label ? ` · ${b.label}` : ""}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void removeBreak(b.id)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
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
