import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { createManualAppointmentFn } from "@/lib/manual-booking.functions";
import {
  PAYMENT_METHODS,
  adminWelcomeMessage,
  confirmationMessage,
  formatPhone,
  formatPrice,
  formatTimeRange,
  localTodayISO,
  openWhatsappUrl,
  overlaps,
  shortTime,
  timeToMinutes,
  whatsappLinkTo,
} from "@/lib/salon";

export function ManualAppointmentDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cadastrada" | "nova">("cadastrada");
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [day, setDay] = useState(localTodayISO());
  const [startTime, setStartTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const clients = useQuery({
    queryKey: ["manual-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const services = useQuery({
    queryKey: ["manual-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price_cents, duration_minutes")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const weekday = useMemo(() => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1).getDay();
  }, [day]);

  const slots = useQuery({
    queryKey: ["manual-slots", weekday],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("start_time")
        .eq("weekday", weekday)
        .eq("active", true)
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map((s) => shortTime(String(s.start_time)));
    },
  });

  const busy = useQuery({
    queryKey: ["manual-busy", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("start_time, services(duration_minutes)")
        .eq("day", day)
        .in("status", ["pendente", "confirmado", "concluido"]);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const joined = (r as { services: unknown }).services;
        const service = Array.isArray(joined) ? joined[0] : joined;
        return {
          start: timeToMinutes(String(r.start_time)),
          duration: Number((service as { duration_minutes?: number } | null)?.duration_minutes ?? 60),
        };
      });
    },
  });

  const service = (services.data ?? []).find((s) => s.id === serviceId) ?? null;
  const duration = Number(service?.duration_minutes ?? 60);

  const filteredClients = (clients.data ?? []).filter((c) =>
    String(c.full_name).toLowerCase().includes(search.trim().toLowerCase()),
  );

  const availableTimes = (slots.data ?? []).filter((time) => {
    const start = timeToMinutes(time);
    return !(busy.data ?? []).some((b) =>
      overlaps(start, start + duration, b.start, b.start + b.duration),
    );
  });

  const offSchedule = Boolean(startTime) && !(slots.data ?? []).includes(startTime);

  function reset() {
    setMode("cadastrada");
    setSearch("");
    setClientId("");
    setNewName("");
    setNewPhone("");
    setServiceId("");
    setDay(localTodayISO());
    setStartTime("");
    setPaymentMethod("");
    setNotes("");
  }

  async function save() {
    if (mode === "cadastrada" && !clientId) {
      toast.error("Selecione a cliente.");
      return;
    }
    if (mode === "nova" && newName.trim().length < 2) {
      toast.error("Informe o nome da cliente.");
      return;
    }
    if (!serviceId || !startTime) {
      toast.error("Escolha o procedimento, a data e o horário.");
      return;
    }
    setSaving(true);
    try {
      const result = await createManualAppointmentFn({
        data: {
          ...(mode === "cadastrada" ? { clientId } : { clientName: newName, clientPhone: newPhone }),
          serviceId,
          day,
          startTime,
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(notes ? { notes } : {}),
        },
      });
      await queryClient.invalidateQueries();
      toast.success(
        [
          result.calendar === "ok"
            ? "Agendamento confirmado e publicado na Google Agenda."
            : "Agendamento confirmado. Não foi possível criar o evento na Google Agenda.",
          result.special ? "Registrado como Atendimento Especial ✨" : "",
        ]
          .filter(Boolean)
          .join(" "),
      );

      const clientPhone = String(result.client.phone ?? "");
      const digits = clientPhone.replace(/\D/g, "");
      const message = result.createdClient
        ? adminWelcomeMessage({
            loginId: result.client.loginId || result.client.name,
            phoneDigits: digits,
            serviceName: result.service.name,
            day,
            start: startTime,
          })
        : confirmationMessage({
            name: result.client.name,
            day,
            start: startTime,
            durationMinutes: result.service.durationMinutes,
            serviceName: result.service.name,
          });
      // Telefone bruto: whatsappLinkTo normaliza o DDI e codifica o texto em UTF-8.
      const link = whatsappLinkTo(clientPhone, message);
      if (link) {
        openWhatsappUrl(link);
        toast.info("Mensagem preparada no WhatsApp da cliente.", {
          action: { label: "Abrir WhatsApp", onClick: () => openWhatsappUrl(link) },
        });
      } else {
        toast.info("Cliente sem WhatsApp válido — mensagem não enviada.");
      }

      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus size={16} /> Novo agendamento manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento manual</DialogTitle>
          <DialogDescription>
            Cadastre atendimentos combinados por ligação ou presencialmente. Entram direto como
            confirmados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "cadastrada" ? "default" : "outline"}
              onClick={() => setMode("cadastrada")}
            >
              Cliente cadastrada
            </Button>
            <Button
              size="sm"
              variant={mode === "nova" ? "default" : "outline"}
              onClick={() => setMode("nova")}
            >
              Nova cliente / sem WhatsApp
            </Button>
          </div>

          {mode === "cadastrada" ? (
            <div className="space-y-2">
              <Label htmlFor="manual-busca">Buscar cliente por nome</Label>
              <Input
                id="manual-busca"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Digite o nome"
              />
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                {filteredClients.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">Nenhuma cliente encontrada.</p>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(String(c.id))}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                        clientId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {c.full_name}{" "}
                      <span className="opacity-70">{c.phone ? formatPhone(String(c.phone)) : ""}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="manual-nome">Nome da cliente</Label>
                <Input
                  id="manual-nome"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual-tel">Telefone (opcional)</Label>
                <Input
                  id="manual-tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(35) 99999-9999"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Procedimento</Label>
            <div className="grid gap-2">
              {(services.data ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setServiceId(String(s.id));
                    setStartTime("");
                  }}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    serviceId === s.id ? "border-primary bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <span>{s.name}</span>
                  <span className="text-muted-foreground">
                    {formatPrice(Number(s.price_cents))} · {s.duration_minutes} min
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="manual-dia">Data</Label>
              <Input
                id="manual-dia"
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Qualquer data — passada, hoje ou futura.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Forma de pagamento (opcional)</Label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <Button
                    key={m.value}
                    size="sm"
                    variant={paymentMethod === m.value ? "default" : "outline"}
                    onClick={() => setPaymentMethod(paymentMethod === m.value ? "" : m.value)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Horário</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label="Horário livre"
            />
            {availableTimes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTimes.map((time) => (
                  <Button
                    key={time}
                    size="sm"
                    variant={startTime === time ? "default" : "outline"}
                    onClick={() => setStartTime(time)}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            ) : null}
            {offSchedule ? (
              <p className="text-xs text-primary">
                Fora do expediente padrão — será salvo como Atendimento Especial ✨
              </p>
            ) : null}
            {startTime && service ? (
              <p className="text-xs text-muted-foreground">
                {formatTimeRange(startTime, duration)} · {service.name}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="manual-obs">Observações (opcional)</Label>
            <Textarea
              id="manual-obs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button className="w-full" disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando..." : "Salvar agendamento confirmado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
