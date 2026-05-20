import FeatureBlock from "./FeatureBlock";
import { InvoiceMock } from "../mocks";

export default function FeatureFinance() {
  return (
    <FeatureBlock
      id="finance"
      screenLabel="Feature · Finance"
      flip
      tinted
      eyebrow="02 · Financial operations"
      title="Track every riyal — to three decimals."
      description="Built for Omani Rial from day one. Invoices generate themselves, payments record in cash or card or transfer, and your cashier reconciliation takes two minutes instead of two hours."
      bullets={[
        "Multi-method payments — cash, card, bank transfer",
        "Auto invoice generation with VAT & Khareef rates",
        "Tenant ledger with full payment history",
        "Refunds and returns handled correctly",
        "Real-time outstanding balance tracking",
      ]}
      linkLabel="Tour the finance module"
      linkHref="#finance"
      visual={<InvoiceMock />}
    />
  );
}
