use anchor_lang::prelude::*;

#[event]
pub struct ProjectCreated {
    pub project: Pubkey,
    pub recipient_wallet: Pubkey,
}

#[event]
pub struct Committed {
    pub user: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
    pub ts: i64,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PointsAccrued {
    pub user: Pubkey,
    pub project: Pubkey,
    pub active_delta: u128,
    pub lifetime_total: u128,
}
