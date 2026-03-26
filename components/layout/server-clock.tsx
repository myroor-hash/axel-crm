"use client";

import { useEffect, useMemo, useState } from "react";

const UK_TIME_ZONE = "Europe/London";

export function ServerClock() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: UK_TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    []
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: UK_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    []
  );

  useEffect(() => {
    let intervalId: number | undefined;
    let isCancelled = false;

    async function loadServerTime() {
      try {
        const response = await fetch("/api/server-time", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { now?: string }
          | null;

        const parsed = payload?.now ? new Date(payload.now) : new Date();
        const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

        if (isCancelled) {
          return;
        }

        setCurrentTime(safeDate);
        intervalId = window.setInterval(() => {
          setCurrentTime((previous) =>
            previous ? new Date(previous.getTime() + 1000) : new Date()
          );
        }, 1000);
      } catch {
        if (isCancelled) {
          return;
        }

        const fallback = new Date();
        setCurrentTime(fallback);
        intervalId = window.setInterval(() => {
          setCurrentTime((previous) =>
            previous ? new Date(previous.getTime() + 1000) : new Date()
          );
        }, 1000);
      }
    }

    loadServerTime();

    return () => {
      isCancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  if (!currentTime) {
    return (
      <span className="text-sm font-medium text-slate-500">
        -- --- ---- - --:--:--
      </span>
    );
  }

  return (
    <span className="text-sm font-medium text-slate-500">
      {dateFormatter.format(currentTime)} - {timeFormatter.format(currentTime)}
    </span>
  );
}
