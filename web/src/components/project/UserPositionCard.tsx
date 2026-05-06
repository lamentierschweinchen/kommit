"use client";

import { useCallback, useEffect, useState } from "react";
import { PositionCard } from "@/components/project/PositionCard";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCommitmentForUserAndProject } from "@/lib/queries";
import type { Project } from "@/lib/data/projects";

/**
 * Client island for the project-detail right rail. Wraps the presentational
 * `<PositionCard>` and handles the per-user commitment fetch + refresh-after-tx
 * lifecycle. The parent server component just renders this with a slug.
 *
 * Wallet-null guard (handoff 32 § 6): the read fires only after Privy resolves
 * the embedded wallet (`isSignedIn && user.wallet`). Until then, the card
 * renders the no-position variant with the project's headline numbers.
 */
export function UserPositionCard({ project }: { project: Project }) {
  const { user, isSignedIn } = useAuth();
  const [committedUSD, setCommittedUSD] = useState<number | undefined>(undefined);
  const [sinceISO, setSinceISO] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!isSignedIn || !user?.wallet || !project.recipientWallet) {
      setCommittedUSD(undefined);
      setSinceISO(undefined);
      return;
    }
    let cancelled = false;
    getCommitmentForUserAndProject(user.wallet, project.slug)
      .then((c) => {
        if (cancelled) return;
        if (c) {
          setCommittedUSD(c.kommittedUSD);
          setSinceISO(c.sinceISO);
        } else {
          setCommittedUSD(undefined);
          setSinceISO(undefined);
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("position read failed:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user?.wallet, project.recipientWallet, project.slug, refreshKey]);

  const variant = committedUSD !== undefined && sinceISO ? "active" : "no-position";

  return (
    <PositionCard
      project={project}
      variant={variant}
      committedUSD={committedUSD}
      sinceISO={sinceISO}
      onTxSuccess={refresh}
    />
  );
}
