import { useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayName, type StoreClient } from "@/lib/store";
import { matchesStoreClient } from "@/lib/store-client-search";

type StoreClientPickerProps = {
  clients: StoreClient[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

export function StoreClientPicker({ clients, value, onChange, loading, error, onRetry }: StoreClientPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = clients.find((client) => client.id === value);
  const filtered = clients.filter((client) => matchesStoreClient(client, search));

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover open={open} onOpenChange={(next) => { setOpen(next); setSearch(""); }}>
        <PopoverTrigger asChild>
          <Button
            id="order-client"
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Cliente da loja"
            aria-expanded={open}
            aria-controls="order-client-list"
            disabled={loading}
            className="h-10 min-w-0 flex-1 justify-between gap-2 font-normal"
          >
            <span className="truncate">{loading ? "Carregando clientes..." : selected ? displayName(selected) : "Selecione um cliente cadastrado"}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
          onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}
        >
          <Command shouldFilter={false}>
            <CommandInput ref={inputRef} aria-label="Buscar cliente" placeholder="Buscar cliente..." value={search} onValueChange={setSearch} />
            {error ? (
              <div className="space-y-2 p-3 text-sm text-muted-foreground">
                <p>Não foi possível carregar os clientes.</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button>
              </div>
            ) : (
              <>
                <p className="border-b px-3 py-2 text-xs text-muted-foreground" aria-live="polite">{filtered.length} cliente(s) encontrado(s)</p>
                <CommandList id="order-client-list" className="max-h-60 overscroll-contain">
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filtered.map((client) => (
                      <CommandItem key={client.id} value={client.id} onSelect={() => { onChange(client.id); setOpen(false); setSearch(""); }} className="min-h-12 cursor-pointer">
                        {value === client.id ? <Check className="size-4 shrink-0 text-primary" /> : <span className="size-4 shrink-0" />}
                        <span className="min-w-0 flex-1">
                          <span className="block break-words">{displayName(client)}</span>
                          <span className="block text-xs text-muted-foreground">{client.phone}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {value ? <Button type="button" size="icon" variant="ghost" aria-label="Limpar seleção de cliente" title="Limpar seleção de cliente" onClick={() => onChange("")}><X className="size-4" /></Button> : null}
    </div>
  );
}