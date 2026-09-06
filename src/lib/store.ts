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
  /** Valor acumulado de produtos acrescentados depois ao pedido e somados nesta parcela. */
  added_extra_cents: number;
  /** Valor efetivamente recebido no acerto desta parcela. */
  paid_amount_cents: number;
  /** Crédito (troco) de um pagamento maior anterior abatido desta parcela. */
  credit_applied_cents: number;
  /** Pendência do mês anterior somada a esta parcela. */
  carried_in_cents: number;
};

/** Situação de cobrança da parcela, derivada dos valores gravados. */
export type InstallmentState = "paga" | "parcial" | "pendente" | "transferida";

export function installmentState(p: StoreOrderInstallment): InstallmentState {
  if (p.merged_into_order_id) return "transferida";
  if (!p.paid_at) return "pendente";
  return p.paid_amount_cents > 0 && p.paid_amount_cents < p.amount_cents ? "parcial" : "paga";
}


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

export type ItemRemovalPlan = {
  /** Parcelas pendentes que tiveram o valor reduzido. */
  update: { id: string; amount_cents: number; added_extra_cents: number }[];
  /** Parcelas pendentes que zeraram e devem sair do cronograma. */
  deleteIds: string[];
  /** Novo valor total do pedido. */
  newTotalCents: number;
  /** Novo número de parcelas ativas do pedido. */
  totalInstallments: number;
  /** Saldo devedor após a remoção. */
  pendingBalanceCents: number;
  /** Parte do valor que não pôde ser abatida por já estar paga. */
  unappliedCents: number;
};

/**
 * Remove o valor de um item do pedido abatendo das parcelas PENDENTES, começando
 * pelas últimas (meses mais distantes), para encurtar o cronograma em vez de
 * bagunçar os vencimentos próximos. Parcelas pagas nunca são alteradas.
 */
export function removeItemInstallments(
  order: StoreOrderWithDetails,
  removedCents: number,
): ItemRemovalPlan {
  const active = order.installments_list.filter((p) => !p.merged_into_order_id);
  const paid = active.filter((p) => p.paid_at);
  const pending = pendingInstallments(order.installments_list).sort((a, b) => a.number - b.number);

  const update: ItemRemovalPlan["update"] = [];
  const deleteIds: string[] = [];
  let remaining = Math.max(0, removedCents);

  for (let i = pending.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const parcel = pending[i];
    if (!parcel) continue;
    const cut = Math.min(parcel.amount_cents, remaining);
    remaining -= cut;
    const nextAmount = parcel.amount_cents - cut;
    // Só apaga a parcela zerada se o pedido ainda tiver algum registro de cobrança.
    const keepAsPlaceholder = nextAmount === 0 && paid.length === 0 && pending.length === 1;
    if (nextAmount === 0 && !keepAsPlaceholder) {
      deleteIds.push(parcel.id);
      continue;
    }
    update.push({
      id: parcel.id,
      amount_cents: nextAmount,
      added_extra_cents: Math.min(parcel.added_extra_cents, nextAmount),
    });
  }

  const pendingBalanceCents =
    pending.reduce((sum, p) => sum + p.amount_cents, 0) - (Math.max(0, removedCents) - remaining);

  return {
    update,
    deleteIds,
    newTotalCents: Math.max(0, order.amount_cents - Math.max(0, removedCents)),
    totalInstallments: Math.max(1, paid.length + pending.length - deleteIds.length),
    pendingBalanceCents: Math.max(0, pendingBalanceCents),
    unappliedCents: remaining,
  };
}

export type InstallmentPlanChange = {
  /** Parcelas pendentes existentes que recebem parte do item acrescentado. */
  update: {
    id: string;
    number: number;
    amount_cents: number;
    due_date: string | null;
    added_extra_cents: number;
  }[];
  /** Meses novos criados para as parcelas excedentes do item acrescentado. */
  insert: {
    number: number;
    amount_cents: number;
    due_date: string | null;
    added_extra_cents: number;
  }[];
  /** Novo total de parcelas do pedido (pagas + pendentes + novas). */
  totalInstallments: number;
  /** Saldo devedor após o acréscimo. */
  pendingBalanceCents: number;
};

/**
 * Encaixe cronológico: divide o valor acrescentado em `count` parcelas e soma cada
 * uma na parcela pendente do mês correspondente, mantendo os vencimentos já
 * agendados. As parcelas excedentes viram meses novos ao final do cronograma.
 * Parcelas pagas e parcelas unificadas em outro pedido nunca são tocadas.
 */
export function appendItemInstallments(
  order: StoreOrderWithDetails,
  addedCents: number,
  count: number,
): InstallmentPlanChange {
  const active = order.installments_list.filter((p) => !p.merged_into_order_id);
  const paid = active.filter((p) => p.paid_at);
  const pending = pendingInstallments(order.installments_list).sort((a, b) => a.number - b.number);

  const n = Math.max(1, Math.floor(count) || 1);
  const amounts = splitFirstHeavy(Math.max(0, addedCents), n);

  const maxNumber = active.reduce((max, p) => Math.max(max, p.number), 0);
  // Novos meses continuam a partir do último vencimento existente do pedido.
  const lastDue =
    [...active].sort((a, b) => a.number - b.number).at(-1)?.due_date ??
    order.delivery_date ??
    todayISO();

  const update: InstallmentPlanChange["update"] = [];
  const insert: InstallmentPlanChange["insert"] = [];
  for (let i = 0; i < n; i += 1) {
    const share = amounts[i] ?? 0;
    const target = pending[i];
    if (target) {
      update.push({
        id: target.id,
        number: target.number,
        amount_cents: target.amount_cents + share,
        due_date: target.due_date,
        added_extra_cents: target.added_extra_cents + share,
      });
    } else {
      const extraIndex = i - pending.length;
      insert.push({
        number: maxNumber + 1 + extraIndex,
        amount_cents: share,
        due_date: addMonthsISO(lastDue, extraIndex + 1),
        added_extra_cents: share,
      });
    }
  }

  const pendingBalanceCents =
    pending.reduce((sum, p) => sum + p.amount_cents, 0) + Math.max(0, addedCents);

  return {
    update,
    insert,
    totalInstallments: paid.length + pending.length + insert.length,
    pendingBalanceCents,
  };
}

export type SettlementPlan = {
  /** Baixa aplicada na própria parcela. */
  target: { id: string; paid_at: string; paid_amount_cents: number };
  /** Próxima parcela pendente reajustada por crédito ou pendência. */
  nextUpdate: {
    id: string;
    amount_cents: number;
    credit_applied_cents: number;
    carried_in_cents: number;
  } | null;
  /** Mês novo criado quando não havia parcela seguinte para receber a pendência. */
  insert: { number: number; amount_cents: number; due_date: string | null; carried_in_cents: number } | null;
  /** Crédito gerado por pagamento acima do valor da parcela. */
  creditCents: number;
  /** Crédito que sobrou sem parcela seguinte para abater. */
  creditLeftoverCents: number;
  /** Valor que faltou e foi transferido para o mês seguinte. */
  shortfallCents: number;
  /** Novo número de parcelas ativas do pedido. */
  totalInstallments: number;
};

/**
 * Acerto flexível de uma parcela: pagamento exato, maior (gera crédito abatido da
 * próxima parcela) ou parcial (o restante é somado à próxima parcela; se não houver,
 * cria um mês novo). Parcelas pagas anteriores nunca são alteradas.
 */
export function settleInstallment(
  order: StoreOrderWithDetails,
  parcel: StoreOrderInstallment,
  paidCents: number,
  paidDateISO: string,
): SettlementPlan {
  const active = order.installments_list.filter((p) => !p.merged_into_order_id);
  const paid = Math.max(0, Math.round(paidCents));
  const diff = paid - parcel.amount_cents;

  const next =
    pendingInstallments(order.installments_list)
      .filter((p) => p.id !== parcel.id && p.number > parcel.number)
      .sort((a, b) => a.number - b.number)[0] ?? null;

  const target = {
    id: parcel.id,
    // A data chega como "YYYY-MM-DD"; o meio-dia evita virada de fuso.
    paid_at: new Date(`${paidDateISO}T12:00:00`).toISOString(),
    paid_amount_cents: paid,
  };

  let nextUpdate: SettlementPlan["nextUpdate"] = null;
  let insert: SettlementPlan["insert"] = null;
  let creditLeftoverCents = 0;

  if (diff > 0 && next) {
    const applied = Math.min(diff, next.amount_cents);
    nextUpdate = {
      id: next.id,
      amount_cents: next.amount_cents - applied,
      credit_applied_cents: next.credit_applied_cents + applied,
      carried_in_cents: next.carried_in_cents,
    };
    creditLeftoverCents = diff - applied;
  } else if (diff > 0) {
    creditLeftoverCents = diff;
  } else if (diff < 0) {
    const shortfall = -diff;
    if (next) {
      nextUpdate = {
        id: next.id,
        amount_cents: next.amount_cents + shortfall,
        credit_applied_cents: next.credit_applied_cents,
        carried_in_cents: next.carried_in_cents + shortfall,
      };
    } else {
      const maxNumber = active.reduce((max, p) => Math.max(max, p.number), 0);
      const lastDue =
        [...active].sort((a, b) => a.number - b.number).at(-1)?.due_date ??
        parcel.due_date ??
        todayISO();
      insert = {
        number: maxNumber + 1,
        amount_cents: shortfall,
        due_date: addMonthsISO(lastDue, 1),
        carried_in_cents: shortfall,
      };
    }
  }

  return {
    target,
    nextUpdate,
    insert,
    creditCents: Math.max(0, diff),
    creditLeftoverCents,
    shortfallCents: Math.max(0, -diff),
    totalInstallments: active.length + (insert ? 1 : 0),
  };
}

/**
 * Distribui os itens do pedido pelas parcelas ativas, na ordem, para exibir no
 * extrato quais parcelas compõem cada produto e quais itens são cobrados em cada mês.
 */
export type ItemAllocation = {
  itemId: string;
  name: string;
  /** Números das parcelas que cobram este item. */
  numbers: number[];
};

export type InstallmentItemShare = {
  number: number;
  name: string;
  /** Posição desta cobrança entre as parcelas do item (ex: 1 de 3). */
  index: number;
  total: number;
  amountCents: number;
};

export function allocateItemsToInstallments(order: StoreOrderWithDetails): {
  byItem: ItemAllocation[];
  byInstallment: Map<number, InstallmentItemShare[]>;
} {
  // Cada parcela tem duas capacidades: a base (valor original do pedido) e o
  // extra (produtos acrescentados depois, registrados em added_extra_cents).
  // Créditos/pendências e unificações não representam produto, então ficam
  // fora da base alocável.
  const parcels = order.installments_list
    .filter((p) => !p.merged_into_order_id)
    .sort((a, b) => a.number - b.number)
    .map((p) => ({
      number: p.number,
      baseCapacity: Math.max(
        0,
        p.amount_cents - p.added_extra_cents - p.merged_extra_cents - p.carried_in_cents,
      ),
      extraCapacity: Math.max(0, p.added_extra_cents),
    }));
  const items = order.items.length
    ? order.items
    : [
        {
          id: order.id,
          order_id: order.id,
          name: order.item_name,
          unit_price_cents: order.amount_cents,
          sort_order: 0,
        },
      ];

  // Itens acrescentados entram por último (sort_order crescente). Percorrendo
  // do fim para o começo, separamos os itens cuja soma bate com o total de
  // added_extra_cents. Se a conta não fechar (dados antigos), tratamos tudo
  // como original: é o comportamento anterior, seguro como fallback.
  const totalAdded = parcels.reduce((sum, p) => sum + p.extraCapacity, 0);
  let appendedCount = 0;
  if (totalAdded > 0) {
    let acc = 0;
    for (let i = items.length - 1; i >= 0 && acc < totalAdded; i -= 1) {
      acc += items[i]?.unit_price_cents ?? 0;
      appendedCount += 1;
    }
    if (acc !== totalAdded) appendedCount = 0;
  }
  const originals = items.slice(0, items.length - appendedCount);
  const appended = items.slice(items.length - appendedCount);

  const byItem: ItemAllocation[] = [];
  const shares = new Map<number, InstallmentItemShare[]>();

  // Preenche as parcelas em ordem usando a capacidade escolhida, atribuindo a
  // cada item as parcelas que de fato o cobram.
  const allocate = (list: typeof items, key: "baseCapacity" | "extraCapacity") => {
    let cursor = 0;
    for (const item of list) {
      let remaining = item.unit_price_cents;
      const hits: { number: number; amountCents: number }[] = [];
      while (remaining > 0 && cursor < parcels.length) {
        const parcel = parcels[cursor];
        if (!parcel) break;
        if (parcel[key] <= 0) {
          cursor += 1;
          continue;
        }
        const used = Math.min(parcel[key], remaining);
        parcel[key] -= used;
        remaining -= used;
        hits.push({ number: parcel.number, amountCents: used });
        if (parcel[key] === 0) cursor += 1;
      }
      byItem.push({ itemId: item.id, name: item.name, numbers: hits.map((h) => h.number) });
      hits.forEach((hit, index) => {
        const entry = shares.get(hit.number) ?? [];
        entry.push({
          number: hit.number,
          name: item.name,
          index: index + 1,
          total: hits.length,
          amountCents: hit.amountCents,
        });
        shares.set(hit.number, entry);
      });
    }
  };

  allocate(originals, "baseCapacity");
  allocate(appended, "extraCapacity");

  return { byItem, byInstallment: shares };
}


export async function fetchStoreOrders(): Promise<StoreOrderWithDetails[]> {
  const { data, error } = await supabase
    .from("store_orders")
    .select(
      // O apontamento explícito da chave estrangeira evita ambiguidade: parcelas
      // referenciam store_orders por order_id e por merged_into_order_id.
      "id, created_at, store_client_id, client_name, client_phone, item_name, amount_cents, payment_method, installments, delivery_date, status, notes, store_clients(nickname), store_order_items(id, order_id, name, unit_price_cents, sort_order), store_order_installments!store_order_installments_order_id_fkey(id, order_id, number, amount_cents, due_date, paid_at, merged_into_order_id, merged_extra_cents, added_extra_cents, paid_amount_cents, credit_applied_cents, carried_in_cents)",
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
