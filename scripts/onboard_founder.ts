/**
 * Admin onboarding — promote a founder application into a listed project.
 *
 * The first cold-inbound founder is what handoff 73 is wired around: Lukas
 * runs this script (locally or in CI), it writes a `founders` row in
 * Supabase + a project entry in `web/src/lib/data/dynamic-projects.json`,
 * and prints the next commands Lukas needs to run (commit + push).
 *
 * Two modes:
 *   Mode A — from an approved application
 *     npm run onboard-founder -- \
 *       --application 42 \
 *       --wallet <SOLANA_ADDRESS> \
 *       --user-id alice \
 *       --slug bright-labs \
 *       --country DE \
 *       --bio "Three-sentence bio." \
 *       --interests fintech,solana,b2b \
 *       --twitter https://twitter.com/alice \
 *       --linkedin https://linkedin.com/in/alice
 *
 *   Mode B — direct (skip the queue, for founders DM'd directly)
 *     npm run onboard-founder -- \
 *       --email founder@example.com \
 *       --wallet <SOLANA_ADDRESS> \
 *       --user-id alice \
 *       --display-name "Alice Founder" \
 *       --slug bright-labs \
 *       --project-name "Bright Labs" \
 *       --pitch "One-line pitch." \
 *       --longer "Longer pitch …" \
 *       --sector Fintech \
 *       --stage Building \
 *       --country DE \
 *       --bio "Three-sentence bio." \
 *       --interests fintech,solana,b2b \
 *       --twitter https://twitter.com/alice
 *
 * On-chain create_project:
 *   This script does NOT mint a Project PDA by default. Pass `--onchain` to
 *   shell out to `scripts/create_project.ts` (requires ANCHOR_WALLET +
 *   ANCHOR_PROVIDER_URL configured locally; ADMIN keypair must match
 *   config.admin). For submission day we leave on-chain off — listing the
 *   project off-chain is enough for `/projects/<slug>` to render; Lukas
 *   runs the on-chain mint separately when ready.
 *
 * Idempotent: re-running for the same wallet refreshes the founders row;
 * re-running for the same slug updates the dynamic-projects.json entry
 * in place rather than duplicating.
 *
 * Required env (loaded the same way the web app does — readSecret + trim):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npm run onboard-founder -- [flags above]
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Argv parsing — tiny because we don't want a dep.
// ---------------------------------------------------------------------------

type Args = {
  application?: number;
  email?: string;
  wallet?: string;
  userId?: string;
  displayName?: string;
  slug?: string;
  projectName?: string;
  pitch?: string;
  longer?: string;
  sector?: string;
  stage?: string;
  country?: string;
  bio?: string;
  interests?: string[];
  twitter?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  avatarSeed?: number;
  onchain?: boolean;
  help?: boolean;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = argv[i + 1];
    const eat = () => {
      if (!next || next.startsWith("--")) {
        throw new Error(`flag ${k} needs a value`);
      }
      i++;
      return next;
    };
    switch (k) {
      case "--help":
      case "-h":
        a.help = true;
        break;
      case "--application":
        a.application = parseInt(eat(), 10);
        break;
      case "--email":
        a.email = eat();
        break;
      case "--wallet":
        a.wallet = eat();
        break;
      case "--user-id":
        a.userId = eat();
        break;
      case "--display-name":
        a.displayName = eat();
        break;
      case "--slug":
        a.slug = eat();
        break;
      case "--project-name":
        a.projectName = eat();
        break;
      case "--pitch":
        a.pitch = eat();
        break;
      case "--longer":
        a.longer = eat();
        break;
      case "--sector":
        a.sector = eat();
        break;
      case "--stage":
        a.stage = eat();
        break;
      case "--country":
        a.country = eat().toUpperCase();
        break;
      case "--bio":
        a.bio = eat();
        break;
      case "--interests":
        a.interests = eat()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--twitter":
        a.twitter = eat();
        break;
      case "--linkedin":
        a.linkedin = eat();
        break;
      case "--github":
        a.github = eat();
        break;
      case "--website":
        a.website = eat();
        break;
      case "--avatar-seed":
        a.avatarSeed = parseInt(eat(), 10);
        break;
      case "--onchain":
        a.onchain = true;
        break;
      default:
        if (k.startsWith("--")) throw new Error(`unknown flag: ${k}`);
    }
  }
  return a;
}

function printHelp(): void {
  console.log(`
onboard_founder — promote a founder application into a listed project.

USAGE
  Mode A (from an application id):
    npm run onboard-founder -- --application <id> --wallet <addr> [...]

  Mode B (direct, skip the queue):
    npm run onboard-founder -- --email <addr> --wallet <addr> \\
      --display-name "Alice" --slug bright-labs --project-name "Bright" \\
      --pitch "One-liner" --longer "..." --sector Fintech --stage Building

REQUIRED FLAGS (always)
  --wallet <SOLANA_ADDRESS>   Privy wallet of the founder
  --slug <slug>               URL slug (e.g. bright-labs)

REQUIRED FLAGS (Mode B only — Mode A pulls these from the application)
  --email --display-name --project-name --pitch --longer --sector --stage

PROFILE FLAGS (optional, both modes)
  --user-id <slug>            persona-style id; matches /profile/<id>
  --country <ISO>             two-letter ISO code, e.g. DE
  --bio "…"                   public bio paragraph
  --interests a,b,c           comma-separated tags
  --twitter / --linkedin / --github / --website   socials
  --avatar-seed <1..70>       pravatar pick; default derived from wallet

ON-CHAIN
  --onchain                   ALSO mint the Project PDA via create_project.ts
                              (requires ANCHOR_WALLET + ANCHOR_PROVIDER_URL;
                              default OFF — run create_project.ts separately).

ENV
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  required
`);
}

// ---------------------------------------------------------------------------
// Supabase client — same pattern as web/src/lib/supabase-admin.ts but
// shaped for a CLI (no `import "server-only"` machinery).
// ---------------------------------------------------------------------------

function readSecret(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getSupabase(): SupabaseClient {
  const url = readSecret("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = readSecret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Avatar seed derivation — same algorithm as
// web/src/components/auth/AuthProvider.tsx#avatarSeedFromAddress so the
// pravatar drawn by the FE matches what the script seeds.
// ---------------------------------------------------------------------------
function avatarSeedFromWallet(wallet: string): number {
  let acc = 0;
  for (let i = 0; i < wallet.length; i++) {
    acc = (acc * 31 + wallet.charCodeAt(i)) >>> 0;
  }
  return (acc % 70) + 1;
}

// ---------------------------------------------------------------------------
// founders + dynamic-projects.json writers.
// ---------------------------------------------------------------------------

type FounderApplicationRow = {
  id: number;
  project_name: string;
  project_pitch: string;
  sector: string;
  longer_pitch: string;
  founders_blurb: string;
  stage: string;
  extra_notes: string | null;
  email: string;
  status: string;
};

async function fetchApplication(
  supabase: SupabaseClient,
  id: number,
): Promise<FounderApplicationRow> {
  const { data, error } = await supabase
    .from("founder_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`fetch application ${id}: ${error.message}`);
  if (!data) throw new Error(`application ${id} not found`);
  return data as FounderApplicationRow;
}

type FounderLink = { label: string; url: string };

function buildLinks(args: Args): FounderLink[] {
  const links: FounderLink[] = [];
  if (args.twitter) links.push({ label: "Twitter", url: args.twitter });
  if (args.linkedin) links.push({ label: "LinkedIn", url: args.linkedin });
  if (args.github) links.push({ label: "GitHub", url: args.github });
  if (args.website) links.push({ label: "Website", url: args.website });
  return links;
}

async function upsertFounder(
  supabase: SupabaseClient,
  row: {
    wallet: string;
    userId: string | null;
    email: string | null;
    displayName: string;
    projectSlug: string;
    country: string | null;
    interests: string[];
    bio: string | null;
    links: FounderLink[];
    avatarSeed: number;
  },
): Promise<void> {
  const payload = {
    wallet: row.wallet,
    user_id: row.userId,
    email: row.email,
    display_name: row.displayName,
    role: "founder",
    project_slug: row.projectSlug,
    country: row.country,
    interests: row.interests,
    bio: row.bio,
    links: row.links,
    avatar_seed: row.avatarSeed,
  };
  const { error } = await supabase
    .from("founders")
    .upsert(payload, { onConflict: "wallet" });
  if (error) throw new Error(`founders upsert failed: ${error.message}`);
}

async function markApplicationApproved(
  supabase: SupabaseClient,
  id: number,
  adminWallet: string,
): Promise<void> {
  const { error } = await supabase
    .from("founder_applications")
    .update({
      status: "approved",
      reviewed_by: adminWallet,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error)
    throw new Error(`application ${id} approve failed: ${error.message}`);
}

type DynamicProject = {
  slug: string;
  name: string;
  pitch: string;
  longerPitch: string[];
  sector: string;
  state: "just-listed";
  founders: Array<{
    name: string;
    role: string;
    bio: string;
    avatarSeed: number;
    userId?: string;
    socials?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
      website?: string;
    };
  }>;
  kommittersCount: number;
  totalKommittedUSD: number;
  totalKommitsGenerated: number;
  activeSinceISO: string;
  imageSeed: string;
  recipientWallet: string;
  updates: never[];
  kommitters: never[];
};

const DYNAMIC_JSON_PATH = path.resolve(
  __dirname,
  "..",
  "web",
  "src",
  "lib",
  "data",
  "dynamic-projects.json",
);

function readDynamicProjects(): DynamicProject[] {
  if (!fs.existsSync(DYNAMIC_JSON_PATH)) return [];
  const raw = fs.readFileSync(DYNAMIC_JSON_PATH, "utf8");
  const parsed = JSON.parse(raw) as { projects?: DynamicProject[] };
  return Array.isArray(parsed.projects) ? parsed.projects : [];
}

function writeDynamicProjects(projects: DynamicProject[]): void {
  fs.mkdirSync(path.dirname(DYNAMIC_JSON_PATH), { recursive: true });
  fs.writeFileSync(
    DYNAMIC_JSON_PATH,
    JSON.stringify({ projects }, null, 2) + "\n",
  );
}

function upsertDynamicProject(entry: DynamicProject): void {
  const all = readDynamicProjects();
  const idx = all.findIndex((p) => p.slug === entry.slug);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  writeDynamicProjects(all);
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  // Wallet + slug required in both modes.
  if (!args.wallet) {
    console.error("ERROR: --wallet is required.");
    printHelp();
    process.exit(1);
  }
  if (!args.slug) {
    console.error("ERROR: --slug is required.");
    printHelp();
    process.exit(1);
  }

  const supabase = getSupabase();

  // ---- Resolve application-derived fields if Mode A ----
  let application: FounderApplicationRow | null = null;
  if (args.application !== undefined) {
    application = await fetchApplication(supabase, args.application);
    console.log(`[onboard] Mode A: loaded application #${application.id} (${application.email})`);
  } else {
    console.log("[onboard] Mode B: direct (no application id provided)");
  }

  // Fill in defaults from the application where Mode A is in play; flags
  // override (so an admin can edit the application copy at onboard time).
  const projectName = args.projectName ?? application?.project_name;
  const pitch = args.pitch ?? application?.project_pitch;
  const longer = args.longer ?? application?.longer_pitch;
  const sector = args.sector ?? application?.sector;
  const stage = args.stage ?? application?.stage;
  const email = args.email ?? application?.email ?? null;
  const displayName =
    args.displayName ?? (email ? email.split("@")[0] : application?.project_name);

  const missing: string[] = [];
  if (!projectName) missing.push("--project-name");
  if (!pitch) missing.push("--pitch");
  if (!longer) missing.push("--longer");
  if (!sector) missing.push("--sector");
  if (!stage) missing.push("--stage");
  if (!displayName) missing.push("--display-name");
  if (missing.length > 0) {
    console.error(
      `ERROR: missing required project fields: ${missing.join(", ")}.\n` +
        `Either pass them as flags, or pass --application <id> to inherit from the application row.`,
    );
    process.exit(1);
  }

  const avatarSeed =
    args.avatarSeed ?? avatarSeedFromWallet(args.wallet);
  const interests = args.interests ?? [];
  const links = buildLinks(args);

  // ---- Write founders row ----
  await upsertFounder(supabase, {
    wallet: args.wallet,
    userId: args.userId ?? null,
    email,
    displayName: displayName!,
    projectSlug: args.slug,
    country: args.country ?? null,
    interests,
    bio: args.bio ?? null,
    links,
    avatarSeed,
  });
  console.log(`[onboard] founders row upserted for wallet ${args.wallet}`);

  // ---- Append / update dynamic-projects.json ----
  const dynamicEntry: DynamicProject = {
    slug: args.slug,
    name: projectName!,
    pitch: pitch!,
    longerPitch: longer!.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
    sector: sector!,
    state: "just-listed",
    founders: [
      {
        name: displayName!,
        role: `Founder${stage ? ` · ${stage}` : ""}`,
        bio: args.bio ?? "",
        avatarSeed,
        userId: args.userId,
        socials: {
          twitter: args.twitter,
          linkedin: args.linkedin,
          github: args.github,
          website: args.website,
        },
      },
    ],
    kommittersCount: 0,
    totalKommittedUSD: 0,
    totalKommitsGenerated: 0,
    activeSinceISO: new Date().toISOString().slice(0, 10),
    imageSeed: args.slug,
    recipientWallet: args.wallet,
    updates: [],
    kommitters: [],
  };
  upsertDynamicProject(dynamicEntry);
  console.log(
    `[onboard] dynamic-projects.json updated (${args.slug} → ${args.wallet})`,
  );

  // ---- Mark application approved (Mode A only) ----
  if (application) {
    await markApplicationApproved(supabase, application.id, args.wallet);
    console.log(
      `[onboard] application #${application.id} marked approved by ${args.wallet}`,
    );
  }

  // ---- On-chain create_project (opt-in) ----
  if (args.onchain) {
    console.log("\n[onboard] --onchain set; running scripts/create_project.ts");
    console.log(
      "  Requires ANCHOR_WALLET + ANCHOR_PROVIDER_URL to be configured locally.",
    );
    console.log(
      "  This script does NOT auto-pin metadata — run scripts/pin_project_metadata.ts first",
    );
    console.log(
      "  to get the metadata-uri-hash, then run create_project.ts directly with --recipient",
    );
    console.log(`    ${args.wallet} --metadata-uri-hash <hash>.`);
    console.log(
      "  Not wiring this from inside onboard_founder.ts to keep keypair handling isolated.",
    );
  } else {
    console.log("\n[onboard] on-chain mint SKIPPED (no --onchain flag).");
    console.log(
      "  /projects/<slug> + /founder/<slug> render off-chain via dynamic-projects.json.",
    );
    console.log(
      "  When ready to mint, run scripts/pin_project_metadata.ts + scripts/create_project.ts manually.",
    );
  }

  // ---- Confirm ----
  console.log("\n[onboard] done. URLs to verify:");
  console.log(`  Founder dashboard: /founder/${args.slug}`);
  if (args.userId) {
    console.log(`  Founder profile : /profile/${args.userId}`);
  }
  console.log(`  Founder profile : /profile/${args.wallet}`);
  console.log(`  Public project  : /projects/${args.slug}`);
  console.log("\n[onboard] commit + push the dynamic-projects.json change:");
  console.log(
    "  git add web/src/lib/data/dynamic-projects.json && \\",
  );
  console.log(
    `  git commit -m "feat: onboard ${args.slug}" && git push`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
