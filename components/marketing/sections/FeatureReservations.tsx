import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { ReservationMock } from "../mocks";

type Feature = { eyebrow: string; title: string; sub: string; bullets: string[] };

export default async function FeatureReservations() {
  const t = await getTranslations("marketing");
  const f = (t.raw("features") as Feature[])[0];
  return (
    <FeatureBlock
      id="features"
      screenLabel="Feature · Reservations"
      eyebrow={f.eyebrow}
      title={f.title}
      description={f.sub}
      bullets={f.bullets}
      visual={<ReservationMock />}
    />
  );
}
