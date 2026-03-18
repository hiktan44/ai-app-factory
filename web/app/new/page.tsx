import { RunForm } from "@/components/new-run/run-form";

export default function NewRunPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Yeni Pipeline Ba\u015flat
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Bir kategori se\u00e7in ve otonom uygulama \u00fcretimini ba\u015flat\u0131n
        </p>
      </div>
      <RunForm />
    </div>
  );
}
