import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_OPTIONS, OTHER_CATEGORY, isCustomCategory } from "@/lib/store-categories";

/**
 * Seletor de marca/categoria do produto. Ao escolher "Outros",
 * a administradora digita o nome da loja/marca avulsa, que passa a ser
 * a categoria oficial exibida para as clientes.
 */
export function ProductCategoryPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const custom = isCustomCategory(value);
  const selected = custom ? OTHER_CATEGORY : value;

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Marca / Categoria</Label>
      <select
        id={id}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        value={selected}
        onChange={(e) => onChange(e.target.value === OTHER_CATEGORY ? "" : e.target.value)}
      >
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {selected === OTHER_CATEGORY ? (
        <Input
          aria-label="Nome da nova loja/marca"
          className="mt-2"
          maxLength={40}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite a marca (ex: Mary Kay, Racco...)"
        />
      ) : null}
    </div>
  );
}
