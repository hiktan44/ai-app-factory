import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-5xl mb-4">404</span>
      <h2 className="text-xl font-bold text-content mb-2">
        Sayfa Bulunamad\u0131
      </h2>
      <p className="text-sm text-content-muted mb-6">
        Arad\u0131\u011f\u0131n\u0131z sayfa mevcut de\u011fil veya ta\u015f\u0131nm\u0131\u015f olabilir.
      </p>
      <Link href="/">
        <Button>Ana Sayfaya D\u00f6n</Button>
      </Link>
    </div>
  );
}
