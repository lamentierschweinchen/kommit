// State accounts for the Kommit program.
//
// See program_spec.md for the full API. This module is the canonical
// source for PDA layouts, seeds, and size constants.

use anchor_lang::prelude::*;

use crate::errors::KommitError;

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
    pub const ESCROW_SEED: &'static [u8] = b"escrow";
    pub const COLLATERAL_SEED: &'static [u8] = b"collateral";

    /// Accrue active + lifetime score from `last_accrual_ts` up to `now`.
    /// Returns the delta added (callers may use it for event emission).
    /// Idempotent: if `now <= last_accrual_ts`, delta is 0 and state is untouched.
    pub fn accrue(&mut self, now: i64) -> Result<u128> {
        let elapsed = now.saturating_sub(self.last_accrual_ts);
        if elapsed <= 0 {
            return Ok(0);
        }
        let delta = (self.principal as u128)
            .checked_mul(elapsed as u128)
            .ok_or(KommitError::MathOverflow)?;
        self.active_score = self
            .active_score
            .checked_add(delta)
            .ok_or(KommitError::MathOverflow)?;
        self.lifetime_score = self
            .lifetime_score
            .checked_add(delta)
            .ok_or(KommitError::MathOverflow)?;
        self.last_accrual_ts = now;
        Ok(delta)
    }
}

/// Yield-source adapter identifier. Used as the trailing byte in `LendingPosition`
/// PDA seeds and as a discriminant for adapter dispatch.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum AdapterId {
    Kamino = 0,
    // Future: Marginfi = 1, JupiterLend = 2 (NOT planned for v1 — flagged Dec 2025).
}

impl AdapterId {
    pub fn from_u8(v: u8) -> Result<Self> {
        match v {
            0 => Ok(AdapterId::Kamino),
            _ => Err(error!(KommitError::UnknownAdapter)),
        }
    }
    pub fn as_byte(&self) -> u8 {
        *self as u8
    }
}

/// One per (project, adapter). Tracks the funds we've routed into a yield source
/// and the cumulative `vault_handle` (the underlying reserve / market account).
/// PDA seeds: [b"lending", project.as_ref(), &[adapter_id]].
#[account]
pub struct LendingPosition {
    pub project: Pubkey,
    pub adapter_id: u8,
    pub vault_handle: Pubkey,
    pub supplied: u64,
    pub last_harvest_ts: i64,
    pub bump: u8,
}

impl LendingPosition {
    pub const SIZE: usize = 32 + 1 + 32 + 8 + 8 + 1;
    pub const SEED: &'static [u8] = b"lending";
}
