import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app/app-header";
import { NotificationPrompt } from "@/components/app/notification-prompt";
import { RescheduleRequestDialog } from "@/components/app/reschedule-request-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase-client";
import { storeTabs } from "@/lib/store-categories";
import { useCurrentProfile } from "@/hooks/useSession";
import { useAppSettings } from "@/hooks/useSettings";
import { useScheduleMonths } from "@/hooks/useScheduleMonths";
import { useSpecialDays } from "@/hooks/useSpecialDays";
import {
  currentMonthKey,
  daysUntilEndOfMonth,
  monthKeyOf,
  monthKeysFrom,
  monthLabel,
  monthShortLabel,
} from "@/lib/months";
import { busyTimesFn } from "@/lib/booking.functions";
import { clientCancelAppointmentFn, hideCancelledForClientFn } from "@/lib/cancel.functions";
import { consumeReferralFn, spendLoyaltyPointsFn } from "@/lib/loyalty.functions";
import { useLoyaltyWallet } from "@/hooks/useLoyaltyWallet";
import { claimEventPrizeFn } from "@/lib/account.functions";
import { notifyNewAppointmentFn } from "@/lib/push.functions";

import {
  APPOINTMENT_STATUS,
  BOOKING_LEAD_MINUTES,
  CANCELLED_HISTORY_DAYS,
  LOYALTY_CYCLE,
  LOYALTY_DISCOUNT,
  LOYALTY_PARTIAL_STEP,
  REFERRAL_DISCOUNT,
  WEEKDAYS,
  addMinutes,
  benefitBadgeLabel,
  canClientReschedule,
  claimBookingMessage,
  clientCancelConfirmation,
  currentMinutes,
  formatDateTime,
  formatDayLabel,
  formatDuration,
  formatPrice,
  formatTimeRange,
  isoDaysAgo,
  localTodayISO,
  overlaps,
  shortTime,
  timeToMinutes,
  whatsappLink,
} from "@/lib/salon";
import { StorageImage } from "@/components/app/storage-image";

const WELCOME_IMAGE = "/__l5e/assets-v1/5a73338f-8d2f-459f-8bb6-0dc055ee5917/boas-vindas.png";

/** Benefício reivindicado que já entra aplicado no pré-agendamento. */
export type Claim = { benefit: "fidelidade" | "indicacao" | "premio"; eventId?: string };

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

const todayISO = localTodayISO;

function weekdayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getDay();
}

function ClientPanel() {
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();
  const data = profile.data;
  const settings = useAppSettings();
  const loyaltyEnabled = settings.data?.loyalty_enabled ?? true;

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
  const [tab, setTab] = useState("agendar");
  const [claim, setClaim] = useState<Claim | null>(null);

  function startClaim(next: Claim) {
    setClaim(next);
    setTab("agendar");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="bg-petal min-h-screen pb-16">
      <div className="bg-petal-veil" aria-hidden="true" />
      <AppHeader
        title={firstName ? `Olá, ${firstName}!` : "Meu painel"}
        audience="cliente"
      />

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="-mx-4 flex h-auto w-[calc(100%+2rem)] max-w-none flex-nowrap justify-start gap-1 overflow-x-auto rounded-none bg-transparent px-4 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:w-full sm:rounded-lg sm:bg-muted sm:px-1 [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="agendar">Agendar</TabsTrigger>
            <TabsTrigger value="meus">Meus horários</TabsTrigger>
            <TabsTrigger value="loja">Loja</TabsTrigger>
            <TabsTrigger value="catalogos">Catálogo</TabsTrigger>
            <TabsTrigger value="beneficios">Meus benefícios</TabsTrigger>
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            {loyaltyEnabled ? <TabsTrigger value="fidelidade">Fidelidade</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="agendar" className="pt-6">
            <BookingFlow
              clientId={data?.id}
              clientName={data?.full_name ?? ""}
              clientPhone={data?.phone ?? ""}
              claim={claim}
              onClaimUsed={() => setClaim(null)}
            />
          </TabsContent>
          <TabsContent value="meus" className="pt-6">
            <MyAppointments clientId={data?.id} />
          </TabsContent>
          {loyaltyEnabled ? (
            <TabsContent value="fidelidade" className="pt-6">
              <LoyaltyCards clientId={data?.id} onClaim={startClaim} />
            </TabsContent>
          ) : null}
          <TabsContent value="beneficios" className="pt-6">
            <MyBenefits clientId={data?.id} onClaim={startClaim} />
          </TabsContent>
          <TabsContent value="eventos" className="pt-6">
            <EventsList clientId={data?.id} onClaim={startClaim} />
          </TabsContent>
          <TabsContent value="loja" className="pt-6">
            <Store clientName={data?.full_name ?? ""} />
          </TabsContent>
          <TabsContent value="catalogos" className="pt-6">
            <Catalogs />
          </TabsContent>
        </Tabs>
      </main>

      <NotificationPrompt active={!welcomeOpen} />

      <Dialog open={welcomeOpen} onOpenChange={(open) => (open ? null : void closeWelcome())}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <img
            src={WELCOME_IMAGE}
            alt="Bem-vinda à Jannah Nails, por Janaina Silva"
            className="w-full"
          />
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

function BookingFlow({
  clientId,
  clientName,
  clientPhone,
  claim,
  onClaimUsed,
}: {
  clientId?: string | undefined;
  clientName: string;
  clientPhone?: string;
  claim?: Claim | null;
  onClaimUsed?: () => void;
}) {
  const queryClient = useQueryClient();
  const services = useServices();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [benefit, setBenefit] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const settings = useAppSettings();
  const loyaltyEnabled = settings.data?.loyalty_enabled ?? true;
  const referralEnabled = settings.data?.referral_enabled ?? true;
  const expiryDays = settings.data?.benefit_expiry_days ?? 90;
  const maxAdvanceMonths = settings.data?.max_advance_months ?? 2;
  const scheduleMonths = useScheduleMonths();
  const [monthKey, setMonthKey] = useState(() => currentMonthKey());

  // Reivindicação: já entra com o benefício aplicado, no passo do procedimento.
  useEffect(() => {
    if (!claim) return;
    setBenefit(claim.benefit);
    setStep(0);
  }, [claim]);

  function goTo(next: number) {
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Relógio interno: revalida os horários do dia de hoje a cada minuto.
  const [nowTick, setNowTick] = useState(() => ({ day: todayISO(), minutes: currentMinutes() }));
  useEffect(() => {
    const id = setInterval(() => setNowTick({ day: todayISO(), minutes: currentMinutes() }), 30000);
    return () => clearInterval(id);
  }, []);

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

  // Dias especiais: valem apenas para a data exata, sem recorrência semanal.
  const specialDays = useSpecialDays();
  const specialByDay = useMemo(
    () => new Map((specialDays.data ?? []).filter((s) => s.times.length > 0).map((s) => [s.day, s])),
    [specialDays.data],
  );

  // Carteira de pontos: só pontos ganhos com a fidelidade ativa, ainda não
  // queimados em outro pré-agendamento e dentro da validade.
  const wallet = useLoyaltyWallet(clientId);

  const coupons = useQuery({
    queryKey: ["referral-coupons", clientId],
    enabled: Boolean(clientId) && referralEnabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, earned_at, expires_at")
        .eq("referrer_id", clientId!)
        .eq("status", "concluido")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Meses visíveis: mês atual + antecedência máxima definida pela administradora.
  const monthOptions = useMemo(() => {
    const rows = new Map((scheduleMonths.data ?? []).map((m) => [m.month, m]));
    return monthKeysFrom(maxAdvanceMonths + 1).map((key) => {
      const row = rows.get(key);
      return {
        key,
        active: row?.active ?? true,
        message: row?.message ?? null,
      };
    });
  }, [scheduleMonths.data, maxAdvanceMonths]);

  const selectedMonth = useMemo(
    () => monthOptions.find((m) => m.key === monthKey) ?? monthOptions[0],
    [monthOptions, monthKey],
  );

  const availableDays = useMemo(() => {
    if (!selectedMonth || !selectedMonth.active) return [];
    const weekdaysWithSlots = new Set((slots.data ?? []).map((s) => s.weekday));
    const blockedSet = new Set(blocked.data ?? []);
    const from = nowTick.day > `${selectedMonth.key}-01` ? nowTick.day : `${selectedMonth.key}-01`;
    return daysUntilEndOfMonth(from, selectedMonth.key).filter(
      (d) =>
        d >= nowTick.day &&
        // Dia especial tem prioridade: libera a data mesmo em folga ou bloqueio.
        (specialByDay.has(d) || (weekdaysWithSlots.has(weekdayOf(d)) && !blockedSet.has(d))),
    );
  }, [slots.data, blocked.data, nowTick.day, selectedMonth, specialByDay]);

  const service = (services.data ?? []).find((s) => s.id === serviceId);

  const dayTimes = useMemo(() => {
    if (!day || !service) return [];
    const weekday = weekdayOf(day);
    const duration = service.duration_minutes;
    const busyRanges = (busy.data ?? []).map((b) => ({
      start: timeToMinutes(b.start),
      end: timeToMinutes(b.start) + b.duration,
    }));
    const special = specialByDay.get(day);
    const breakRanges = special
      ? []
      : (breaks.data ?? [])
      .filter((b) => b.weekday === weekday)
      .map((b) => ({ start: timeToMinutes(b.start_time), end: timeToMinutes(b.end_time) }));

    // No dia de hoje, só horários futuros (com antecedência mínima). Datas futuras ficam intactas.
    const minStart = day === nowTick.day ? nowTick.minutes + BOOKING_LEAD_MINUTES : -1;

    // Dia especial: só os horários exclusivos cadastrados para essa data.
    const baseTimes: string[] = special
      ? special.times
      : (slots.data ?? []).filter((s) => s.weekday === weekday).map((s) => shortTime(s.start_time));

    return baseTimes
      .filter((t) => {
        const start = timeToMinutes(t);
        const end = start + duration;
        if (start < minStart) return false;
        if (end > 24 * 60) return false;
        if (busyRanges.some((r) => overlaps(start, end, r.start, r.end))) return false;
        // Bloqueia se o atendimento cair dentro do intervalo ou o invadir.
        if (breakRanges.some((r) => overlaps(start, end, r.start, r.end))) return false;
        return true;
      })
      .sort();
  }, [day, service, slots.data, busy.data, breaks.data, nowTick, specialByDay]);

  const points = (wallet.data ?? []).filter((p) => p.service_id === serviceId).length;
  const loyaltyService = service?.loyalty_eligible ?? false;
  const loyaltyReady = loyaltyEnabled && loyaltyService && points >= LOYALTY_CYCLE;
  const partialPercent =
    !loyaltyEnabled && loyaltyService
      ? Math.round(Math.min(points, LOYALTY_CYCLE) * LOYALTY_PARTIAL_STEP * 100)
      : 0;
  const couponCount = coupons.data?.length ?? 0;

  // Regra de cumulação: só um benefício por atendimento.
  const benefitOptions = useMemo(() => {
    const list: { value: string; label: string; percent: number }[] = [];
    if (loyaltyReady || (claim?.benefit === "fidelidade" && points >= LOYALTY_CYCLE))
      list.push({
        value: "fidelidade",
        label: `Resgate Fidelidade (-${Math.round(LOYALTY_DISCOUNT * 100)}%)`,
        percent: Math.round(LOYALTY_DISCOUNT * 100),
      });
    if (couponCount > 0 || claim?.benefit === "indicacao")
      list.push({
        value: "indicacao",
        label: `Resgate Indicação (-${Math.round(REFERRAL_DISCOUNT * 100)}%)`,
        percent: Math.round(REFERRAL_DISCOUNT * 100),
      });
    if (partialPercent > 0)
      list.push({
        value: "parcial",
        label: `Reembolso de pontos (-${partialPercent}%)`,
        percent: partialPercent,
      });
    if (claim?.benefit === "premio")
      list.push({
        value: "premio",
        label: "Prêmio de Sorteio / Evento",
        percent: 0,
      });
    list.push({ value: "nenhum", label: "Sem desconto", percent: 0 });
    return list;
  }, [loyaltyReady, couponCount, partialPercent, claim?.benefit, points]);

  const activeBenefit =
    benefitOptions.find((o) => o.value === benefit) ??
    benefitOptions.find((o) => o.value === claim?.benefit) ??
    benefitOptions[0]!;
  const eligible = activeBenefit.percent > 0 || activeBenefit.value === "premio";
  const price = service ? Math.round(service.price_cents * (1 - activeBenefit.percent / 100)) : 0;
  const endTime = service && time ? addMinutes(time, service.duration_minutes) : null;

  async function confirm() {
    if (!clientId || !service || !day || !time) return;
    setSaving(true);
    try {
      const { data: row, error } = await supabase
        .from("appointments")
        .insert({
          client_id: clientId,
          service_id: service.id,
          day,
          start_time: `${time}:00`,
          status: "pendente",
          price_cents: price,
          discount_applied: eligible,
          benefit_type: activeBenefit.value,
          discount_percent: activeBenefit.percent,
        })
        .select("id")
        .single();
      if (error || !row?.id) throw error ?? new Error("insert");
      if (activeBenefit.value === "fidelidade" || activeBenefit.value === "parcial") {
        try {
          // Queima os pontos usados para que o benefício não fique disponível de novo.
          await spendLoyaltyPointsFn({ data: { appointmentId: row.id } });
        } catch (walletError) {
          console.error("Falha ao registrar o uso dos pontos de fidelidade", walletError);
        }
      }
      if (activeBenefit.value === "indicacao") {
        try {
          await consumeReferralFn({ data: { appointmentId: row.id } });
        } catch (couponError) {
          console.error("Falha ao registrar o uso do cupom de indicação", couponError);
        }
      }
      if (activeBenefit.value === "premio" && row?.id && claim?.eventId) {
        try {
          await claimEventPrizeFn({ data: { eventId: claim.eventId, appointmentId: row.id } });
        } catch (prizeError) {
          console.error("Falha ao registrar o resgate do prêmio", prizeError);
        }
      }
      if (row?.id) {
        try {
          await notifyNewAppointmentFn({ data: { appointmentId: row.id } });
        } catch (notifyError) {
          console.error("Falha ao avisar a administradora", notifyError);
        }
      }
      await queryClient.invalidateQueries();
      const message = eligible
        ? claimBookingMessage({
            clientName,
            clientPhone: clientPhone ?? "",
            serviceName: service.name,
            day,
            start: time,
            benefitType: activeBenefit.value,
            percent: activeBenefit.percent,
            originalCents: service.price_cents,
            finalCents: price,
          })
        : [
            `Olá, Janaina! Sou ${clientName} e fiz uma pré-reserva pelo app.`,
            "",
            `Serviço: ${service.name}`,
            `Data: ${formatDayLabel(day)}`,
            `Início: ${time}`,
            `Término previsto: ${addMinutes(time, service.duration_minutes)}`,
            `Duração: ${formatDuration(service.duration_minutes)}`,
            `Valor: ${formatPrice(price)}`,
            "",
            "Pode confirmar para mim?",
          ].join("\n");
      window.open(whatsappLink(message), "_blank", "noopener");
      toast.success("Pré-reserva criada! Confirme pelo WhatsApp.");
      setServiceId(null);
      setDay(null);
      setTime(null);
      setBenefit(null);
      onClaimUsed?.();
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
      {claim ? (
        <div className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <p className="font-medium">
            {claim.benefit === "premio"
              ? "🎁 Resgate de prêmio em andamento"
              : claim.benefit === "indicacao"
                ? "🎁 Cupom de indicação aplicado"
                : "⭐ Fidelidade aplicada"}
          </p>
          <p className="text-muted-foreground">
            Escolha o procedimento, a data e o horário — o benefício já vai junto na comanda.
          </p>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        {step > 0 ? (
          <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => goTo(step - 1)}>
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
                  <StorageImage
                    url={s.image_url}
                    alt={s.name}
                    className="h-36 w-full object-cover"
                  />
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
            <div className="-mx-0.5 mb-3 flex gap-2 overflow-x-auto px-0.5 pb-1">
              {monthOptions.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`shrink-0 ${m.key === selectedMonth?.key ? "chip-active" : "chip"} ${
                    m.active ? "" : "opacity-50"
                  }`}
                  onClick={() => {
                    setMonthKey(m.key);
                    if (day && monthKeyOf(day) !== m.key) {
                      setDay(null);
                      setTime(null);
                    }
                  }}
                >
                  {monthShortLabel(m.key)}
                </button>
              ))}
            </div>
            {selectedMonth && !selectedMonth.active ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm">
                <p className="font-medium">
                  Agendamentos para {monthLabel(selectedMonth.key)} ainda não estão abertos
                </p>
                {selectedMonth.message ? (
                  <p className="mt-1 text-muted-foreground">{selectedMonth.message}</p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={d === day ? "chip-active" : "chip"}
                    onClick={() => {
                      setDay(d);
                      setTime(null);
                      goTo(2);
                    }}
                  >
                    {d.slice(8)}/{d.slice(5, 7)} · {WEEKDAYS[weekdayOf(d)]?.slice(0, 3)}
                    {specialByDay.has(d) ? " ✨" : ""}
                  </button>
                ))}
                {availableDays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma data disponível em{" "}
                    {selectedMonth ? monthLabel(selectedMonth.key) : "esse mês"}. Escolha outro mês
                    ou fale com a Janaina pelo WhatsApp.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {/* 3. horário */}
          <section className="w-full shrink-0 px-0.5" aria-hidden={step !== 2}>
            {day ? (
              <p className="mb-3 text-sm capitalize text-muted-foreground">{formatDayLabel(day)}</p>
            ) : null}
            {day && specialByDay.has(day) ? (
              <p className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                Atendimento Especial ✨
                {specialByDay.get(day)?.reason ? ` — ${specialByDay.get(day)?.reason}` : ""}
              </p>
            ) : null}
            {service ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Duração do procedimento: {formatDuration(service.duration_minutes)} — mostramos só
                os horários que cabem na agenda.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {dayTimes.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={t === time ? "chip-active" : "chip"}
                  onClick={() => {
                    setTime(t);
                    goTo(3);
                  }}
                >
                  {t} – {service ? addMinutes(t, service.duration_minutes) : ""}
                </button>
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
                    {eligible ? <Badge className="ml-1">{activeBenefit.label}</Badge> : null}
                  </li>
                </ul>
                {benefitOptions.length > 1 ? (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Benefício deste atendimento</p>
                    <p className="text-xs text-muted-foreground">
                      Apenas um benefício pode ser usado por atendimento.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {benefitOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          className={o.value === activeBenefit.value ? "chip-active" : "chip"}
                          onClick={() => setBenefit(o.value)}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  A reserva fica pendente até a Janaina confirmar pelo WhatsApp.
                </p>
                <Button className="mt-4 w-full" onClick={() => void confirm()} disabled={saving}>
                  {saving ? "Enviando..." : "Confirmar e falar no WhatsApp"}
                </Button>
                <Button variant="outline" className="mt-2 w-full" onClick={() => goTo(0)}>
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
  const [rescheduling, setRescheduling] = useState<{
    id: string;
    day: string;
    start_time: string;
    serviceName: string;
    durationMinutes: number;
  } | null>(null);
  const appointments = useQuery({
    queryKey: ["my-appointments-full", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(name, duration_minutes)")
        .eq("client_id", clientId!)
        .order("day", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function cancel(id: string) {
    if (!window.confirm("Deseja realmente cancelar este agendamento?")) return;
    try {
      const result = await clientCancelAppointmentFn({ data: { appointmentId: id } });
      await queryClient.invalidateQueries();
      toast.success(clientCancelConfirmation(result.day, result.start), { duration: 9000 });
      if (result.adminAlert) {
        const link = whatsappLink(result.adminAlert.message);
        window.open(link, "_blank", "noopener");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar.");
    }
  }

  async function hideHistory(id: string) {
    if (!window.confirm("Deseja remover este histórico?")) return;
    try {
      await hideCancelledForClientFn({ data: { appointmentId: id } });
      await queryClient.invalidateQueries();
      toast.success("Histórico removido.");
    } catch {
      toast.error("Não foi possível remover agora.");
    }
  }

  const cancelCutoff = isoDaysAgo(CANCELLED_HISTORY_DAYS);
  const rows = (appointments.data ?? []).filter((a) => {
    if (a.status !== "cancelado") return true;
    if (a.client_hidden_at) return false;
    const marked = String(a.cancelled_at ?? a.created_at ?? "").slice(0, 10);
    return marked >= cancelCutoff;
  });
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Você ainda não tem agendamentos.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((a) => (
        <article
          key={a.id}
          className="surface-card card-pad grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4"
        >
          <div className="min-w-0">
            <p className="font-display text-lg">
              {(a.services as { name: string } | null)?.name ?? "Serviço"}
            </p>
            <p className="text-sm capitalize text-muted-foreground">
              {formatDayLabel(a.day)} · {shortTime(a.start_time)}
            </p>
            <p className="text-sm">
              {formatPrice(a.price_cents)}
              {a.discount_applied
                ? ` · ${benefitBadgeLabel(String(a.benefit_type ?? "nenhum"), Number(a.discount_percent ?? 0)) ?? "Benefício aplicado"}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant={a.status === "cancelado" ? "outline" : "secondary"}>
              {APPOINTMENT_STATUS[a.status] ?? a.status}
            </Badge>
            {a.status === "pendente" || a.status === "confirmado" ? (
              <Button variant="outline" size="sm" onClick={() => void cancel(a.id)}>
                Cancelar
              </Button>
            ) : null}
            {a.status === "confirmado" ? (
              canClientReschedule(a.day, a.start_time) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRescheduling({
                      id: a.id,
                      day: a.day,
                      start_time: a.start_time,
                      serviceName:
                        (a.services as { name: string } | null)?.name ?? "Procedimento",
                      durationMinutes: Number(
                        (a.services as { duration_minutes?: number } | null)?.duration_minutes ??
                          60,
                      ),
                    })
                  }
                >
                  Solicitar Alteração de Data/Horário
                </Button>
              ) : (
                <div className="max-w-[15rem] text-right">
                  <Button variant="outline" size="sm" disabled>
                    Solicitar Alteração de Data/Horário
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Alterações pelo app são permitidas apenas com até 72h de antecedência. Entre em
                    contato direto pelo WhatsApp.
                  </p>
                </div>
              )
            ) : null}
            {a.status === "cancelado" ? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Remover este histórico"
                onClick={() => void hideHistory(a.id)}
              >
                <Trash2 size={16} />
              </Button>
            ) : null}
          </div>
        </article>
      ))}
      {rescheduling ? (
        <RescheduleRequestDialog
          appointment={rescheduling}
          open={rescheduling !== null}
          onOpenChange={(open: boolean) => (open ? undefined : setRescheduling(null))}
        />
      ) : null}
    </div>
  );
}

function LoyaltyCards({
  clientId,
  onClaim,
}: {
  clientId?: string | undefined;
  onClaim?: (claim: Claim) => void;
}) {
  const services = useServices();
  const settings = useAppSettings();
  const expiryDays = settings.data?.benefit_expiry_days ?? 90;
  const wallet = useLoyaltyWallet(clientId);
  const pending = useQuery({
    queryKey: ["loyalty-pending", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("service_id, benefit_type, status")
        .eq("client_id", clientId!)
        .in("benefit_type", ["fidelidade", "parcial"])
        .in("status", ["pendente", "confirmado"]);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Os atendimentos contam por {expiryDays} dias. Ao completar {LOYALTY_CYCLE} procedimentos do
        mesmo tipo, o próximo sai com {Math.round(LOYALTY_DISCOUNT * 100)}% de desconto.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(services.data ?? [])
          .filter((s) => s.loyalty_eligible)
          .map((s) => {
            const count = (wallet.data ?? []).filter((d) => d.service_id === s.id).length;
            const inCycle = Math.min(count, LOYALTY_CYCLE);
            const inUse = (pending.data ?? []).some((p) => p.service_id === s.id);
            const eligible = count >= LOYALTY_CYCLE && !inUse;
            return (
              <article key={s.id} className="surface-card p-5">
                <p className="font-display text-lg">{s.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {count} ponto{count === 1 ? "" : "s"} disponíve{count === 1 ? "l" : "is"}
                </p>
                <div className="mt-3 flex gap-1.5">
                  {Array.from({ length: LOYALTY_CYCLE }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-6 flex-1 rounded-full ${
                        eligible || index < inCycle ? "bg-primary" : "bg-secondary"
                      } ${index === LOYALTY_CYCLE - 1 ? "border-2 border-gold" : ""}`}
                    />
                  ))}
                </div>
                <Progress
                  className="mt-3"
                  value={eligible ? 100 : (inCycle / LOYALTY_CYCLE) * 100}
                />
                <p className="mt-3 text-sm">
                  {inUse
                    ? "⏳ Seus pontos estão reservados em um pré-agendamento. Se ele for cancelado ou recusado, eles voltam com validade renovada."
                    : count >= LOYALTY_CYCLE
                    ? `🎉 Seu próximo atendimento tem ${Math.round(LOYALTY_DISCOUNT * 100)}% de desconto!`
                    : `Faltam ${LOYALTY_CYCLE - inCycle} para ganhar ${Math.round(LOYALTY_DISCOUNT * 100)}%.`}
                </p>
                {eligible ? (
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    onClick={() => onClaim?.({ benefit: "fidelidade" })}
                  >
                    Reivindicar desconto
                  </Button>
                ) : null}
              </article>
            );
          })}
      </div>
    </div>
  );
}

function MyBenefits({
  clientId,
  onClaim,
}: {
  clientId?: string | undefined;
  onClaim?: (claim: Claim) => void;
}) {
  const { profile } = useCurrentProfile();
  const settings = useAppSettings();
  const referralEnabled = settings.data?.referral_enabled ?? true;
  const services = useServices();

  const referrals = useQuery({
    queryKey: ["my-referrals", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, status, earned_at, expires_at, used_at, referrer_id")
        .eq("referrer_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const used = useQuery({
    queryKey: ["benefit-history", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, day, service_id, benefit_type, discount_percent, price_cents, status")
        .eq("client_id", clientId!)
        .gt("discount_percent", 0)
        .order("day", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const serviceName = (id: string) =>
    (services.data ?? []).find((s) => s.id === id)?.name ?? "Procedimento";
  const now = Date.now();
  const availableCoupons = (referrals.data ?? []).filter(
    (r) =>
      r.status === "concluido" &&
      !r.used_at &&
      (r.expires_at ? new Date(r.expires_at).getTime() > now : true),
  ).length;

  return (
    <div className="space-y-6">
      {referralEnabled ? (
        <article className="surface-card p-5">
          <p className="font-display text-lg">Indique e ganhe</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua amiga informa o seu telefone <strong>{profile.data?.phone ?? ""}</strong> no
            primeiro acesso. Quando ela concluir o primeiro atendimento, você ganha{" "}
            {Math.round(REFERRAL_DISCOUNT * 100)}% de desconto.
          </p>
          <div className="mt-4 space-y-2">
            {(referrals.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma indicação registrada ainda.</p>
            ) : null}
            {(referrals.data ?? []).map((r) => {
              const expired = r.expires_at ? new Date(r.expires_at).getTime() < now : false;
              const label = r.used_at
                ? `Usado em ${formatDateTime(r.used_at)}`
                : r.status === "pendente"
                  ? "Aguardando o primeiro atendimento da amiga"
                  : expired
                    ? `Expirou em ${formatDateTime(r.expires_at)}`
                    : `Disponível até ${formatDateTime(r.expires_at)}`;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/60 px-4 py-3 text-sm"
                >
                  <span>Amiga indicada</span>
                  <Badge
                    variant={
                      r.used_at || expired || r.status === "pendente" ? "secondary" : "default"
                    }
                  >
                    {label}
                  </Badge>
                </div>
              );
            })}
          </div>
          {availableCoupons > 0 ? (
            <Button className="mt-4 w-full" onClick={() => onClaim?.({ benefit: "indicacao" })}>
              Reivindicar cupom de {Math.round(REFERRAL_DISCOUNT * 100)}% ({availableCoupons}{" "}
              disponível{availableCoupons === 1 ? "" : "eis"})
            </Button>
          ) : null}
        </article>
      ) : null}

      <article className="surface-card p-5">
        <p className="font-display text-lg">Histórico de benefícios usados</p>
        <div className="mt-3 space-y-2">
          {(used.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não usou nenhum desconto. Continue acumulando!
            </p>
          ) : null}
          {(used.data ?? []).map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/60 px-4 py-3 text-sm"
            >
              <span className="capitalize">
                {formatDayLabel(a.day)} · {serviceName(a.service_id)}
              </span>
              <span>
                <Badge className="mr-2">-{a.discount_percent}%</Badge>
                {formatPrice(a.price_cents)} · {APPOINTMENT_STATUS[a.status] ?? a.status}
              </span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function EventsList({
  clientId,
  onClaim,
}: {
  clientId?: string | undefined;
  onClaim?: (claim: Claim) => void;
}) {
  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("active", true)
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if ((events.data ?? []).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum evento ativo agora. Fique de olho: sorteios e promoções aparecem por aqui.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(events.data ?? []).map((e) => (
        <article key={e.id} className="surface-card overflow-hidden">
          <StorageImage url={e.image_url} alt={e.title} className="h-40 w-full object-cover" />
          <div className="p-5">
            <p className="font-display text-lg">{e.title}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              {formatDayLabel(e.starts_on)} até {formatDayLabel(e.ends_on)}
            </p>
            {e.description ? <p className="mt-2 text-sm">{e.description}</p> : null}
            {e.prize ? (
              <p className="mt-2 text-sm">
                Prêmio: <strong>{e.prize}</strong>
              </p>
            ) : null}
            {e.rules ? (
              <p className="mt-2 text-xs text-muted-foreground">Como participar: {e.rules}</p>
            ) : null}
            {e.winner_name ? (
              <p className="mt-3 text-sm">
                🎉 Ganhadora: <strong>{e.winner_name}</strong> ({formatDateTime(e.drawn_at)})
              </p>
            ) : null}
            {clientId && e.winner_id === clientId ? (
              e.prize_claimed_at ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Prêmio reivindicado em {formatDateTime(e.prize_claimed_at)}.
                </p>
              ) : (
                <Button
                  className="mt-3 w-full"
                  onClick={() => onClaim?.({ benefit: "premio", eventId: e.id })}
                >
                  Reivindicar prêmio 🎁
                </Button>
              )
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function Store({ clientName }: { clientName: string }) {
  const [activeCategory, setActiveCategory] = useState("Todas");
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
    return (
      <p className="text-sm text-muted-foreground">A loja está sendo abastecida. Volte logo!</p>
    );
  }

  const tabs = storeTabs(rows.map((p) => p.category));
  const visible =
    activeCategory === "Todas" ? rows : rows.filter((p) => p.category === activeCategory);

  return (
    <div className="space-y-4">
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Marcas da loja"
      >
        {tabs.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={activeCategory === c}
            onClick={() => setActiveCategory(c)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
              activeCategory === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não temos produtos de {activeCategory}. Volte logo! 💖
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {visible.map((p) => (
            <article key={p.id} className="surface-card flex flex-col overflow-hidden">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="card-pad flex min-w-0 flex-1 flex-col gap-2">
                <Badge variant="secondary" className="w-fit max-w-full truncate">
                  {p.category}
                </Badge>
                <p className="line-clamp-2 font-display text-base leading-tight">{p.name}</p>
                {p.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                ) : null}
                <p className="font-semibold">{formatPrice(p.price_cents)}</p>
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                  >
                    Ver detalhes
                  </a>
                ) : null}
                <Button
                  className="mt-auto w-full"
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
      )}
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
            <img
              src={c.image_url}
              alt={c.title}
              className="h-40 w-full object-cover"
              loading="lazy"
            />
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
