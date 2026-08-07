import { OWNER_NAME, SALON_NAME } from "@/lib/salon";

export function BrandMark({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center">
      <p className="text-script text-3xl leading-tight text-primary sm:text-4xl">{SALON_NAME}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.28em] text-muted-foreground">
        {subtitle ?? OWNER_NAME}
      </p>
    </div>
  );
}