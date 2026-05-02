use anchor_lang::prelude::*;

use crate::errors::KommitError;
use crate::state::KommitConfig;

#[derive(Accounts)]
pub struct AdminPause<'info> {
    #[account(mut, seeds = [KommitConfig::SEED], bump = config.bump)]
    pub config: Account<'info, KommitConfig>,
    pub admin: Signer<'info>,
}

pub fn pause(ctx: Context<AdminPause>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.config.admin,
        KommitError::Unauthorized
    );
    ctx.accounts.config.paused = true;
    Ok(())
}

pub fn unpause(ctx: Context<AdminPause>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.config.admin,
        KommitError::Unauthorized
    );
    ctx.accounts.config.paused = false;
    Ok(())
}
