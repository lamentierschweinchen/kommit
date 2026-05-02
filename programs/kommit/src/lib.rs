// Kommit — Solana yield-routing primitive for early-stage validation
//
// Users park USDC. Principal stays theirs (escrow). Yield streams to a
// curated project's wallet. Soulbound on-chain reputation accrues
// (capital × time, active + lifetime split). No platform token, ever.
//
// This file is the program entrypoint. State accounts and instructions
// will be expanded out of this stub. See ../../../program_spec.md for
// the full API design.

use anchor_lang::prelude::*;

// Placeholder program ID. Replace with the keypair-derived ID after first
// `anchor build` + `anchor keys list`. Update this `declare_id!` AND both
// `[programs.*]` entries in `Anchor.toml` to keep them in sync.
declare_id!("GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3");

pub mod state;
pub mod errors;
pub mod instructions;

use instructions::*;

#[program]
pub mod kommit {
    use super::*;

    /// One-time program initialization. Sets the admin pubkey.
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::initialize_config::handler(ctx)
    }
}
