"use client";

import { useEffect, useRef, useState } from "react";

const WORDS = [
  "billion dollar idea",
  "overnight sensation",
  "big dream",
  "dark horse",
  "napkin sketch",
  "shower thought",
  "garage startup",
  "dorm-room biz",
  "misfit",
];

export function HeroRotatingWord() {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % WORDS.length);
      setAnimKey((k) => k + 1);
    }, 1700);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <span
      key={animKey}
      className="word-rotate inline-block bg-black text-white px-4 py-2 mt-2 border-[3px] border-black shadow-brutal-purple max-w-full [overflow-wrap:anywhere]"
    >
      {WORDS[index]}
    </span>
  );
}
