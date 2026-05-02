use anchor_lang::prelude::*;

use crate::events::PointsAccrued;
use crate::state::{Commitment, Project};

#[derive(Accounts)]
pub struct AccruePoints<'info> {
    #[account(
        mut,
        seeds = [Commitment::SEED, commitment.user.as_ref(), project.key().as_ref()],
        bump = commitment.bump,
        has_one = project,
    )]
    pub commitment: Account<'info, Commitment>,
    pub project: Account<'info, Project>,
}

pub fn handler(ctx: Context<AccruePoints>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let commitment = &mut ctx.accounts.commitment;
    let delta = commitment.accrue(now)?;
    emit!(PointsAccrued {
        user: commitment.user,
        project: commitment.project,
        active_delta: delta,
        lifetime_total: commitment.lifetime_score,
    });
    Ok(())
}
