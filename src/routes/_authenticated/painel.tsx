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
  addMinutes,
  formatDayLabel,
  formatDuration,
  formatPrice,
  formatTimeRange,
  overlaps,
  shortTime,
  timeToMinutes,
  whatsappLink,
} from "@/lib/salon";
import { StorageImage } from "@/components/app/storage-image";

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

  const breaks = useQuery({
    queryKey: ["breaks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_breaks")
        .select("*")
        .eq("active", true)
        .order("start_time");
      if (error) throw error;
      return data;
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

  const service = (services.data ?? []).find((s) => s.id === serviceId);

  const dayTimes = useMemo(() => {
    if (!day || !service) return [];
    const weekday = weekdayOf(day);
    const duration = service.duration_minutes;
    const busyRanges = (busy.data ?? []).map((b) => ({
      start: timeToMinutes(b.start),
      end: timeToMinutes(b.start) + b.duration,
    }));
    const breakRanges = (breaks.data ?? [])
      .filter((b) => b.weekday === weekday)
      .map((b) => ({ start: timeToMinutes(b.start_time), end: timeToMinutes(b.end_time) }));

    return (slots.data ?? [])
      .filter((s) => s.weekday === weekday)
      .map((s) => shortTime(s.start_time))
      .filter((t) => {
        const start = timeToMinutes(t);
        const end = start + duration;
        if (end > 24 * 60) return false;
        if (busyRanges.some((r) => overlaps(start, end, r.start, r.end))) return false;
        // Bloqueia se o atendimento cair dentro do intervalo ou o invadir.
        if (breakRanges.some((r) => overlaps(start, end, r.start, r.end))) return false;
        return true;
      })
      .sort();
  }, [day, service, slots.data, busy.data, breaks.data]);

  const completedForService = (history.data ?? []).filter(
    (a) => a.service_id === serviceId && a.status === "concluido",
  ).length;
  const loyaltyService = service?.loyalty_eligible ?? false;
  const eligible = loyaltyService && completedForService > 0 && completedForService % 6 === 5;
  const price = service
    ? eligible
      ? Math.round(service.price_cents * (1 - LOYALTY_DISCOUNT))
      : service.price_cents
    : 0;
  const endTime = service && time ? addMinutes(time, service.duration_minutes) : null;

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
      const text = `Olá, Janaina! Sou ${clientName} e fiz uma pré-reserva pelo app.%0A%0AServiço: ${service.name}%0AData: ${formatDayLabel(day)}%0AInício: ${time}%0ATérmino previsto: ${addMinutes(time, service.duration_minutes)}%0ADuração: ${formatDuration(service.duration_minutes)}%0AValor: ${formatPrice(price)}${eligible ? " (com 20% de fidelidade)" : ""}%0A%0APode confirmar para mim?`;
      window.open(whatsappLink(decodeURIComponent(text)), "_blank", "noopener");
      toast.success("Pré-reserva criada! Confirme pelo WhatsApp.");
      setServiceId(null);
      setDay(null);
      setTime(null);
      goTo(0);
    } catch {
      toast.error("Esse horário pode ter sido ocupado. Escolha outro.");
      await queryClient.invalidateQueries({ queryKey: ["busy", day] });
    } finally {
      setSaving(false);
    }
  }

  const titles = ["Escolha o procedimento", "Escolha a data", "Escolha o horário", "Confirme tudo"];

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        {step > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar"
            onClick={() => goTo(step - 1)}
          >
            <ArrowLeft size={18} />
          </Button>
        ) : (
          <span className="w-9" />
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Passo {step + 1} de 4
          </p>
          <h2 className="font-display text-xl">{titles[step]}</h2>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        {titles.map((t, index) => (
          <span
            key={t}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-secondary"}`}
          />
        ))}
      </div>

      <div className="mt-5 overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {/* 1. serviço */}
          <section className="w-full shrink-0 px-0.5" aria-hidden={step !== 0}>
            <div className="grid gap-4 sm:grid-cols-2">
              {(services.data ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setServiceId(s.id);
                    setTime(null);
                    goTo(1);
                  }}
                  className={`surface-card overflow-hidden text-left transition ${
                    s.id === serviceId ? "ring-2 ring-ring" : "hover:shadow-lg"
                  }`}
                >
                  <StorageImage url={s.image_url} alt={s.name} className="h-36 w-full object-cover" />
                  <div className="p-4">
                    <p className="font-display text-lg">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(s.price_cents)} · {formatDuration(s.duration_minutes)}
                    </p>
                    {!s.loyalty_eligible ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Avulso · não conta no cartão de fidelidade
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 2. data */}
          <section className="w-full shrink-0 px-0.5" aria-hidden={step !== 1}>
            {service ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Procedimento: <strong>{service.name}</strong>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {availableDays.map((d) => (
                <Button
                  key={d}
                  variant={d === day ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setDay(d);
                    setTime(null);
                    goTo(2);
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

          {/* 3. horário */}
          <section className="w-full shrink-0 px-0.5" aria-hidden={step !== 2}>
            {day ? (
              <p className="mb-3 text-sm capitalize text-muted-foreground">{formatDayLabel(day)}</p>
            ) : null}
            {service ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Duração do procedimento: {formatDuration(service.duration_minutes)} — mostramos só os
                horários que cabem na agenda.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {dayTimes.map((t) => (
                <Button
                  key={t}
                  variant={t === time ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTime(t);
                    goTo(3);
                  }}
                >
                  {t} – {service ? addMinutes(t, service.duration_minutes) : ""}
                </Button>
              ))}
              {dayTimes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum horário livre neste dia para este procedimento.
                </p>
              ) : null}
            </div>
          </section>

          {/* 4. confirmação */}
          <section className="w-full shrink-0 px-0.5" aria-hidden={step !== 3}>
            {service && day && time ? (
              <div className="surface-card p-5">
                <p className="font-display text-lg">Resumo da pré-reserva</p>
                <ul className="mt-3 space-y-1 text-sm">
                  <li>Procedimento: {service.name}</li>
                  <li className="capitalize">Data: {formatDayLabel(day)}</li>
                  <li>Horário: {formatTimeRange(time, service.duration_minutes)}</li>
                  {endTime ? <li>Término previsto: {endTime}</li> : null}
                  <li>
                    Valor: <strong>{formatPrice(price)}</strong>{" "}
                    {eligible ? <Badge className="ml-1">fidelidade -20%</Badge> : null}
                  </li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  A reserva fica pendente até a Janaina confirmar pelo WhatsApp.
                </p>
                <Button className="mt-4 w-full" onClick={() => void confirm()} disabled={saving}>
                  {saving ? "Enviando..." : "Confirmar e falar no WhatsApp"}
                </Button>
                <Button variant="ghost" className="mt-2 w-full" onClick={() => goTo(0)}>
                  Começar de novo
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Volte e escolha procedimento, data e horário.
              </p>
            )}
          </section>
        </div>
      </div>
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
      {(services.data ?? []).filter((s) => s.loyalty_eligible).map((s) => {
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