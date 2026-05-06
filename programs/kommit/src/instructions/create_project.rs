use anchor_lang::prelude::*;

use crate::errors::KommitError;
use crate::events::ProjectCreated;
use crate::state::{KommitConfig, Project};

#[derive(Accounts)]
#[instruction(recipient_wallet: Pubkey, metadata_uri_hash: [u8; 32])]
pub struct CreateProject<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Project::SIZE,
        seeds = [Project::SEED, recipient_wallet.as_ref()],
        bump,
    )]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [KommitConfig::SEED], bump = config.bump)]
    pub config: Account<'info, KommitConfig>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateProject>,
    recipient_wallet: Pubkey,
    metadata_uri_hash: [u8; 32],
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.config.admin,
        KommitError::Unauthorized
    );

    let project = &mut ctx.accounts.project;
    project.recipient_wallet = recipient_wallet;
    project.metadata_uri_hash = metadata_uri_hash;
    project.cumulative_principal = 0;
    project.cumulative_yield_routed = 0;
    project.created_at = Clock::get()?.unix_timestamp;
    project.bump = ctx.bumps.project;

    emit!(ProjectCreated {
        project: project.key(),
        recipient_wallet,
        metadata_uri_hash,
    });

    Ok(())
}
