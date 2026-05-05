// Admin helper: call the program's `create_project` instruction.
//
// USAGE:
//   ANCHOR_WALLET=~/.config/solana/admin.json \
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   npx ts-node scripts/create_project.ts \
//     --recipient 5x9... \
//     --metadata-uri-hash 0x1234...
//
// Workflow:
//   1. Run scripts/pin_project_metadata.ts <project.json> → grab the
//      `metadata_uri_hash` from its output.
//   2. Run this script with that hash. Wallet must equal config.admin.
//   3. The indexer (app/web/src/app/api/webhook/helius/route.ts) catches
//      the ProjectCreated event, lazily fetches the IPFS content via
//      Pinata gateway, populates projects.metadata.

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated from `anchor build`.
import idl from "../target/idl/kommit.json";

function arg(flag: string): string {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i === process.argv.length - 1) {
    throw new Error(`required arg missing: ${flag}`);
  }
  return process.argv[i + 1];
}

function hexToBytes32(hex: string): number[] {
  const clean = hex.replace(/^0x/, "");
  if (clean.length !== 64) throw new Error(`metadata-uri-hash must be 32 bytes (64 hex chars), got ${clean.length}`);
  const bytes = new Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function main() {
  const recipientStr = arg("--recipient");
  const hashHex = arg("--metadata-uri-hash");

  const recipient = new PublicKey(recipientStr);
  const metadataUriHash = hexToBytes32(hashHex);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new anchor.Program(idl as anchor.Idl, provider) as anchor.Program;
  const wallet = provider.wallet as anchor.Wallet;

  const programId = program.programId;
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("project"), recipient.toBuffer()],
    programId
  );

  console.log("Program  :", programId.toBase58());
  console.log("Wallet   :", wallet.publicKey.toBase58());
  console.log("Recipient:", recipient.toBase58());
  console.log("Project  :", projectPda.toBase58());

  // Sanity: confirm wallet == config.admin before submitting.
  // (We use `as any` rather than the typed Program<Kommit> to keep this script
  // independent of `target/types/kommit` — the IDL JSON bundled at the top is
  // sufficient at runtime. tsc-clean and runtime-correct.)
  const cfg = await (program.account as any)["kommitConfig"].fetch(configPda);
  if (cfg.admin.toBase58() !== wallet.publicKey.toBase58()) {
    console.error(
      `ERROR: wallet ${wallet.publicKey.toBase58()} is not config.admin (${cfg.admin.toBase58()})`
    );
    process.exit(1);
  }

  const sig = await (program.methods as any)
    .createProject(recipient, metadataUriHash)
    .accountsPartial({
      project: projectPda,
      admin: wallet.publicKey,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`\ncreate_project tx: ${sig}`);
  console.log(`View: https://solscan.io/tx/${sig}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
