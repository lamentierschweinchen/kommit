use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::adapters::kamino::{redeem_reserve_collateral, RedeemReserveCollateralAccounts};
use crate::errors::KommitError;
use crate::events::YieldHarvested;
use crate::state::{AdapterId, Commitment, LendingPosition, Project};

/// Harvest accrued yield: redeem cTokens for USDC straight into the project's
/// recipient ATA. Permissionless crank.
///
/// v1 takes `collateral_amount` and `min_yield` from the caller; the off-chain
/// crank decides how much cToken to redeem based on klend's current exchange
/// rate. On-chain we enforce: actual USDC routed to recipient ≥ min_yield, else
/// revert (covers slippage + dust).
///
/// `min_yield` doubles as the dust-threshold gate: pass e.g. 10_000 (= 0.01 USDC)
/// to guard against burning compute on micro-harvests.
#[derive(Accounts)]
pub struct Harvest<'info> {
    #[account(mut)]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [LendingPosition::SEED, project.key().as_ref(), &[AdapterId::Kamino as u8]],
        bump = lending_position.bump,
        constraint = lending_position.project == project.key() @ KommitError::AdapterMismatch,
    )]
    pub lending_position: Account<'info, LendingPosition>,

    /// Collateral PDA holding cTokens. Signs as klend `owner` for redeem.
    #[account(
        mut,
        seeds = [Commitment::COLLATERAL_SEED, project.key().as_ref()],
        bump,
        token::mint = reserve_collateral_mint,
        token::authority = collateral_token_account,
    )]
    pub collateral_token_account: Account<'info, TokenAccount>,

    /// Recipient's USDC ATA — where harvested USDC lands.
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = project.recipient_wallet,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    // --- klend account graph (same as supply, for redeem). ---
    /// CHECK: klend reserve.
    #[account(mut)]
    pub klend_reserve: AccountInfo<'info>,
    /// CHECK: klend lending market.
    pub klend_lending_market: AccountInfo<'info>,
    /// CHECK: klend lending market authority.
    pub klend_lending_market_authority: AccountInfo<'info>,
    /// CHECK: klend reserve liquidity mint — must equal usdc_mint at runtime.
    pub klend_reserve_liquidity_mint: AccountInfo<'info>,
    /// CHECK: klend reserve liquidity supply.
    #[account(mut)]
    pub klend_reserve_liquidity_supply: AccountInfo<'info>,
    /// CHECK: klend reserve collateral mint (cToken mint).
    #[account(mut)]
    pub reserve_collateral_mint: AccountInfo<'info>,
    /// CHECK: klend program.
    pub klend_program: AccountInfo<'info>,
    /// CHECK: instructions sysvar.
    pub instruction_sysvar_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Harvest>, collateral_amount: u64, min_yield: u64) -> Result<()> {
    require!(collateral_amount > 0, KommitError::InvalidAmount);

    let recipient_balance_before = ctx.accounts.recipient_token_account.amount;

    let project_key = ctx.accounts.project.key();
    let collateral_bump = ctx.bumps.collateral_token_account;
    let collateral_seeds: &[&[u8]] = &[
        Commitment::COLLATERAL_SEED,
        project_key.as_ref(),
        &[collateral_bump],
    ];
    let signer_seeds: &[&[&[u8]]] = &[collateral_seeds];

    let cpi_accounts = RedeemReserveCollateralAccounts {
        owner: ctx.accounts.collateral_token_account.to_account_info(),
        lending_market: ctx.accounts.klend_lending_market.to_account_info(),
        reserve: ctx.accounts.klend_reserve.to_account_info(),
        lending_market_authority: ctx.accounts.klend_lending_market_authority.to_account_info(),
        reserve_liquidity_mint: ctx.accounts.klend_reserve_liquidity_mint.to_account_info(),
        reserve_collateral_mint: ctx.accounts.reserve_collateral_mint.to_account_info(),
        reserve_liquidity_supply: ctx.accounts.klend_reserve_liquidity_supply.to_account_info(),
        user_source_collateral: ctx.accounts.collateral_token_account.to_account_info(),
        user_destination_liquidity: ctx.accounts.recipient_token_account.to_account_info(),
        collateral_token_program: ctx.accounts.token_program.to_account_info(),
        liquidity_token_program: ctx.accounts.token_program.to_account_info(),
        instruction_sysvar_account: ctx.accounts.instruction_sysvar_account.to_account_info(),
    };
    redeem_reserve_collateral(cpi_accounts, collateral_amount, signer_seeds)?;

    // Reload to read post-CPI balance.
    ctx.accounts.recipient_token_account.reload()?;
    let recipient_balance_after = ctx.accounts.recipient_token_account.amount;
    let routed = recipient_balance_after.saturating_sub(recipient_balance_before);

    require!(routed >= min_yield, KommitError::DustHarvest);

    let project = &mut ctx.accounts.project;
    project.cumulative_yield_routed = project
        .cumulative_yield_routed
        .checked_add(routed)
        .ok_or(KommitError::MathOverflow)?;

    let now = Clock::get()?.unix_timestamp;
    let lp = &mut ctx.accounts.lending_position;
    lp.last_harvest_ts = now;

    emit!(YieldHarvested {
        project: project_key,
        amount: routed,
        ts: now,
    });
    Ok(())
}
