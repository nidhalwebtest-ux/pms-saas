import { getTranslations } from "next-intl/server";
import { BridgeBeat } from "./BridgeBeat";

/* Landing v2 · section 3 (the turn: «الحل؟» → Binaya). Copy lives in messages: marketing.story. */
export default async function BridgeSection() {
  const t = await getTranslations("marketing.story");
  return <BridgeBeat question={t("bridgeQ")} tagline={t("bridgeTagline")} body={t("bridgeBody")} markLabel={t("markLabel")} />;
}
