import { ListChecks, Table, Car, ScrollText } from "lucide-react";
import Container, { SectionHead } from "../ui/Container";

const PROBLEMS = [
  {
    Icon: ListChecks,
    title: "Lost bookings during Khareef",
    body: "Your receptionist does not know which units are available across buildings — and the caller hangs up.",
  },
  {
    Icon: Table,
    title: "Spreadsheet chaos",
    body: "Reservations in one sheet, payments in another, expenses in a third. Three people, three versions of the truth.",
  },
  {
    Icon: Car,
    title: "Manager driving between buildings",
    body: "Hours wasted approving expenses in person and checking cash boxes that should already be reconciled.",
  },
  {
    Icon: ScrollText,
    title: "End-of-day reconciliation nightmares",
    body: "Counting cash that does not match the receipts, every single night, in the back office.",
  },
];

export default function ProblemSection() {
  return (
    <section data-screen-label="Problem" className="py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow="The reality"
          title="Sound familiar?"
          description="Most property managers in Salalah run their business on three tools: a spreadsheet, a WhatsApp group, and good memory. It works — until Khareef starts."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map(({ Icon, title, body }) => (
            <article key={title} className="relative rounded-lg border border-gray-200 bg-white p-7">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-[10px] bg-error-50 text-error-500">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="mb-1.5 text-base font-semibold tracking-tight">{title}</h3>
              <p className="m-0 text-sm leading-[1.55] text-gray-600">{body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
