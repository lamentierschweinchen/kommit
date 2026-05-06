// Admin-only. One-time init of the Kamino klend adapter allowlist (QA C2).
// Populates the singleton with the approved klend reserve graph; subsequent
// supply / harvest CPIs require key-equality against these stored addresses.

use anchor_lang::prelude::*;

use crate::errors::KommitError;
use crate::state::{KaminoAdapterConfig, KommitConfig};

#[derive(Accounts)]
pub struct InitializeKaminoAdapterConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + KaminoAdapterConfig::SIZE,
        seeds = [KaminoAdapterConfig::SEED],
        bump,
    )]
    pub adapter_config: Account<'info, KaminoAdapterConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [KommitConfig::SEED], bump = config.bump)]
    pub config: Account<'info, KommitConfig>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeKaminoAdapterConfig>,
    klend_program: Pubkey,
    usdc_reserve: Pubkey,
    usdc_lending_market: Pubkey,
    usdc_market_authority: Pubkey,
    usdc_liquidity_supply: Pubkey,
    usdc_collateral_mint: Pubkey,
    usdc_liquidity_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.config.admin,
        KommitError::Unauthorized
    );
    let cfg = &mut ctx.accounts.adapter_config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.klend_program = klend_program;
    cfg.usdc_reserve = usdc_reserve;
    cfg.usdc_lending_market = usdc_lending_market;
    cfg.usdc_market_authority = usdc_market_authority;
    cfg.usdc_liquidity_supply = usdc_liquidity_supply;
    cfg.usdc_collateral_mint = usdc_collateral_mint;
    cfg.usdc_liquidity_mint = usdc_liquidity_mint;
    cfg.bump = ctx.bumps.adapter_config;
    Ok(())
}
