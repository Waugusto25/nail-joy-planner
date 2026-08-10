import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, Trash2 } from "lucide-react";

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
import { decideEmailChangeFn } from "@/lib/account.functions";
import { completeAppointmentFn, drawEventWinnerFn } from "@/lib/loyalty.functions";
import {
  cancelAppointmentFn,
  confirmAppointmentFn,
  setAppointmentPendingFn,
} from "@/lib/calendar.functions";
import { clearCancelledForAdminFn, hideCancelledForAdminFn } from "@/lib/cancel.functions";
import { ManualAppointmentDialog } from "@/components/app/manual-appointment-dialog";
import { AdminRescheduleDialog } from "@/components/app/admin-reschedule-dialog";
import { RescheduleRequests } from "@/components/app/reschedule-requests";
import { CatalogEditDialog } from "@/components/app/catalog-edit-dialog";
import { MonthsManager } from "@/components/app/months-manager";
import { SpecialDaysManager } from "@/components/app/special-days-manager";
import { FinanceTab } from "@/components/app/finance-tab";
import { StoreOrdersTab } from "@/components/app/store-orders-tab";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SERVICE_IMAGE_BUCKET, StorageImage } from "@/components/app/storage-image";
import {
  APPOINTMENT_STATUS,
  BENEFIT_LABELS,
  claimTag,
  LOYALTY_CYCLE,
  LOYALTY_DISCOUNT,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  REFERRAL_DISCOUNT,
  WEEKDAYS,
  cancellationMessage,
  confirmationMessage,
  dayGroupLabel,
  formatDateTime,
  formatDayLabel,
  formatPhone,
  formatPrice,
  localTodayISO,
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
        <div className="bg-petal-veil" aria-hidden="true" />
        <AppHeader title="Painel administrativo" />
        <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="bg-petal min-h-screen pb-16">
      <div className="bg-petal-veil" aria-hidden="true" />
      <AppHeader title="Painel administrativo" subtitle="Janaina Silva" audience="admin" />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <Tabs defaultValue="agenda">
          <TabsList className="-mx-4 flex h-auto w-[calc(100%+2rem)] max-w-none flex-nowrap justify-start gap-1 overflow-x-auto rounded-none bg-transparent px-4 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:w-full sm:rounded-lg sm:bg-muted sm:px-1 [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="horarios">Horários</TabsTrigger>
            <TabsTrigger value="fidelidade">Fidelidade</TabsTrigger>
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            <TabsTrigger value="loja">Loja</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos da Loja</TabsTrigger>
            <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
          </TabsList>
          <TabsContent value="agenda" className="pt-6">
            <AgendaTab />
          </TabsContent>
          <TabsContent value="financeiro" className="pt-6">
            <FinanceTab />
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
          <TabsContent value="fidelidade" className="pt-6">
            <LoyaltyTab />
          </TabsContent>
          <TabsContent value="eventos" className="pt-6">
            <EventsTab />
          </TabsContent>
          <TabsContent value="loja" className="pt-6">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="pedidos" className="pt-6">
            <StoreOrdersTab />
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
  const [payingId, setPayingId] = useState<string | null>(null);
  const appointments = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(name, duration_minutes)")
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

  async function complete(id: string, paymentMethod: string) {
    try {
      const { notifications } = await completeAppointmentFn({
        data: { appointmentId: id, paymentMethod },
      });
      setPayingId(null);
      await queryClient.invalidateQueries();
      toast.success("Atendimento concluído e registrado no caixa.");
      for (const n of notifications) {
        const message =
          n.kind === "indicacao"
            ? `Olá, ${n.name}! ${n.detail} concluiu o primeiro atendimento e você ganhou ${Math.round(REFERRAL_DISCOUNT * 100)}% de desconto no seu próximo procedimento. — Jannah Nails`
            : `Olá, ${n.name}! Você completou o cartão de fidelidade de ${n.detail} e ganhou ${Math.round(LOYALTY_DISCOUNT * 100)}% de desconto no próximo atendimento. — Jannah Nails`;
        const link = whatsappLinkTo(n.phone, message);
        if (link) window.open(link, "_blank", "noopener");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    }
  }

  function openClientWhatsapp(notice?: { phone: string; message: string }) {
    if (!notice) return;
    const link = whatsappLinkTo(notice.phone, notice.message);
    if (link) window.open(link, "_blank", "noopener");
  }

  async function setStatus(
    id: string,
    status: string,
    notice?: { phone: string; message: string },
  ) {
    if (status === "concluido") {
      setPayingId(id);
      return;
    }
    try {
      if (status === "confirmado") {
        const result = await confirmAppointmentFn({ data: { appointmentId: id } });
        toast.success(
          result.calendar === "ok"
            ? "Confirmado e adicionado à Google Agenda."
            : "Confirmado. Não foi possível criar o evento na Google Agenda.",
        );
        openClientWhatsapp(notice);
      } else if (status === "cancelado") {
        await cancelAppointmentFn({ data: { appointmentId: id } });
        toast.success("Atendimento cancelado.");
        openClientWhatsapp(notice);
      } else {
        await setAppointmentPendingFn({ data: { appointmentId: id } });
        toast.success("Agendamento atualizado.");
      }
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar.");
    }
  }

  const rows = appointments.data ?? [];

  async function hideCancelled(id: string) {
    if (!window.confirm("Deseja remover este histórico de cancelamento?")) return;
    try {
      await hideCancelledForAdminFn({ data: { appointmentId: id } });
      await queryClient.invalidateQueries();
      toast.success("Cancelamento removido do painel.");
    } catch {
      toast.error("Não foi possível remover agora.");
    }
  }

  async function clearCancelled() {
    if (!window.confirm("Limpar todo o histórico de cancelamentos do painel?")) return;
    try {
      await clearCancelledForAdminFn();
      await queryClient.invalidateQueries();
      toast.success("Lista de cancelados limpa.");
    } catch {
      toast.error("Não foi possível limpar agora.");
    }
  }

  function renderCard(a: (typeof rows)[number]) {
    const client = (clients.data ?? []).find((c) => c.id === a.client_id) ?? null;
    const service = a.services as { name: string; duration_minutes?: number } | null;
    const noticeBase = {
      name: client?.full_name ?? "linda",
      day: a.day,
      start: a.start_time,
      durationMinutes: Number(service?.duration_minutes ?? 60),
      serviceName: service?.name ?? "Procedimento",
    };
    const confirmNotice = client
      ? { phone: client.phone, message: confirmationMessage(noticeBase) }
      : undefined;
    const cancelNotice = client
      ? { phone: client.phone, message: cancellationMessage(noticeBase) }
      : undefined;
    return (
      <article key={a.id} className="surface-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {claimTag(a.benefit_type) ? (
              <Badge className="mb-1.5">{claimTag(a.benefit_type)}</Badge>
            ) : null}
            <p className="font-display text-lg">{client?.full_name ?? "Cliente"}</p>
            {client?.nickname ? (
              <p className="text-xs font-medium text-primary">Apelido: {client.nickname}</p>
            ) : null}
            <p className="text-sm capitalize text-muted-foreground">
              {formatDayLabel(a.day)} · {shortTime(a.start_time)} ·{" "}
              {(a.services as { name: string } | null)?.name}
            </p>
            <p className="text-sm">
              {formatPrice(a.price_cents)}{" "}
              {a.discount_percent > 0
                ? `· ${BENEFIT_LABELS[a.benefit_type] ?? "Desconto"} (-${a.discount_percent}%)`
                : ""}
            </p>
            {client ? (
              <p className="text-xs text-muted-foreground">
                {formatPhone(client.phone)} · ID {client.login_id}
              </p>
            ) : null}
            {a.payment_method ? (
              <p className="text-xs text-muted-foreground">
                Pago em {PAYMENT_METHOD_LABELS[a.payment_method] ?? a.payment_method}
              </p>
            ) : null}
          </div>
          <Badge variant="secondary">{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void setStatus(a.id, "pendente")}
            disabled={a.status === "pendente"}
          >
            Pendente
          </Button>
          <Button size="sm" onClick={() => void setStatus(a.id, "confirmado", confirmNotice)}>
            Confirmar
          </Button>
          <Button size="sm" variant="outline" onClick={() => void setStatus(a.id, "concluido")}>
            Concluir
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void setStatus(a.id, "cancelado", cancelNotice)}
          >
            Cancelar
          </Button>
          {a.status === "cancelado" ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Remover este cancelamento do painel"
              onClick={() => void hideCancelled(a.id)}
            >
              <Trash2 size={16} />
            </Button>
          ) : null}
          {client && whatsappLinkTo(client.phone, "") ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(
                  whatsappLinkTo(client.phone, confirmationMessage(noticeBase))!,
                  "_blank",
                  "noopener",
                )
              }
            >
              WhatsApp
            </Button>
          ) : null}
          {a.status !== "cancelado" ? (
            <AdminRescheduleDialog
              appointment={{
                id: a.id,
                day: a.day,
                start_time: a.start_time,
                serviceName: service?.name ?? "Procedimento",
                clientName: client?.full_name ?? "Cliente",
              }}
            />
          ) : null}
        </div>
      </article>
    );
  }

  const pendentes = rows
    .filter((a) => a.status === "pendente")
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const confirmados = rows
    .filter((a) => a.status === "confirmado")
    .slice()
    .sort((a, b) =>
      a.day === b.day
        ? String(a.start_time).localeCompare(String(b.start_time))
        : a.day.localeCompare(b.day),
    );
  const concluidos = rows
    .filter((a) => a.status === "concluido")
    .slice()
    .sort((a, b) => b.day.localeCompare(a.day));
  const cancelados = rows
    .filter((a) => a.status === "cancelado" && !a.admin_hidden_at)
    .slice()
    .sort((a, b) => b.day.localeCompare(a.day));

  const confirmedDays = [...new Set(confirmados.map((a) => a.day))];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ManualAppointmentDialog />
      </div>
      <Tabs defaultValue="pendentes">
        <TabsList className="mt-2 -mx-4 flex h-auto w-[calc(100%+2rem)] max-w-none flex-nowrap justify-start gap-1 overflow-x-auto rounded-none bg-transparent px-4 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:w-full sm:rounded-lg sm:bg-muted sm:px-1 [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="pendentes">Pré-agendamentos ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="confirmados">Confirmados ({confirmados.length})</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos ({concluidos.length})</TabsTrigger>
          <TabsTrigger value="cancelados">Cancelados ({cancelados.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-3 pt-4">
          <RescheduleRequests />
          <p className="text-sm text-muted-foreground">
            Novos pedidos aguardando confirmação, do mais recente para o mais antigo.
          </p>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pré-agendamento pendente.</p>
          ) : (
            pendentes.map(renderCard)
          )}
        </TabsContent>

        <TabsContent value="confirmados" className="space-y-4 pt-4">
          {confirmados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atendimento confirmado.</p>
          ) : (
            confirmedDays.map((day) => (
              <section key={day} className="space-y-3">
                <h3 className="font-display text-base capitalize">{dayGroupLabel(day)}</h3>
                {confirmados.filter((a) => a.day === day).map(renderCard)}
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="concluidos" className="space-y-3 pt-4">
          {concluidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atendimento concluído.</p>
          ) : (
            concluidos.map(renderCard)
          )}
        </TabsContent>

        <TabsContent value="cancelados" className="space-y-3 pt-4">
          {cancelados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento cancelado.</p>
          ) : (
            <>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => void clearCancelled()}>
                  <Trash2 size={16} /> Limpar todos os cancelados
                </Button>
              </div>
              {cancelados.map(renderCard)}
            </>
          )}
        </TabsContent>
      </Tabs>
      <BlockedDates />
      <Dialog open={payingId !== null} onOpenChange={(open) => !open && setPayingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forma de pagamento</DialogTitle>
            <DialogDescription>
              Escolha como a cliente pagou para concluir o atendimento e fechar o caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m.value}
                variant="outline"
                onClick={() => payingId && void complete(payingId, m.value)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
          <Input
            id="block-day"
            type="date"
            min={localTodayISO()}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
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
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [savingNickname, setSavingNickname] = useState<string | null>(null);
  const adminIds = useQuery({
    queryKey: ["admin-role-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (error) throw error;
      return (data ?? []).map((r) => r.user_id as string);
    },
  });

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

  /** Apelido interno da administradora (nunca aparece para a cliente). */
  async function saveNickname(clientId: string, current: string) {
    const value = (nicknames[clientId] ?? current).trim();
    setSavingNickname(clientId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nickname: value || null })
        .eq("id", clientId);
      if (error) throw new Error(error.message);
      toast.success("Apelido salvo.");
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch {
      toast.error("Não foi possível salvar o apelido.");
    } finally {
      setSavingNickname(null);
    }
  }

  return (
    <>
      <EmailChangeRequests />
      <div className="space-y-3">
      {(clients.data ?? []).map((c) => {
        const isMaster = (adminIds.data ?? []).includes(c.id);
        return (
          <article key={c.id} className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg flex items-center gap-2">
                  {c.full_name}
                  {isMaster ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      <Lock className="size-3" /> Administradora
                    </span>
                  ) : null}
                </p>
                {isMaster ? (
                  <p className="text-sm text-muted-foreground">
                    Dados de acesso protegidos — troque sua senha na engrenagem (⚙️) do topo.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    ID {c.login_id} · {formatPhone(c.phone)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {isMaster ? null : (
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
                )}
                {isMaster ? null : (
                  <>
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
                  </>
                )}
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
            {isMaster ? null : (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1 space-y-1">
                  <Label htmlFor={`nickname-${c.id}`}>Apelido (uso interno)</Label>
                  <Input
                    id={`nickname-${c.id}`}
                    maxLength={80}
                    placeholder="Ex: Mãe da Julia"
                    value={nicknames[c.id] ?? c.nickname ?? ""}
                    onChange={(e) =>
                      setNicknames((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Visível só para você — a cliente nunca vê esse apelido.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void saveNickname(c.id, c.nickname ?? "")}
                  disabled={savingNickname === c.id}
                >
                  {savingNickname === c.id ? "Salvando..." : "Salvar apelido"}
                </Button>
              </div>
            )}
          </article>
        );
      })}
      </div>
    </>
  );
}

/** Pendências de troca de e-mail solicitadas pelas clientes. */
function EmailChangeRequests() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const requests = useQuery({
    queryKey: ["admin-email-change-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_change_requests")
        .select("id, user_id, current_email, requested_email, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const clientNames = useQuery({
    queryKey: ["admin-clients-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id as string, String(p.full_name)]));
    },
  });

  async function decide(requestId: string, approve: boolean) {
    setBusy(requestId);
    try {
      await decideEmailChangeFn({ data: { requestId, approve } });
      await queryClient.invalidateQueries();
      toast.success(approve ? "E-mail atualizado no cadastro." : "Pedido recusado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível decidir o pedido.");
    } finally {
      setBusy(null);
    }
  }

  if (!(requests.data ?? []).length) return null;

  return (
    <section className="mb-5 space-y-3">
      <h2 className="font-display text-lg">Pedidos de troca de e-mail</h2>
      {(requests.data ?? []).map((r) => (
        <article key={r.id} className="surface-card space-y-2 p-4">
          <p className="font-medium">{clientNames.data?.[r.user_id as string] ?? "Cliente"}</p>
          <p className="text-sm text-muted-foreground">
            Atual: {r.current_email || "sem e-mail"} → Novo: {r.requested_email}
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy === r.id} onClick={() => void decide(r.id, true)}>
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy === r.id}
              onClick={() => void decide(r.id, false)}
            >
              Recusar
            </Button>
          </div>
        </article>
      ))}
    </section>
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
      <MonthsManager />
      <SpecialDaysManager />
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
    category: "Loja",
    price: "",
    stock: "0",
    description: "",
    image_url: "",
    link: "",
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
    if (!form.category.trim()) {
      toast.error("Informe a marca/categoria do produto.");
      return;
    }
    const { error } = await supabase.from("products").insert({
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      link: form.link.trim() || null,
      stock_quantity: Math.max(0, Number(form.stock) || 0),
      price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0,
    });
    if (error) {
      toast.error("Não foi possível cadastrar.");
      return;
    }
    setForm({
      name: "",
      category: "Loja",
      price: "",
      stock: "0",
      description: "",
      image_url: "",
      link: "",
    });
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
        <ProductCategoryPicker
          id="p-category"
          value={form.category}
          onChange={(category) => setForm({ ...form, category })}
        />
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
          <Label htmlFor="p-stock">Quantidade em estoque</Label>
          <Input
            id="p-stock"
            inputMode="numeric"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
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
        <div className="space-y-1">
          <Label htmlFor="p-link">Link do produto</Label>
          <Input
            id="p-link"
            value={form.link}
            maxLength={500}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
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
              <p className="text-xs text-muted-foreground">
                Estoque: {p.stock_quantity ?? 0} {p.active ? "" : "· Inativo"}
              </p>
              <div className="flex flex-wrap gap-2">
                <ProductEditDialog product={p} />
                <Button variant="ghost" size="sm" onClick={() => void remove(p.id)}>
                  Remover
                </Button>
              </div>
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
            <p className="text-xs text-muted-foreground">
              {c.active ? "Ativo" : "Inativo"}
              {c.description ? ` · ${c.description}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CatalogEditDialog catalog={c} />
              <Button variant="ghost" size="sm" onClick={() => void remove(c.id)}>
                Remover
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function LoyaltyTab() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("loyalty_enabled, referral_enabled, benefit_expiry_days")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [days, setDays] = useState("");

  useEffect(() => {
    if (settings.data) setDays(String(settings.data.benefit_expiry_days));
  }, [settings.data]);

  const referrals = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });
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

  async function save(patch: {
    loyalty_enabled?: boolean;
    referral_enabled?: boolean;
    benefit_expiry_days?: number;
  }) {
    const { error } = await supabase.from("app_settings").update(patch).eq("id", true);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Configuração atualizada.");
    await queryClient.invalidateQueries();
  }

  const nameOf = (id: string) =>
    (clients.data ?? []).find((c) => c.id === id)?.full_name ?? "Cliente";
  const loyaltyEnabled = settings.data?.loyalty_enabled ?? true;
  const referralEnabled = settings.data?.referral_enabled ?? true;

  return (
    <div className="space-y-6">
      <section className="surface-card space-y-4 p-5">
        <p className="font-display text-lg">Programas de benefício</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Cartão de fidelidade</p>
            <p className="text-xs text-muted-foreground">
              {LOYALTY_CYCLE} procedimentos do mesmo tipo dão {Math.round(LOYALTY_DISCOUNT * 100)}%
              no próximo. Ao desativar, as clientes recebem o reembolso parcial de 4% por
              procedimento já acumulado.
            </p>
          </div>
          <Switch
            checked={loyaltyEnabled}
            onCheckedChange={(v) => void save({ loyalty_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Programa de indicação</p>
            <p className="text-xs text-muted-foreground">
              {Math.round(REFERRAL_DISCOUNT * 100)}% de desconto para quem indica, liberado só
              depois do primeiro atendimento concluído da indicada.
            </p>
          </div>
          <Switch
            checked={referralEnabled}
            onCheckedChange={(v) => void save({ referral_enabled: v })}
          />
        </div>
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="expiry-days">Validade dos benefícios (dias)</Label>
          <div className="flex gap-2">
            <Input
              id="expiry-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(onlyDigits(e.target.value))}
              maxLength={3}
            />
            <Button
              variant="outline"
              onClick={() => void save({ benefit_expiry_days: Number(days) || 90 })}
            >
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sugerido entre 60 e 90 dias. Pontos e cupons mais antigos que isso deixam de valer.
          </p>
        </div>
      </section>

      <section className="surface-card p-5">
        <p className="font-display text-lg">Indicações</p>
        <div className="mt-3 space-y-2">
          {(referrals.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma indicação registrada.</p>
          ) : null}
          {(referrals.data ?? []).map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/60 px-4 py-3 text-sm"
            >
              <span>
                {nameOf(r.referrer_id)} indicou {nameOf(r.referred_id)}
              </span>
              <Badge variant="secondary">
                {r.used_at
                  ? `Usado em ${formatDateTime(r.used_at)}`
                  : r.status === "pendente"
                    ? "Aguardando 1º atendimento"
                    : `Válido até ${formatDateTime(r.expires_at)}`}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EventsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    prize: "",
    rules: "",
    starts_on: "",
    ends_on: "",
  });

  const events = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    if (!form.title.trim() || !form.starts_on || !form.ends_on) {
      toast.error("Informe título e o período do evento.");
      return;
    }
    const { error } = await supabase.from("events").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      prize: form.prize.trim() || null,
      rules: form.rules.trim() || null,
      starts_on: form.starts_on,
      ends_on: form.ends_on,
    });
    if (error) {
      toast.error("Não foi possível criar o evento.");
      return;
    }
    setForm({ title: "", description: "", prize: "", rules: "", starts_on: "", ends_on: "" });
    toast.success("Evento publicado.");
    await queryClient.invalidateQueries();
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("events").update({ active }).eq("id", id);
    await queryClient.invalidateQueries();
  }

  async function remove(id: string) {
    await supabase.from("events").delete().eq("id", id);
    toast.success("Evento removido.");
    await queryClient.invalidateQueries();
  }

  async function draw(id: string) {
    try {
      const result = await drawEventWinnerFn({ data: { eventId: id } });
      await queryClient.invalidateQueries();
      toast.success(`Ganhadora: ${result.winnerName} (${result.participants} participantes)`);
      const link = whatsappLinkTo(
        result.winnerPhone,
        `Parabéns, ${result.winnerName}! Você foi sorteada no evento da Jannah Nails. Vamos combinar a entrega do seu prêmio! — Jannah Nails`,
      );
      if (link) window.open(link, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sortear.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="surface-card grid gap-3 p-5 sm:grid-cols-2">
        <p className="font-display text-lg sm:col-span-2">Novo evento ou sorteio</p>
        <div className="space-y-2">
          <Label htmlFor="event-title">Título</Label>
          <Input
            id="event-title"
            value={form.title}
            maxLength={80}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-prize">Prêmio</Label>
          <Input
            id="event-prize"
            value={form.prize}
            maxLength={80}
            onChange={(e) => setForm({ ...form, prize: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-start">Início</Label>
          <Input
            id="event-start"
            type="date"
            value={form.starts_on}
            onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-end">Fim</Label>
          <Input
            id="event-end"
            type="date"
            value={form.ends_on}
            onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="event-desc">Descrição</Label>
          <Textarea
            id="event-desc"
            value={form.description}
            maxLength={300}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="event-rules">Regras de participação</Label>
          <Textarea
            id="event-rules"
            value={form.rules}
            maxLength={300}
            placeholder="Ex.: participam as clientes com atendimento no período do evento."
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
          />
        </div>
        <Button className="sm:col-span-2" onClick={() => void add()}>
          Publicar evento
        </Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {(events.data ?? []).map((e) => (
          <article key={e.id} className="surface-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg">{e.title}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {formatDayLabel(e.starts_on)} até {formatDayLabel(e.ends_on)}
                </p>
              </div>
              <Switch checked={e.active} onCheckedChange={(v) => void toggle(e.id, v)} />
            </div>
            {e.prize ? <p className="mt-2 text-sm">Prêmio: {e.prize}</p> : null}
            {e.winner_name ? (
              <p className="mt-2 text-sm">
                🎉 Ganhadora: <strong>{e.winner_name}</strong> ({formatDateTime(e.drawn_at)})
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void draw(e.id)}>
                {e.winner_name ? "Sortear novamente" : "Sortear ganhadora"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void remove(e.id)}>
                Remover
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
