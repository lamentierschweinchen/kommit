"use client";

import { useEffect, useState } from "react";
import { ROTATING_WORDS } from "@/lib/mock-data";

export function HeroRotatingWord({
  intervalMs = 2200,
  className = "",
}: {
  intervalMs?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % ROTATING_WORDS.length), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <span
      key={i}
      className={`inline-block animate-in fade-in slide-in-from-bottom-2 duration-500 ${className}`}
    >
      {ROTATING_WORDS[i]}
    </span>
  );
}
