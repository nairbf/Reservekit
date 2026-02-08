"use client";
import { useEffect, useRef } from "react";
import ReserveWidgetClient from "../[slug]/ReserveWidgetClient";

interface EmbedWidgetFrameProps {
  restaurantName: string;
  theme: "light" | "dark";
  accent?: string;
}

export default function EmbedWidgetFrame({ restaurantName, theme, accent }: EmbedWidgetFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sendHeight = () => {
      const measured = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        rootRef.current?.scrollHeight || 0
      );
      window.parent?.postMessage({ type: "reservekit-resize", height: measured }, "*");
    };

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    if (rootRef.current) observer.observe(rootRef.current);

    const timer = window.setInterval(sendHeight, 500);
    window.addEventListener("resize", sendHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sendHeight);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div ref={rootRef} className="bg-transparent p-0 m-0">
      <ReserveWidgetClient restaurantName={restaurantName} embedded theme={theme} accent={accent} />
    </div>
  );
}
