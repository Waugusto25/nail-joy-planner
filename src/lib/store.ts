import { supabase } from "@/lib/supabase-client";

export type StoreClient = {
  id: string;
  full_name: string;
  phone: string;
  nickname: string | null;
  notes: string | null;
  source_profile_id: string | null;
};

export type StoreOrderItem = {
  id: string;
  order_id: string;
  name: string;
  unit_price_cents: number;
  sort_order: number;
};

export type StoreOrderInstallment = {
  id: string;
  order_id: string;
  number: number;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  /** Quando preenchido, a parcela foi transferida para outro pedido e não é mais cobrada. */
  merged_into_order_id: string | null;
  /** Valor que veio de um pedido anterior e foi somado nesta parcela. */
  merged_extra_cents: number;
};

export type StoreOrderWithDetails = {
  id: string;
  store_client_id: string | null;
  created_at: string | null;
  client_name: string;
  client_phone: string;
  nickname: string | null;
  item_name: string;
  amount_cents: number;
  payment_method: string | null;
  installments: number;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  items: StoreOrderItem[];
  installments_list: StoreOrderInstallment[];
};

/** Parcelas realmente cobráveis: exclui pagas e as unificadas em outro pedido. */
export function pendingInstallments(list: StoreOrderInstallment[]): StoreOrderInstallment[] {
  return list.filter((p) => !p.paid_at && !p.merged_into_order_id);
}

/** Soma meses a uma data "YYYY-MM-DD" sem passar por conversão de fuso. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const base = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(day)}`;
}

/** Data local de hoje em "YYYY-MM-DD", sem deslocamento de fuso. */
export function todayISO(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Divide um valor em N parcelas, deixando a sobra de centavos na primeira. */
function splitFirstHeavy(totalCents: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count) || 1);
  const base = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? totalCents - base * (n - 1) : base));
}

export type InstallmentPlanChange = {
  /** Parcelas pendentes existentes que mudam de valor/vencimento. */
  update: { id: string; amount_cents: number; due_date: string | null }[];
  /** Parcelas novas a criar (quando o saldo é redividido em mais parcelas). */
  insert: { number: number; amount_cents: number; due_date: string | null }[];
  /** Parcelas pendentes que deixam de existir (redivisão em menos parcelas). */
  remove: string[];
  /** Novo total de parcelas do pedido (pagas + pendentes). */
  totalInstallments: number;
  /** Saldo devedor após o acréscimo. */
  pendingBalanceCents: number;
};

/**
 * Recalcula apenas o saldo devedor de um pedido ao acrescentar itens.
 * Parcelas pagas e parcelas unificadas em outro pedido nunca são tocadas.
 */
export function redistributeInstallments(
  order: StoreOrderWithDetails,
  addedCents: number,
  mode: "keep" | "resplit",
  count: number,
): InstallmentPlanChange {
  const active = order.installments_list.filter((p) => !p.merged_into_order_id);
  const paid = active.filter((p) => p.paid_at);
  const pending = pendingInstallments(order.installments_list).sort((a, b) => a.number - b.number);
  const pendingBalanceCents =
    pending.reduce((sum, p) => sum + p.amount_cents, 0) + Math.max(0, addedCents);

  // Sem parcela pendente, só resta criar novas parcelas para o valor acrescentado.
  const effectiveMode = pending.length === 0 ? "resplit" : mode;

  if (effectiveMode === "keep") {
    const amounts = splitFirstHeavy(pendingBalanceCents, pending.length);
    return {
      update: pending.map((p, i) => ({
        id: p.id,
        amount_cents: amounts[i] ?? p.amount_cents,
        due_date: p.due_date,
      })),
      insert: [],
      remove: [],
      totalInstallments: paid.length + pending.length,
      pendingBalanceCents,
    };
  }

  const n = Math.max(1, Math.floor(count) || 1);
  const amounts = splitFirstHeavy(pendingBalanceCents, n);
  const baseDue = pending[0]?.due_date ?? order.delivery_date ?? todayISO();
  const maxNumber = active.reduce((max, p) => Math.max(max, p.number), 0);

  const update: InstallmentPlanChange["update"] = [];
  const insert: InstallmentPlanChange["insert"] = [];
  for (let i = 0; i < n; i += 1) {
    const due = addMonthsISO(baseDue, i);
    const reused = pending[i];
    if (reused) update.push({ id: reused.id, amount_cents: amounts[i] ?? 0, due_date: due });
    else
      insert.push({
        number: maxNumber + 1 + (i - pending.length),
        amount_cents: amounts[i] ?? 0,
        due_date: due,
      });
  }

  return {
    update,
    insert,
    remove: pending.slice(n).map((p) => p.id),
    totalInstallments: paid.length + n,
    pendingBalanceCents,
  };
}

export async function fetchStoreOrders(): Promise<StoreOrderWithDetails[]> {
  const { data, error } = await supabase
    .from("store_orders")
    .select(
      // O apontamento explícito da chave estrangeira evita ambiguidade: parcelas
      // referenciam store_orders por order_id e por merged_into_order_id.
      "id, created_at, store_client_id, client_name, client_phone, item_name, amount_cents, payment_method, installments, delivery_date, status, notes, store_clients(nickname), store_order_items(id, order_id, name, unit_price_cents, sort_order), store_order_installments!store_order_installments_order_id_fkey(id, order_id, number, amount_cents, due_date, paid_at, merged_into_order_id, merged_extra_cents)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const joined = (row as { store_clients: unknown }).store_clients;
    const client = Array.isArray(joined) ? joined[0] : joined;
    return {
      id: row.id,
      created_at: row.created_at ?? null,
      store_client_id: row.store_client_id,
      client_name: row.client_name,
      client_phone: row.client_phone ?? "",
      nickname: (client as { nickname?: string | null } | null)?.nickname ?? null,
      item_name: row.item_name,
      amount_cents: Number(row.amount_cents ?? 0),
      payment_method: row.payment_method,
      installments: Number(row.installments ?? 1),
      delivery_date: row.delivery_date,
      status: row.status,
      notes: row.notes,
      items: [...(row.store_order_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      installments_list: [...(row.store_order_installments ?? [])].sort(
        (a, b) => a.number - b.number,
      ),
    };
  });
}


/** Nome exibido no painel: nome + apelido interno. */
export function displayName(client: {
  full_name: string;
  nickname?: string | null;
}): string {
  return client.nickname?.trim() ? `${client.full_name} (${client.nickname.trim()})` : client.full_name;
}

/** Nome curto usado nas mensagens: prefere o apelido. */
export function greetingName(client: { full_name: string; nickname?: string | null }): string {
  return client.nickname?.trim() || client.full_name.split(" ")[0] || client.full_name;
}

export async function fetchStoreClients(): Promise<StoreClient[]> {
  const { data, error } = await supabase
    .from("store_clients")
    .select("id, full_name, phone, nickname, notes, source_profile_id")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchActiveCatalogs(): Promise<{ title: string; url: string }[]> {
  const { data, error } = await supabase
    .from("catalogs")
    .select("title, url")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
