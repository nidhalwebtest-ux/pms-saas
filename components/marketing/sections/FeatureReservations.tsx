import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { ReservationMock } from "../mocks";

export default async function FeatureReservations() {
  const t = await getTranslations("marketing.featureReservations");
  return (
    <FeatureBlock
      id="reservations"
      screenLabel="Feature · Reservations"
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      bullets={[t("b1"), t("b2"), t("b3"), t("b4"), t("b5")]}
      linkLabel={t("linkLabel")}
      linkHref="#reservations"
      visual={<ReservationMock />}
    />
  );
}
