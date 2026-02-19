import { getSettings } from "@/lib/settings";
import EmbedWidgetFrame from "./EmbedWidgetFrame";

export default async function ReserveEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; accent?: string }>;
}) {
  const settings = await getSettings();
  const params = await searchParams;
  const theme = params.theme === "dark" ? "dark" : "light";
  const accent = params.accent;

  return (
    <EmbedWidgetFrame
      restaurantName={settings.restaurantName}
      theme={theme}
      accent={accent}
      reserveHeading={settings.reserveHeading}
      reserveSubheading={settings.reserveSubheading}
      reserveConfirmationMessage={settings.reserveConfirmationMessage}
      reserveRequestDisclaimer={settings.reserveRequestDisclaimer}
      reserveRequestPlaceholder={settings.reserveRequestPlaceholder}
      reserveRequestSamples={settings.reserveRequestSamples}
      loyaltyOptInEnabled={settings.loyaltyOptInEnabled}
      loyaltyProgramName={settings.loyaltyProgramName}
      loyaltyOptInMessage={settings.loyaltyOptInMessage}
      loyaltyOptInLabel={settings.loyaltyOptInLabel}
      depositsEnabled={settings.depositEnabled}
      depositType={settings.depositType}
      depositAmount={settings.depositAmount}
      depositMinParty={settings.depositMinPartySize}
      depositMessage={settings.depositMessage}
    />
  );
}
