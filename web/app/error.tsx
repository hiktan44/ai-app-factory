"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-5xl mb-4">\u26a0\ufe0f</span>
      <h2 className="text-xl font-bold text-content mb-2">
        Bir hata olu\u015ftu
      </h2>
      <p className="text-sm text-content-muted mb-6 max-w-md">
        {error.message || "Beklenmeyen bir hata olu\u015ftu. L\u00fctfen tekrar deneyin."}
      </p>
      <Button onClick={reset}>Tekrar Dene</Button>
    </div>
  );
}
