// Kommit — Solana yield-routing primitive for early-stage validation
//
// Users park USDC. Principal stays theirs (escrow). Yield streams to a
// curated project's wallet. Soulbound on-chain reputation accrues
// (capital × time, active + lifetime split). No platform token, ever.
//
// This file is the program entrypoint. State accounts and instructions
// are defined in submodules. See ../../../program_spec.md for the full API.

use anchor_lang::prelude::*;

declare_id!("GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3");

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod kommit {
    use super::*;

    /// One-time program initialization. Sets the admin pubkey.
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::initialize_config::handler(ctx)
    }

    /// Admin-only. Curate a new project: yield will flow to `recipient_wallet`.
    pub fn create_project(
        ctx: Context<CreateProject>,
        recipient_wallet: Pubkey,
        metadata_uri_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_project::handler(ctx, recipient_wallet, metadata_uri_hash)
    }

    /// User commits USDC to a project. Principal sits in a per-project escrow PDA.
    pub fn commit(ctx: Context<Commit>, amount: u64) -> Result<()> {
        instructions::commit::handler(ctx, amount)
    }

    /// User withdraws principal. Always allowed (kill-switch invariant: not gated by pause).
    /// `amount == u64::MAX` withdraws the full principal.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    /// Permissionless crank. Brings a commitment's active + lifetime scores up to date.
    pub fn accrue_points(ctx: Context<AccruePoints>) -> Result<()> {
        instructions::accrue_points::handler(ctx)
    }

    /// Admin-only. Halts new commits; withdrawals remain allowed.
    pub fn admin_pause(ctx: Context<AdminPause>) -> Result<()> {
        instructions::admin_pause::pause(ctx)
    }

    /// Admin-only. Resumes commits.
    pub fn admin_unpause(ctx: Context<AdminPause>) -> Result<()> {
        instructions::admin_pause::unpause(ctx)
    }
}
