import { getSettings } from "@/lib/settings";
import ReserveWidgetClient from "./ReserveWidgetClient";

export default async function ReserveWidget() {
  const settings = await getSettings();
  return (
    <ReserveWidgetClient
      restaurantName={settings.restaurantName}
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
      depositsEnabled={settings.depositsEnabled}
      depositAmount={settings.depositAmount}
      depositMinParty={settings.depositMinParty}
      depositMessage={settings.depositMessage}
    />
  );
}
