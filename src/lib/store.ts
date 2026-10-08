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
  /** Primeira parcela que cobra este item (1 para itens do pedido original). */
  start_installment: number | null;
  /** Em quantas parcelas o item foi dividido. */
  installments_count: number | null;
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
  /** Cobrança gerada no Mercado Pago para esta parcela (opcional). */
  mp_payment_id?: string | null;
  mp_method?: string | null;
  mp_status?: string | null;
  pix_copia_e_cola?: string | null;
  pix_qr_code_base64?: string | null;
  boleto_linha_digitavel?: string | null;
  boleto_pdf_url?: string | null;
  boleto_expires_on?: string | null;
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
  /** Quando preenchido, o pedido foi arquivado (quitado) e sai da lista principal. */
  archived_at: string | null;
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
 * Remove o valor de um item do pedido e REDIVIDE o saldo restante igualmente entre
 * as parcelas pendentes (ex.: 4x R$100, remove R$100 → 4x R$75). Parcelas pagas
 * nunca são alteradas; só sobra parcela apagada quando o saldo zera.
 */
export function removeItemInstallments(
  order: StoreOrderWithDetails,
  removedCents: number,
  item?: Pick<StoreOrderItem, "start_installment" | "installments_count">,
): ItemRemovalPlan {
  const start = item?.start_installment ?? 1;
  const span = item?.installments_count ?? 0;
  // Item acrescentado com cobrança a partir de uma parcela posterior: o estorno
  // fica restrito às parcelas que o receberam; as anteriores não são tocadas.
  if (start > 1 && span > 0) return removeScopedItem(order, removedCents, start, span);
  const active = order.installments_list.filter((p) => !p.merged_into_order_id);
  const paid = active.filter((p) => p.paid_at);
  const pending = pendingInstallments(order.installments_list).sort((a, b) => a.number - b.number);
  const removed = Math.max(0, removedCents);
  const pendingTotal = pending.reduce((sum, p) => sum + p.amount_cents, 0);
  const applied = Math.min(removed, pendingTotal);
  const newBalance = pendingTotal - applied;

  const update: ItemRemovalPlan["update"] = [];
  const deleteIds: string[] = [];
  if (pending.length > 0) {
    if (newBalance > 0) {
      const shares = splitFirstHeavy(newBalance, pending.length);
      pending.forEach((parcel, i) => {
        const amount = shares[i] ?? 0;
        // O saldo redividido vira a nova base: zerar o extra evita que acréscimos
        // futuros herdem o valor antigo e exibam "inclui" maior que o produto novo.
        update.push({
          id: parcel.id,
          amount_cents: amount,
          added_extra_cents: 0,
        });
      });
    } else {
      // Saldo zerado: remove as pendentes, mantendo uma se não houver nenhuma paga.
      pending.forEach((parcel, i) => {
        if (i === 0 && paid.length === 0) {
          update.push({ id: parcel.id, amount_cents: 0, added_extra_cents: 0 });
        } else {
          deleteIds.push(parcel.id);
        }
      });
    }
  }

  return {
    update,
    deleteIds,
    newTotalCents: Math.max(0, order.amount_cents - removed),
    totalInstallments: Math.max(1, paid.length + pending.length - deleteIds.length),
    pendingBalanceCents: newBalance,
    unappliedCents: removed - applied,
  };
}

/** Remove a fração do item só das parcelas [start, start+span-1]. */
function removeScopedItem(
  order: StoreOrderWithDetails,
  removedCents: number,
  start: number,
  span: number,
): ItemRemovalPlan {
  const active = order.installments_list
    .filter((p) => !p.merged_into_order_id)
    .sort((a, b) => a.number - b.number);
  const removed = Math.max(0, removedCents);
  const shares = splitFirstHeavy(removed, span);
  const update: ItemRemovalPlan["update"] = [];
  const zeroed = new Set<string>();
  let applied = 0;
  for (let i = 0; i < span; i += 1) {
    const parcel = active.find((p) => p.number === start + i);
    const share = shares[i] ?? 0;
    if (!parcel || parcel.paid_at) continue;
    const cut = Math.min(share, parcel.amount_cents);
    applied += cut;
    const amount = parcel.amount_cents - cut;
    update.push({
      id: parcel.id,
      amount_cents: amount,
      added_extra_cents: Math.max(0, parcel.added_extra_cents - cut),
    });
    if (amount === 0) zeroed.add(parcel.id);
  }
  // Só apaga parcelas zeradas no fim do cronograma (meses criados para o item).
  const deleteIds: string[] = [];
  for (let i = active.length - 1; i >= 0; i -= 1) {
    const p = active[i];
    if (!p || !zeroed.has(p.id) || active.length - deleteIds.length <= 1) break;
    deleteIds.push(p.id);
  }
  const finalUpdate = update.filter((u) => !deleteIds.includes(u.id));
  const pendingAfter = active
    .filter((p) => !p.paid_at && !deleteIds.includes(p.id))
    .reduce((sum, p) => sum + (finalUpdate.find((u) => u.id === p.id)?.amount_cents ?? p.amount_cents), 0);
  return {
    update: finalUpdate,
    deleteIds,
    newTotalCents: Math.max(0, order.amount_cents - removed),
    totalInstallments: Math.max(1, active.length - deleteIds.length),
    pendingBalanceCents: pendingAfter,
    unappliedCents: removed - applied,
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
    /** Fração deste acréscimo nesta parcela (só para exibição). */
    share_cents: number;
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
  /** Número da parcela onde a cobrança começa; null = após a última (meses novos). */
  startNumber: number | null = null,
): InstallmentPlanChange {
  const active = order.installments_list.filter((p) => !p.merged_into_order_id);
  const paid = active.filter((p) => p.paid_at);
  const allPending = pendingInstallments(order.installments_list).sort(
    (a, b) => a.number - b.number,
  );
  // Só as parcelas a partir do mês escolhido recebem o acréscimo.
  const pending =
    startNumber === null ? [] : allPending.filter((p) => p.number >= startNumber);

  const n = Math.max(1, Math.floor(count) || 1);
  const amounts = splitFirstHeavy(Math.max(0, addedCents), n);

  const maxNumber = active.reduce((max, p) => Math.max(max, p.number), 0);
  // Novos meses continuam a partir do último vencimento existente do pedido.
  // Cliente que volta após meses: não gera vencimentos no passado.
  const rawLastDue =
    [...active].sort((a, b) => a.number - b.number).at(-1)?.due_date ??
    order.delivery_date ??
    todayISO();
  const lastDue = rawLastDue < todayISO() ? todayISO() : rawLastDue;

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
        share_cents: share,
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
    allPending.reduce((sum, p) => sum + p.amount_cents, 0) + Math.max(0, addedCents);

  return {
    update,
    insert,
    totalInstallments: paid.length + allPending.length + insert.length,
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
  /**
   * Estorno do efeito de uma baixa anterior desta mesma parcela em outra parcela
   * (usado quando a parcela seguinte que recebeu a pendência/crédito não é a que
   * será ajustada agora).
   */
  revertUpdate: {
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

  const sorted = [...active].sort((a, b) => a.number - b.number);

  // Parcela vizinha que recebeu (ou receberá) crédito/pendência desta parcela.
  const neighbour = sorted.find((p) => p.number > parcel.number) ?? null;

  // Estorna o efeito de uma baixa anterior desta mesma parcela, para que reajustar
  // o valor pago não deixe a pendência/crédito antigo somado na parcela seguinte.
  let baseNeighbour = neighbour ? { ...neighbour } : null;
  if (baseNeighbour && parcel.paid_at) {
    const prevDiff = parcel.paid_amount_cents - parcel.amount_cents;
    if (prevDiff < 0) {
      const undo = Math.min(-prevDiff, baseNeighbour.carried_in_cents);
      baseNeighbour = {
        ...baseNeighbour,
        amount_cents: Math.max(0, baseNeighbour.amount_cents - undo),
        carried_in_cents: baseNeighbour.carried_in_cents - undo,
      };
    } else if (prevDiff > 0) {
      const undo = Math.min(prevDiff, baseNeighbour.credit_applied_cents);
      baseNeighbour = {
        ...baseNeighbour,
        amount_cents: baseNeighbour.amount_cents + undo,
        credit_applied_cents: baseNeighbour.credit_applied_cents - undo,
      };
    }
  }

  const neighbourChanged =
    baseNeighbour !== null &&
    neighbour !== null &&
    (baseNeighbour.amount_cents !== neighbour.amount_cents ||
      baseNeighbour.carried_in_cents !== neighbour.carried_in_cents ||
      baseNeighbour.credit_applied_cents !== neighbour.credit_applied_cents);

  // Aplica o novo acerto na parcela vizinha quando ela ainda está em aberto;
  // caso já esteja paga, procura a próxima pendente adiante.
  const next =
    baseNeighbour && !baseNeighbour.paid_at
      ? baseNeighbour
      : (pendingInstallments(order.installments_list)
          .filter((p) => p.id !== parcel.id && p.number > parcel.number)
          .sort((a, b) => a.number - b.number)[0] ?? null);

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
      const lastDue = sorted.at(-1)?.due_date ?? parcel.due_date ?? todayISO();
      insert = {
        number: maxNumber + 1,
        amount_cents: shortfall,
        due_date: addMonthsISO(lastDue, 1),
        carried_in_cents: shortfall,
      };
    }
  }

  // Quando o estorno recaiu numa parcela diferente da ajustada agora, grava-o separadamente.
  const revertUpdate =
    neighbourChanged && baseNeighbour && baseNeighbour.id !== nextUpdate?.id
      ? {
          id: baseNeighbour.id,
          amount_cents: baseNeighbour.amount_cents,
          credit_applied_cents: baseNeighbour.credit_applied_cents,
          carried_in_cents: baseNeighbour.carried_in_cents,
        }
      : null;

  return {
    target,
    nextUpdate,
    revertUpdate,
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
  /** Valor cobrado por parcela (usado no rótulo "3x de R$ ..."). */
  perInstallmentCents: number;
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
  const items: StoreOrderItem[] = order.items.length
    ? order.items
    : [
        {
          id: order.id,
          order_id: order.id,
          name: order.item_name,
          unit_price_cents: order.amount_cents,
          sort_order: 0,
          start_installment: 1,
          installments_count: Math.max(1, order.installments),
        },
      ];

  const byItem: ItemAllocation[] = [];
  const shares = new Map<number, InstallmentItemShare[]>();

  const pushShares = (
    item: StoreOrderItem,
    hits: { number: number; amountCents: number }[],
  ) => {
    byItem.push({
      itemId: item.id,
      name: item.name,
      numbers: hits.map((h) => h.number),
      perInstallmentCents: hits.length > 0 ? Math.round(item.unit_price_cents / hits.length) : item.unit_price_cents,
    });
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
  };

  // Caminho preferencial: cada item guarda a parcela inicial e a quantidade de
  // parcelas, então o vínculo é exato — parcelasInclusas = [inicial, inicial+1, ...].
  const explicit = items.filter((i) => i.start_installment && i.installments_count);
  if (explicit.length === items.length) {
    for (const item of items) {
      const start = Math.max(1, item.start_installment ?? 1);
      const count = Math.max(1, item.installments_count ?? 1);
      const amounts = splitFirstHeavy(item.unit_price_cents, count);
      const hits = Array.from({ length: count }, (_, i) => ({
        number: start + i,
        amountCents: amounts[i] ?? 0,
      }));
      pushShares(item, hits);
    }
    return { byItem, byInstallment: shares };
  }

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

  // Preenche as parcelas em ordem usando a capacidade escolhida, atribuindo a
  // cada item as parcelas que de fato o cobram.
  const allocate = (list: StoreOrderItem[], key: "baseCapacity" | "extraCapacity") => {
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
      pushShares(item, hits);
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
      "id, created_at, archived_at, store_client_id, client_name, client_phone, item_name, amount_cents, payment_method, installments, delivery_date, status, notes, store_clients(nickname), store_order_items(id, order_id, name, unit_price_cents, sort_order, start_installment, installments_count), store_order_installments!store_order_installments_order_id_fkey(id, order_id, number, amount_cents, due_date, paid_at, merged_into_order_id, merged_extra_cents, added_extra_cents, paid_amount_cents, credit_applied_cents, carried_in_cents, mp_payment_id, mp_method, mp_status, pix_copia_e_cola, pix_qr_code_base64, boleto_linha_digitavel, boleto_pdf_url, boleto_expires_on)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const joined = (row as { store_clients: unknown }).store_clients;
    const client = Array.isArray(joined) ? joined[0] : joined;
    return {
      id: row.id,
      created_at: row.created_at ?? null,
      archived_at: row.archived_at ?? null,
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
      items: [...(row.store_order_items ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          ...i,
          start_installment: i.start_installment ?? null,
          installments_count: i.installments_count ?? null,
        })),
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


/** Vencimento pendente mais próximo do pedido (faturas pagas não contam). */
export function nextPendingDue(order: StoreOrderWithDetails): string | null {
  const dues = pendingInstallments(order.installments_list)
    .map((p) => p.due_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dues[0] ?? null;
}

/** Aviso de cobrança: parcela pendente vencida ou que vence até amanhã. */
export function needsCollection(order: StoreOrderWithDetails): boolean {
  const due = nextPendingDue(order);
  return due !== null && due <= tomorrowISO();
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Pedido sem nenhuma parcela em aberto (pode ser arquivado). */
export function isFullyPaid(order: StoreOrderWithDetails): boolean {
  return pendingInstallments(order.installments_list).length === 0;
}

/** Maior número de parcela já usado nos pedidos do cliente (para continuar a numeração). */
export function lastInstallmentNumber(orders: StoreOrderWithDetails[], clientId: string): number {
  return orders
    .filter((o) => o.store_client_id === clientId)
    .flatMap((o) => o.installments_list.filter((p) => !p.merged_into_order_id))
    .reduce((max, p) => Math.max(max, p.number), 0);
}


/**
 * Estorno de baixa: quando uma parcela volta para pendente, desfaz o crédito (troco)
 * ou a falta que a baixa jogou na parcela seguinte e zera o valor pago, para o
 * sistema nunca presumir que a cliente pagará de novo o mesmo valor.
 */
export function undoSettlement(
  order: StoreOrderWithDetails,
  parcel: StoreOrderInstallment,
): { neighbour: { id: string; amount_cents: number; credit_applied_cents: number; carried_in_cents: number } | null } {
  const diff = parcel.paid_amount_cents > 0 ? parcel.paid_amount_cents - parcel.amount_cents : 0;
  if (diff === 0) return { neighbour: null };
  // O troco/falta vai sempre para a próxima parcela em aberto (mesma regra da baixa).
  const next =
    order.installments_list
      .filter((p) => !p.merged_into_order_id && p.number > parcel.number && !p.paid_at)
      .sort((a, b) => a.number - b.number)[0] ?? null;
  if (!next) return { neighbour: null };
  if (diff > 0) {
    const undo = Math.min(diff, next.credit_applied_cents);
    if (undo === 0) return { neighbour: null };
    return {
      neighbour: {
        id: next.id,
        amount_cents: next.amount_cents + undo,
        credit_applied_cents: next.credit_applied_cents - undo,
        carried_in_cents: next.carried_in_cents,
      },
    };
  }
  const undo = Math.min(-diff, next.carried_in_cents);
  if (undo === 0) return { neighbour: null };
  return {
    neighbour: {
      id: next.id,
      amount_cents: Math.max(0, next.amount_cents - undo),
      credit_applied_cents: next.credit_applied_cents,
      carried_in_cents: next.carried_in_cents - undo,
    },
  };
}
