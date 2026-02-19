"use client";

import LandingBuilder from "@/components/landing-builder";
import type { SettingsTabProps } from "./page";

export function RestaurantTab({ settings, savePartial }: SettingsTabProps) {
  return <LandingBuilder settings={settings} onSavePartial={savePartial} />;
}
