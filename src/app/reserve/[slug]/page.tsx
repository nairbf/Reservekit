import { getSettings } from "@/lib/settings";
import ReserveWidgetClient from "./ReserveWidgetClient";

export default async function ReserveWidget() {
  const settings = await getSettings();
  return <ReserveWidgetClient restaurantName={settings.restaurantName} />;
}
