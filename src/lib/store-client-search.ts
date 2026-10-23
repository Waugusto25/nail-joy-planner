type SearchableClient = {
  full_name: string;
  nickname?: string | null;
  phone: string;
};

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function matchesStoreClient(client: SearchableClient, query: string): boolean {
  const search = normalizeSearch(query);
  if (!search) return true;
  const name = normalizeSearch(`${client.full_name} ${client.nickname ?? ""}`);
  if (name.includes(search)) return true;
  const digits = query.replace(/\D/g, "");
  return digits.length > 0 && /^[\d\s()+.-]+$/.test(query) && client.phone.replace(/\D/g, "").includes(digits);
}