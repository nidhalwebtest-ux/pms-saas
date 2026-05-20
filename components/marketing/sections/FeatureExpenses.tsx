import FeatureBlock from "./FeatureBlock";
import { MobileApprovalMock } from "../mocks";

export default function FeatureExpenses() {
  return (
    <FeatureBlock
      id="expenses"
      screenLabel="Feature · Expenses"
      flip
      tinted
      eyebrow="04 · Expense approvals"
      title="Approve expenses from your phone."
      description="The receptionist photographs the receipt. You approve with one tap, from the back seat of the car. No more driving to a building just to sign off on cleaning supplies."
      bullets={[
        "Submit expenses with a receipt photo",
        "Manager mobile approval — one tap",
        "Accountant processing workflow",
        "Building-level expense tracking",
        "Category breakdowns & monthly limits",
      ]}
      linkLabel="See the approval flow"
      linkHref="#expenses"
      visual={<MobileApprovalMock />}
    />
  );
}
