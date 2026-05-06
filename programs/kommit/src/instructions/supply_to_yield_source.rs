use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::adapters::kamino::{deposit_reserve_liquidity, DepositReserveLiquidityAccounts};
use crate::errors::KommitError;
use crate::events::SupplyExecuted;
use crate::state::{AdapterId, Commitment, KaminoAdapterConfig, KommitConfig, LendingPosition, Project};

/// Supply USDC from a project's escrow PDA into the klend reserve.
/// Permissionless crank. Escrow PDA signs as klend's `owner` via PDA seeds.
///
/// **C2 fix (QA 2026-05-05):** the klend account graph is now key-equality
/// validated against `KaminoAdapterConfig` BEFORE any CPI. Without this an
/// arbitrary caller could bind project principal to any klend reserve.
#[derive(Accounts)]
pub struct SupplyToYieldSource<'info> {
    pub project: Account<'info, Project>,

    #[account(seeds = [KommitConfig::SEED], bump = config.bump)]
    pub config: Account<'info, KommitConfig>,

    #[account(seeds = [KaminoAdapterConfig::SEED], bump = adapter_config.bump)]
    pub adapter_config: Account<'info, KaminoAdapterConfig>,

    /// Per-project USDC escrow PDA. Holds committed liquidity. Signs as klend `owner`.
    #[account(
        mut,
        seeds = [Commitment::ESCROW_SEED, project.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = escrow_token_account,
    )]
    pub escrow_token_account: Box<Account<'info, TokenAccount>>,

    /// Per-project cToken (klend reserve_collateral) PDA. Receives the cTokens.
    /// Mint is the reserve's collateral mint, determined by which klend reserve.
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [Commitment::COLLATERAL_SEED, project.key().as_ref()],
        bump,
        token::mint = reserve_collateral_mint,
        token::authority = collateral_token_account,
    )]
    pub collateral_token_account: Box<Account<'info, TokenAccount>>,

    /// Per-(project, adapter) lending position. Tracks supplied amount + which reserve.
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + LendingPosition::SIZE,
        seeds = [LendingPosition::SEED, project.key().as_ref(), &[AdapterId::Kamino as u8]],
        bump,
    )]
    pub lending_position: Box<Account<'info, LendingPosition>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    // --- klend account graph (untyped — CPI target). Each is key-equality
    //     validated against `adapter_config` in the handler before CPI.
    /// CHECK: validated against adapter_config.usdc_reserve in handler.
    #[account(mut)]
    pub klend_reserve: AccountInfo<'info>,
    /// CHECK: validated against adapter_config.usdc_lending_market in handler.
    pub klend_lending_market: AccountInfo<'info>,
    /// CHECK: validated against adapter_config.usdc_market_authority in handler.
    pub klend_lending_market_authority: AccountInfo<'info>,
    /// CHECK: validated against adapter_config.usdc_liquidity_mint in handler.
    pub klend_reserve_liquidity_mint: AccountInfo<'info>,
    /// CHECK: validated against adapter_config.usdc_liquidity_supply in handler.
    #[account(mut)]
    pub klend_reserve_liquidity_supply: AccountInfo<'info>,
    /// CHECK: validated against adapter_config.usdc_collateral_mint in handler.
    #[account(mut)]
    pub reserve_collateral_mint: AccountInfo<'info>,
    /// CHECK: validated against adapter_config.klend_program in handler.
    pub klend_program: AccountInfo<'info>,
    /// CHECK: instructions sysvar.
    pub instruction_sysvar_account: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SupplyToYieldSource>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, KommitError::Paused);
    require!(amount > 0, KommitError::InvalidAmount);

    // C2 fix: enforce the approved klend reserve graph BEFORE any CPI. Without
    // these checks a caller could bind project principal to an unapproved
    // reserve (the original `lp.vault_handle == klend_reserve` check only
    // pinned the FIRST caller's choice and accepted any reserve).
    let cfg = &ctx.accounts.adapter_config;
    require_keys_eq!(ctx.accounts.klend_reserve.key(), cfg.usdc_reserve, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_lending_market.key(), cfg.usdc_lending_market, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_lending_market_authority.key(), cfg.usdc_market_authority, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_reserve_liquidity_mint.key(), cfg.usdc_liquidity_mint, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_reserve_liquidity_supply.key(), cfg.usdc_liquidity_supply, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.reserve_collateral_mint.key(), cfg.usdc_collateral_mint, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_program.key(), cfg.klend_program, KommitError::AdapterMismatch);

    // Cap amount at escrow balance — caller can pass u64::MAX for "all available".
    let escrow_balance = ctx.accounts.escrow_token_account.amount;
    let supply_amount = amount.min(escrow_balance);
    require!(supply_amount > 0, KommitError::InvalidAmount);

    // First-time init of LendingPosition? Stamp the metadata.
    let lp = &mut ctx.accounts.lending_position;
    if lp.project == Pubkey::default() {
        lp.project = ctx.accounts.project.key();
        lp.adapter_id = AdapterId::Kamino.as_byte();
        lp.vault_handle = ctx.accounts.klend_reserve.key();
        lp.supplied = 0;
        lp.last_harvest_ts = 0;
        lp.bump = ctx.bumps.lending_position;
    } else {
        // Same lending position — reserve handle must match (defence-in-depth;
        // the adapter_config check above already pins this).
        require_keys_eq!(
            lp.vault_handle,
            ctx.accounts.klend_reserve.key(),
            KommitError::AdapterMismatch
        );
    }

    // CPI to klend. Escrow PDA signs.
    let project_key = ctx.accounts.project.key();
    let escrow_bump = ctx.bumps.escrow_token_account;
    let escrow_seeds: &[&[u8]] = &[Commitment::ESCROW_SEED, project_key.as_ref(), &[escrow_bump]];
    let signer_seeds: &[&[&[u8]]] = &[escrow_seeds];

    let cpi_accounts = DepositReserveLiquidityAccounts {
        owner: ctx.accounts.escrow_token_account.to_account_info(),
        reserve: ctx.accounts.klend_reserve.to_account_info(),
        lending_market: ctx.accounts.klend_lending_market.to_account_info(),
        lending_market_authority: ctx.accounts.klend_lending_market_authority.to_account_info(),
        reserve_liquidity_mint: ctx.accounts.klend_reserve_liquidity_mint.to_account_info(),
        reserve_liquidity_supply: ctx.accounts.klend_reserve_liquidity_supply.to_account_info(),
        reserve_collateral_mint: ctx.accounts.reserve_collateral_mint.to_account_info(),
        user_source_liquidity: ctx.accounts.escrow_token_account.to_account_info(),
        user_destination_collateral: ctx.accounts.collateral_token_account.to_account_info(),
        collateral_token_program: ctx.accounts.token_program.to_account_info(),
        liquidity_token_program: ctx.accounts.token_program.to_account_info(),
        instruction_sysvar_account: ctx.accounts.instruction_sysvar_account.to_account_info(),
    };
    deposit_reserve_liquidity(cpi_accounts, supply_amount, signer_seeds)?;

    // Track principal-supplied. Klend may round; we charge by what we sent in for v1.
    // (A v1.5 refinement is to read post-CPI escrow_balance to get the real delta.)
    lp.supplied = lp
        .supplied
        .checked_add(supply_amount)
        .ok_or(KommitError::MathOverflow)?;

    emit!(SupplyExecuted {
        project: project_key,
        amount: supply_amount,
        ts: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
