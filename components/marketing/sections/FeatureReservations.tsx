import FeatureBlock from "./FeatureBlock";
import { ReservationMock } from "../mocks";

export default function FeatureReservations() {
  return (
    <FeatureBlock
      id="reservations"
      screenLabel="Feature · Reservations"
      eyebrow="01 · Reservations"
      title="Never miss a booking again."
      description="Create a reservation in under 30 seconds. Daily or monthly stays, mix multiple units in one booking, automatic pricing with Khareef rates already baked in."
      bullets={[
        "Multi-unit reservations across buildings",
        "Automatic invoice generation with VAT",
        "Online check-in & check-out flow",
        "Guest history & repeat-stay tracking",
        "Real-time availability — no double bookings, ever",
      ]}
      linkLabel="See the reservations workflow"
      linkHref="#reservations"
      visual={<ReservationMock />}
    />
  );
}
