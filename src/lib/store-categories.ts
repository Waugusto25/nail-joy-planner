/** Marcas/categorias fixas da Loja. "Outros" abre campo livre para marca avulsa. */
export const STORE_CATEGORIES = [
  "Loja",
  "Natura",
  "Avon",
  "O Boticário",
  "Eudora",
] as const;

export const OTHER_CATEGORY = "Outros";

/** Opções do seletor no cadastro/edição de produtos. */
export const CATEGORY_OPTIONS = [...STORE_CATEGORIES, OTHER_CATEGORY];

/** True quando a categoria salva é uma marca avulsa digitada pela administradora. */
export function isCustomCategory(category: string | null | undefined) {
  return !!category && !STORE_CATEGORIES.includes(category as (typeof STORE_CATEGORIES)[number]);
}

/** Abas da vitrine da cliente: Todas + fixas + marcas avulsas cadastradas. */
export function storeTabs(categories: (string | null)[]) {
  const extras = Array.from(
    new Set(categories.filter((c): c is string => isCustomCategory(c))),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return ["Todas", ...STORE_CATEGORIES, ...extras];
}
