"use client";

import { Modal } from "@/components/common/Modal";
import { ActivityHistory } from "@/components/dashboard/ActivityHistory";

/**
 * Full kommit + withdraw log surfaced from the kommitter sidebar. The sidebar
 * used to inline this feed; handoff 60 moved it behind a button so the rail
 * stays a navigation surface, not a content surface.
 *
 * `kinds` is locked to the value-moving entries — reactions and comments
 * belong in the broader account activity feed, not this "money in / money
 * out" record. defaultLimit of 25 paginates with the existing PaginatedList
 * once the user has more than ~3 weeks of activity.
 */
export function MyHistoryModal({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="My history"
      description="Every kommit and withdrawal you've made on this wallet."
      maxWidth="max-w-2xl"
      shadow="purple"
    >
      <p className="mt-3 text-sm font-medium text-gray-700 leading-relaxed border-l-[4px] border-primary pl-4">
        Anything that moved value — kommits, withdrawals — newest first.
      </p>
      <div className="mt-7">
        <ActivityHistory
          wallet={wallet}
          kinds={["commit", "withdraw"]}
          defaultLimit={25}
          emptyHeadline="No history yet."
          emptyBody="Once you kommit or withdraw, the trail lands here."
        />
      </div>
    </Modal>
  );
}
