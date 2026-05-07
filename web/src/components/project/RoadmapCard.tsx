import { Icon } from "@/components/common/Icon";

type RoadmapEntry = {
  /** Timing tag — "Now" for shipped, "Soon" for next, "v1" for the milestone. */
  when: "Now" | "Soon" | "v1";
  title: string;
  body: string;
};

const ENTRIES: RoadmapEntry[] = [
  {
    when: "Now",
    title: "Kommits accumulate while you stay.",
    body: "Every second on, your kommit count grows. Withdraw any time without losing what you've earned — the count freezes at withdrawal, it doesn't reset.",
  },
  {
    when: "Soon",
    title: "React and ask questions on updates.",
    body: "Founders post; kommitters react and reply. The signal flows both ways — you know what changed; they know what backers care about.",
  },
  {
    when: "v1",
    title: "Priority access when they raise.",
    body: "When a team you backed opens a round — token, equity, SAFE — kommit holders get first allocation. Highest kommits, first in line.",
  },
  {
    when: "v1",
    title: "First pick on tokens, equity, or perks.",
    body: "Past the round itself: airdrops, beta seats, founder dinners, whatever the team distributes to early supporters. Kommits are the ranking.",
  },
];

const TAG_COLORS: Record<RoadmapEntry["when"], string> = {
  Now: "bg-secondary text-black",
  Soon: "bg-white text-black",
  v1: "bg-primary text-white",
};

/**
 * Kommitter-side roadmap. Sets expectation about what backing a project on
 * Kommit unlocks — both shipped (Now) and on the runway (Soon / v1). Lives on
 * the project detail page, beneath `<KommittersList>`.
 */
export function RoadmapCard() {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-6 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <Icon name="workspace_premium" />
        <h3 className="font-epilogue font-black uppercase text-2xl tracking-tight">
          What you unlock
        </h3>
      </div>
      <p className="font-epilogue font-medium text-sm text-gray-600 mb-6">
        What kommitting on this project gets you — now and as Kommit grows.
      </p>
      <ol className="space-y-5">
        {ENTRIES.map((entry, i) => (
          <li
            key={i}
            className="border-l-[4px] border-black pl-5 grid grid-cols-[auto_1fr] gap-4 items-start"
          >
            <span
              className={`inline-block font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm ${TAG_COLORS[entry.when]} mt-0.5`}
            >
              {entry.when}
            </span>
            <div>
              <div className="font-epilogue font-black uppercase text-base tracking-tight">
                {entry.title}
              </div>
              <p className="mt-1 text-sm font-medium text-gray-700 leading-relaxed">
                {entry.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
