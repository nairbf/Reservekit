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

  return <EmbedWidgetFrame restaurantName={settings.restaurantName} theme={theme} accent={accent} />;
}
