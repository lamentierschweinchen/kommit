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

pub mod adapters;
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
    /// `redeem_collateral_amount` may be 0; if escrow has < amount, caller must
    /// also pass the klend account graph via `remaining_accounts` (see
    /// `Withdraw` doc-comment).
    pub fn withdraw<'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        amount: u64,
        redeem_collateral_amount: u64,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, amount, redeem_collateral_amount)
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

    /// Permissionless. Supply USDC from the project escrow into the klend reserve.
    /// Caller can pass `u64::MAX` to supply all available escrow.
    pub fn supply_to_yield_source(ctx: Context<SupplyToYieldSource>, amount: u64) -> Result<()> {
        instructions::supply_to_yield_source::handler(ctx, amount)
    }

    /// Permissionless. Redeem `collateral_amount` cTokens for USDC, route to recipient.
    /// `min_yield` enforces a dust threshold — actual USDC routed must be ≥ min_yield.
    pub fn harvest(
        ctx: Context<Harvest>,
        collateral_amount: u64,
        min_yield: u64,
    ) -> Result<()> {
        instructions::harvest::handler(ctx, collateral_amount, min_yield)
    }

    /// Admin-only. Rotate the off-chain metadata pointer for a project.
    /// Founders update pitch / image off-chain, admin commits the new IPFS hash on-chain.
    pub fn admin_update_project_metadata(
        ctx: Context<AdminUpdateProjectMetadata>,
        metadata_uri_hash: [u8; 32],
    ) -> Result<()> {
        instructions::admin_update_project_metadata::handler(ctx, metadata_uri_hash)
    }
}
