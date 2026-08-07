import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useSession";
import { busyTimesFn } from "@/lib/booking.functions";
import {
  APPOINTMENT_STATUS,
  LOYALTY_DISCOUNT,
  WEEKDAYS,
  formatDayLabel,
  formatDuration,
  formatPrice,
  shortTime,
  whatsappLink,
} from "@/lib/salon";

const WELCOME_IMAGE = "/__l5e/assets-v1/5a73338f-8d2f-459f-8bb6-0dc055ee5917/boas-vindas.png";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Meu painel — Jannah Nails" },
      {
        name: "description",
        content:
          "Agende manicure e pedicure, acompanhe seu cartão de fidelidade e veja a loja e catálogos da Jannah Nails.",
      },
      { property: "og:title", content: "Meu painel — Jannah Nails" },
      { property: "og:description", content: "Agendamentos, fidelidade e loja da Jannah Nails." },
    ],
  }),
  component: ClientPanel,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextDays(count: number) {
  const list: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    list.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return list;
}

function weekdayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getDay();
}

function ClientPanel() {
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();
  const data = profile.data;

  useEffect(() => {
    if (data?.isAdmin) void navigate({ to: "/admin", replace: true });
  }, [data?.isAdmin, navigate]);

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  useEffect(() => {
    if (data && !data.welcome_seen) setWelcomeOpen(true);
  }, [data]);

  async function closeWelcome() {
    setWelcomeOpen(false);
    if (data?.id) await supabase.from("profiles").update({ welcome_seen: true }).eq("id", data.id);
  }

  const firstName = data?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="bg-petal min-h-screen pb-16">
      <AppHeader
        title={firstName ? `Olá, ${firstName}!` : "Meu painel"}
        subtitle={data?.login_id ? `ID de login: ${data.login_id}` : undefined}
      />

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <Tabs defaultValue="agendar">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="agendar">Agendar</TabsTrigger>
            <TabsTrigger value="meus">Meus horários</TabsTrigger>
            <TabsTrigger value="fidelidade">Fidelidade</TabsTrigger>
            <TabsTrigger value="loja">Loja</TabsTrigger>
            <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
          </TabsList>

          <TabsContent value="agendar" className="pt-6">
            <BookingFlow clientId={data?.id} clientName={data?.full_name ?? ""} />
          </TabsContent>
          <TabsContent value="meus" className="pt-6">
            <MyAppointments clientId={data?.id} />
          </TabsContent>
          <TabsContent value="fidelidade" className="pt-6">
            <LoyaltyCards clientId={data?.id} />
          </TabsContent>
          <TabsContent value="loja" className="pt-6">
            <Store clientName={data?.full_name ?? ""} />
          </TabsContent>
          <TabsContent value="catalogos" className="pt-6">
            <Catalogs />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={welcomeOpen} onOpenChange={(open) => (open ? null : void closeWelcome())}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <img src={WELCOME_IMAGE} alt="Bem-vinda à Jannah Nails, por Janaina Silva" className="w-full" />
          <div className="p-4">
            <Button className="w-full" onClick={() => void closeWelcome()}>
              Começar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

function BookingFlow({ clientId, clientName }: { clientId?: string | undefined; clientName: string }) {
  const queryClient = useQueryClient();
  const services = useServices();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  function goTo(next: number) {
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const slots = useQuery({
    queryKey: ["slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("*")
        .eq("active", true)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const blocked = useQuery({
    queryKey: ["blocked"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocked_dates").select("day");
      if (error) throw error;
      return (data ?? []).map((r) => r.day);
    },
  });

  const busy = useQuery({
    queryKey: ["busy", day],
    enabled: Boolean(day),
    queryFn: async () => (await busyTimesFn({ data: { day: day! } })).busy,
  });

  const history = useQuery({
    queryKey: ["my-appointments", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("service_id, status")
        .eq("client_id", clientId!);
      if (error) throw error;
      return data;
    },
  });

  const availableDays = useMemo(() => {
    const weekdaysWithSlots = new Set((slots.data ?? []).map((s) => s.weekday));
    const blockedSet = new Set(blocked.data ?? []);
    return nextDays(35).filter(
      (d) => weekdaysWithSlots.has(weekdayOf(d)) && !blockedSet.has(d) && d >= todayISO(),
    );
  }, [slots.data, blocked.data]);

  const dayTimes = useMemo(() => {
    if (!day) return [];
    const busySet = new Set(busy.data ?? []);
    return (slots.data ?? [])
      .filter((s) => s.weekday === weekdayOf(day))
      .map((s) => shortTime(s.start_time))
      .filter((t) => !busySet.has(t));
  }, [day, slots.data, busy.data]);

  const service = (services.data ?? []).find((s) => s.id === serviceId);
  const completedForService = (history.data ?? []).filter(
    (a) => a.service_id === serviceId && a.status === "concluido",
  ).length;
  const eligible = completedForService > 0 && completedForService % 6 === 5;
  const price = service
    ? eligible
      ? Math.round(service.price_cents * (1 - LOYALTY_DISCOUNT))
      : service.price_cents
    : 0;

  async function confirm() {
    if (!clientId || !service || !day || !time) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        client_id: clientId,
        service_id: service.id,
        day,
        start_time: `${time}:00`,
        price_cents: price,
        discount_applied: eligible,
      });
      if (error) throw error;
      await queryClient.invalidateQueries();
      const text = `Olá, Janaina! Sou ${clientName} e fiz uma pré-reserva pelo app.%0A%0AServiço: ${service.name}%0AData: ${formatDayLabel(day)}%0AHorário: ${time}%0AValor: ${formatPrice(price)}${eligible ? " (com 20% de fidelidade)" : ""}%0A%0APode confirmar para mim?`;
      window.open(whatsappLink(decodeURIComponent(text)), "_blank", "noopener");
      toast.success("Pré-reserva criada! Confirme pelo WhatsApp.");
      setServiceId(null);
      setDay(null);
      setTime(null);
    } catch {
      toast.error("Esse horário pode ter sido ocupado. Escolha outro.");
      await queryClient.invalidateQueries({ queryKey: ["busy", day] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-xl">1. Escolha o serviço</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(services.data ?? []).map((s) => {
            const selected = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setTime(null);
                }}
                className={`surface-card overflow-hidden text-left transition ${
                  selected ? "ring-2 ring-ring" : "hover:shadow-lg"
                }`}
              >
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} className="h-36 w-full object-cover" loading="lazy" />
                ) : null}
                <div className="p-4">
                  <p className="font-display text-lg">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(s.price_cents)} · {formatDuration(s.duration_minutes)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {serviceId ? (
        <section>
          <h2 className="font-display text-xl">2. Escolha o dia</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableDays.map((d) => (
              <Button
                key={d}
                variant={d === day ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDay(d);
                  setTime(null);
                }}
              >
                {d.slice(8)}/{d.slice(5, 7)} · {WEEKDAYS[weekdayOf(d)]?.slice(0, 3)}
              </Button>
            ))}
            {availableDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma data disponível no momento. Fale com a Janaina pelo WhatsApp.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {day ? (
        <section>
          <h2 className="font-display text-xl">3. Escolha o horário</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {dayTimes.map((t) => (
              <Button
                key={t}
                variant={t === time ? "default" : "outline"}
                size="sm"
                onClick={() => setTime(t)}
              >
                {t}
              </Button>
            ))}
            {dayTimes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos os horários deste dia estão ocupados.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {service && day && time ? (
        <section className="surface-card p-5">
          <h2 className="font-display text-xl">Resumo da pré-reserva</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Serviço: {service.name}</li>
            <li className="capitalize">Data: {formatDayLabel(day)}</li>
            <li>Horário: {time}</li>
            <li>
              Valor: <strong>{formatPrice(price)}</strong>{" "}
              {eligible ? <Badge className="ml-1">fidelidade -20%</Badge> : null}
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            A reserva fica pendente até a Janaina confirmar pelo WhatsApp.
          </p>
          <Button className="mt-4 w-full" onClick={() => void confirm()} disabled={saving}>
            {saving ? "Enviando..." : "Reservar e falar no WhatsApp"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function MyAppointments({ clientId }: { clientId?: string | undefined }) {
  const queryClient = useQueryClient();
  const appointments = useQuery({
    queryKey: ["my-appointments-full", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(name)")
        .eq("client_id", clientId!)
        .order("day", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function cancel(id: string) {
    const { error } = await supabase.from("appointments").update({ status: "cancelado" }).eq("id", id);
    if (error) {
      toast.error("Não foi possível cancelar.");
      return;
    }
    toast.success("Agendamento cancelado.");
    await queryClient.invalidateQueries();
  }

  const rows = appointments.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Você ainda não tem agendamentos.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((a) => (
        <article key={a.id} className="surface-card flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-display text-lg">
              {(a.services as { name: string } | null)?.name ?? "Serviço"}
            </p>
            <p className="text-sm capitalize text-muted-foreground">
              {formatDayLabel(a.day)} · {shortTime(a.start_time)}
            </p>
            <p className="text-sm">
              {formatPrice(a.price_cents)} {a.discount_applied ? "· fidelidade -20%" : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={a.status === "cancelado" ? "outline" : "secondary"}>
              {APPOINTMENT_STATUS[a.status] ?? a.status}
            </Badge>
            {a.status === "pendente" || a.status === "confirmado" ? (
              <Button variant="ghost" size="sm" onClick={() => void cancel(a.id)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function LoyaltyCards({ clientId }: { clientId?: string | undefined }) {
  const services = useServices();
  const done = useQuery({
    queryKey: ["loyalty", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("service_id")
        .eq("client_id", clientId!)
        .eq("status", "concluido");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(services.data ?? []).map((s) => {
        const count = (done.data ?? []).filter((d) => d.service_id === s.id).length;
        const inCycle = count % 6;
        const eligible = count > 0 && inCycle === 5;
        return (
          <article key={s.id} className="surface-card p-5">
            <p className="font-display text-lg">{s.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {count} atendimento{count === 1 ? "" : "s"} concluído{count === 1 ? "" : "s"}
            </p>
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-6 flex-1 rounded-full ${
                    index < inCycle ? "bg-primary" : "bg-secondary"
                  } ${index === 5 ? "border-2 border-gold" : ""}`}
                />
              ))}
            </div>
            <Progress className="mt-3" value={(inCycle / 6) * 100} />
            <p className="mt-3 text-sm">
              {eligible
                ? "🎉 Seu próximo atendimento tem 20% de desconto!"
                : `Faltam ${5 - inCycle} para ganhar 20% no 6º atendimento.`}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function Store({ clientName }: { clientName: string }) {
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = products.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">A loja está sendo abastecida. Volte logo!</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((p) => (
        <article key={p.id} className="surface-card overflow-hidden">
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" loading="lazy" />
          ) : null}
          <div className="space-y-2 p-4">
            <Badge variant="secondary">{p.category}</Badge>
            <p className="font-display text-lg">{p.name}</p>
            {p.description ? (
              <p className="text-sm text-muted-foreground">{p.description}</p>
            ) : null}
            <p className="font-semibold">{formatPrice(p.price_cents)}</p>
            <Button
              className="w-full"
              size="sm"
              onClick={() =>
                window.open(
                  whatsappLink(
                    `Olá, Janaina! Sou ${clientName} e quero comprar: ${p.name} (${formatPrice(p.price_cents)}).`,
                  ),
                  "_blank",
                  "noopener",
                )
              }
            >
              Quero este
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Catalogs() {
  const catalogs = useQuery({
    queryKey: ["catalogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogs")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = catalogs.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum catálogo publicado ainda.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((c) => (
        <a
          key={c.id}
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="surface-card block overflow-hidden transition hover:shadow-lg"
        >
          {c.image_url ? (
            <img src={c.image_url} alt={c.title} className="h-40 w-full object-cover" loading="lazy" />
          ) : null}
          <div className="p-4">
            <p className="font-display text-lg">{c.title}</p>
            {c.description ? (
              <p className="text-sm text-muted-foreground">{c.description}</p>
            ) : null}
            <p className="mt-2 text-sm font-semibold text-primary">Abrir catálogo →</p>
          </div>
        </a>
      ))}
    </div>
  );
}