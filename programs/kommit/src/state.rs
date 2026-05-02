// State accounts for the Kommit program.
//
// See program_spec.md for the full API. This module is the canonical
// source for PDA layouts, seeds, and size constants.

use anchor_lang::prelude::*;

/// Singleton program config. PDA seeds: [b"config"].
#[account]
pub struct KommitConfig {
    pub admin: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

impl KommitConfig {
    pub const SIZE: usize = 32 + 1 + 1;
    pub const SEED: &'static [u8] = b"config";
}

/// One per founder/team. PDA seeds: [b"project", recipient_wallet.as_ref()].
#[account]
pub struct Project {
    pub recipient_wallet: Pubkey,
    pub metadata_uri_hash: [u8; 32],
    pub cumulative_principal: u64,
    pub cumulative_yield_routed: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl Project {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 1;
    pub const SEED: &'static [u8] = b"project";
}

/// One per (user, project) pair. PDA seeds: [b"commitment", user.as_ref(), project.as_ref()].
#[account]
pub struct Commitment {
    pub user: Pubkey,
    pub project: Pubkey,
    pub principal: u64,
    pub deposit_ts: i64,
    pub active_score: u128,
    pub lifetime_score: u128,
    pub last_accrual_ts: i64,
    pub bump: u8,
}

impl Commitment {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 16 + 16 + 8 + 1;
    pub const SEED: &'static [u8] = b"commitment";
}
