import { Suspense } from "react";

import ResultPageClient from "@/app/result/result-page-client";

export default function ResultPage() {
  return (
    <Suspense fallback={<main className="assessment-shell"><p className="muted">正在加载测评结果...</p></main>}>
      <ResultPageClient />
    </Suspense>
  );
}
