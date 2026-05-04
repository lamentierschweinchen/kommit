// Pin a project metadata JSON to Pinata IPFS, return both the IPFS hash
// (CIDv0 / "Qm..." form) and the bytes32 hash that the on-chain Project
// account stores.
//
// USAGE:
//   PINATA_JWT=eyJh... npx ts-node scripts/pin_project_metadata.ts ./project.json
//
// Output (printed JSON):
//   {
//     "ipfs_hash"        : "QmAbc...",
//     "ipfs_uri"         : "ipfs://QmAbc...",
//     "metadata_uri_hash": "0x1234...",   // bytes32 hex; sha256 of "ipfs://Qm..."
//     "recipient_wallet" : "5x9..."
//   }
//
// The on-chain Project struct stores `metadata_uri_hash: [u8; 32]`. Pass
// metadata_uri_hash to scripts/create_project.ts (or admin_update_project_metadata)
// and the indexer reverses the lookup via Pinata gateway when it sees the
// ProjectCreated / ProjectMetadataUpdated event.
//
// Schema for ./project.json (see kommit.ts ProjectMetadata type):
//   {
//     "name": "Caldera",
//     "pitch": "Modular rollups for institutional capital",
//     "founders": [
//       { "name": "Alice", "role": "CEO", "bio": "Ex-Stripe...", "photo_url": "https://..." }
//     ],
//     "long_description": "Markdown-formatted long pitch...",
//     "links": { "website": "https://caldera.xyz", "twitter": "@caldera", "github": "..." },
//     "recipient_wallet": "5x9..."
//   }

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const PINATA_API = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

type Founder = {
  name: string;
  role: string;
  bio: string;
  photo_url?: string;
};

type ProjectMetadata = {
  name: string;
  pitch: string;
  founders: Founder[];
  long_description?: string;
  links?: {
    website?: string;
    twitter?: string;
    github?: string;
  };
  recipient_wallet: string;
};

function validate(meta: unknown): asserts meta is ProjectMetadata {
  const m = meta as ProjectMetadata;
  if (!m.name) throw new Error("project.json: missing 'name'");
  if (!m.pitch) throw new Error("project.json: missing 'pitch'");
  if (!Array.isArray(m.founders) || m.founders.length === 0)
    throw new Error("project.json: 'founders' must be a non-empty array");
  if (!m.recipient_wallet) throw new Error("project.json: missing 'recipient_wallet'");
  // Try to parse the recipient_wallet as a valid base58 address (32 bytes).
  // Don't pull in @solana/web3.js here — keep deps small for a one-off script.
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m.recipient_wallet))
    throw new Error(`project.json: 'recipient_wallet' isn't a base58 Solana address`);
}

async function pinToIPFS(meta: ProjectMetadata): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT env var unset");
  const res = await fetch(PINATA_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: meta,
      pinataMetadata: {
        name: `kommit-project-${meta.recipient_wallet.slice(0, 8)}`,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Pinata error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { IpfsHash: string };
  return json.IpfsHash;
}

function metadataUriHash(ipfsUri: string): string {
  // The on-chain Project struct stores `metadata_uri_hash: [u8; 32]` —
  // sha256 of the canonical IPFS URI string. The indexer reverses by reading
  // the URI from a Pinata pin-list lookup keyed on the hash.
  const h = createHash("sha256").update(ipfsUri).digest();
  return "0x" + h.toString("hex");
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("USAGE: ts-node scripts/pin_project_metadata.ts <project.json>");
    process.exit(1);
  }
  const meta = JSON.parse(readFileSync(resolve(path), "utf8"));
  validate(meta);

  const ipfsHash = await pinToIPFS(meta);
  const ipfsUri = `ipfs://${ipfsHash}`;
  const hash = metadataUriHash(ipfsUri);

  console.log(
    JSON.stringify(
      {
        ipfs_hash: ipfsHash,
        ipfs_uri: ipfsUri,
        metadata_uri_hash: hash,
        recipient_wallet: meta.recipient_wallet,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
