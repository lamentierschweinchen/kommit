use anchor_lang::prelude::*;

use crate::errors::KommitError;
use crate::events::ProjectMetadataUpdated;
use crate::state::{KommitConfig, Project};

#[derive(Accounts)]
pub struct AdminUpdateProjectMetadata<'info> {
    #[account(mut)]
    pub project: Account<'info, Project>,
    pub admin: Signer<'info>,
    #[account(seeds = [KommitConfig::SEED], bump = config.bump)]
    pub config: Account<'info, KommitConfig>,
}

pub fn handler(
    ctx: Context<AdminUpdateProjectMetadata>,
    metadata_uri_hash: [u8; 32],
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.config.admin,
        KommitError::Unauthorized
    );
    let project = &mut ctx.accounts.project;
    project.metadata_uri_hash = metadata_uri_hash;

    emit!(ProjectMetadataUpdated {
        project: project.key(),
        new_hash: metadata_uri_hash,
    });
    Ok(())
}
