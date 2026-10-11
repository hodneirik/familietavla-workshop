import { useEffect } from "react";

/** Kjører `last` med en gang, hvert tiende sekund, og når fanen blir synlig igjen. */
export function usePolling(last: () => Promise<void>, ms = 10_000): void {
  useEffect(() => {
    void last();
    const timer = setInterval(() => void last(), ms);
    const ved = () => document.visibilityState === "visible" && void last();
    document.addEventListener("visibilitychange", ved);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ved);
    };
  }, [last, ms]);
}
