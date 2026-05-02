use anchor_lang::prelude::*;
use crate::state::KommitConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + KommitConfig::SIZE,
        seeds = [KommitConfig::SEED],
        bump
    )]
    pub config: Account<'info, KommitConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.paused = false;
    config.bump = ctx.bumps.config;
    Ok(())
}
