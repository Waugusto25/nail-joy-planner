import { useState, type ReactNode } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientAccordionCardProps {
  name: string;
  nickname?: string | null;
  phoneLabel: string;
  /** Link do WhatsApp; null esconde o atalho (ex.: sem telefone). */
  whatsappHref: string | null;
  onWhatsappClick?: (() => Promise<boolean>) | undefined;
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Card de cliente recolhido em linha única. O atalho do WhatsApp abre o chat
 * sem expandir o card; clicar no restante revela as ações internas.
 */
export function ClientAccordionCard({
  name,
  nickname,
  phoneLabel,
  whatsappHref,
  onWhatsappClick,
  badge,
  children,
}: ClientAccordionCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <article className="surface-card px-3 py-2">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex cursor-pointer items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir WhatsApp de ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!onWhatsappClick) return;
              e.preventDefault();
              void onWhatsappClick().then((handled) => {
                if (!handled) window.open(whatsappHref, "_blank", "noopener");
              });
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700"
          >
            <MessageCircle className="size-4" />
          </a>
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-display text-base leading-tight">
            <span className="truncate">{name}</span>
            {badge}
          </p>
          <p className="truncate text-xs">
            {nickname ? <span className="font-medium text-primary">{nickname} · </span> : null}
            <span className="text-muted-foreground">{phoneLabel}</span>
          </p>
        </div>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </div>
      {open ? <div className="mt-3 border-t border-border pt-3">{children}</div> : null}
    </article>
  );
}
