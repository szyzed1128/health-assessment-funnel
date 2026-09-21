import { Suspense } from "react";

import CheckoutPageClient from "@/app/checkout/checkout-page-client";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="assessment-shell"><p className="muted">正在准备模拟支付...</p></main>}>
      <CheckoutPageClient />
    </Suspense>
  );
}
