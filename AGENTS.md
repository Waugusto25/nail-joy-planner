<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the store-order customer picker separate from order calculations; it only returns a client ID so selection/search changes cannot alter payment history or installment numbering.
- Keep manual-booking availability in a dedicated picker and pure calculation module, with admin-authorized schedule reads and save-time validation, so exceptional bookings do not bypass collision checks.
- Keep annual schedule-month navigation and date eligibility in a pure module using São Paulo time; the calendar must reuse existing schedule_months persistence and default-active semantics to preserve booking availability.
- WhatsApp delivery uses a transactional database outbox, token-authorized claims, wake-on-enqueue and bounded retries; only the server calls Evolution over HTTPS to protect credentials and preserve business writes on delivery failure.
- WhatsApp wake and retry callbacks must target the active Vercel production endpoint together; changing only one leaves immediate delivery and recovery on different deployments.
- Mercado Pago settlement is serialized in a token-authorized database function after fetching the official payment; payment ID, reference and amount must match the stored installment before settlement.
- Store-order editing opens the existing form in a bounded scrollable dialog, separate from new-order creation, so actions remain visible on mobile without changing calculation logic.
- Store receipts use payment deltas and remaining installment balance from the transactional outbox, never paid_at alone, to distinguish partial payment from settlement.
