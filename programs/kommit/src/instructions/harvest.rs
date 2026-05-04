use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::adapters::kamino::{redeem_reserve_collateral, RedeemReserveCollateralAccounts};
use crate::errors::KommitError;
use crate::events::YieldHarvested;
use crate::state::{AdapterId, Commitment, LendingPosition, Project};

/// Harvest accrued yield: redeem cTokens for USDC, route to recipient.
/// Permissionless crank.
///
/// **Routing:** klend's `redeem_reserve_collateral` enforces a token-owner
/// constraint that the destination liquidity account's authority equals the
/// redeem signer. Our redeem signer is the collateral PDA (it owns the
/// cTokens being burned). So the redeem destination must also be a token
/// account whose authority is the collateral PDA.
///
/// We use a dedicated landing ATA — `harvest_landing_usdc`, derived as
/// `ATA(collateral_token_account, usdc_mint)` — for that hop. After the
/// klend redeem lands USDC there, we forward the observed delta to the
/// recipient ATA via a second SPL transfer signed by the collateral PDA.
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
    pub project: Box<Account<'info, Project>>,

    #[account(
        mut,
        seeds = [LendingPosition::SEED, project.key().as_ref(), &[AdapterId::Kamino as u8]],
        bump = lending_position.bump,
        constraint = lending_position.project == project.key() @ KommitError::AdapterMismatch,
    )]
    pub lending_position: Box<Account<'info, LendingPosition>>,

    /// Collateral PDA holding cTokens. Signs as klend `owner` for redeem AND
    /// as the authority of `harvest_landing_usdc` (the redeem destination)
    /// AND of the second-hop forward to recipient.
    #[account(
        mut,
        seeds = [Commitment::COLLATERAL_SEED, project.key().as_ref()],
        bump,
        token::mint = reserve_collateral_mint,
        token::authority = collateral_token_account,
    )]
    pub collateral_token_account: Box<Account<'info, TokenAccount>>,

    /// Per-project USDC landing account owned by the collateral PDA. Klend
    /// redeems INTO this; harvest then forwards from here to recipient. ATA
    /// so the address is canonical and idempotent across calls.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = collateral_token_account,
    )]
    pub harvest_landing_usdc: Box<Account<'info, TokenAccount>>,

    /// Recipient's USDC ATA — final destination.
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = project.recipient_wallet,
    )]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

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

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Harvest>, collateral_amount: u64, min_yield: u64) -> Result<()> {
    require!(collateral_amount > 0, KommitError::InvalidAmount);

    let landing_balance_before = ctx.accounts.harvest_landing_usdc.amount;
    let recipient_balance_before = ctx.accounts.recipient_token_account.amount;

    let project_key = ctx.accounts.project.key();
    let collateral_bump = ctx.bumps.collateral_token_account;
    let collateral_seeds: &[&[u8]] = &[
        Commitment::COLLATERAL_SEED,
        project_key.as_ref(),
        &[collateral_bump],
    ];
    let signer_seeds: &[&[&[u8]]] = &[collateral_seeds];

    // 1. Klend redeem — collateral PDA signs, USDC lands in harvest_landing_usdc.
    let cpi_accounts = RedeemReserveCollateralAccounts {
        owner: ctx.accounts.collateral_token_account.to_account_info(),
        lending_market: ctx.accounts.klend_lending_market.to_account_info(),
        reserve: ctx.accounts.klend_reserve.to_account_info(),
        lending_market_authority: ctx.accounts.klend_lending_market_authority.to_account_info(),
        reserve_liquidity_mint: ctx.accounts.klend_reserve_liquidity_mint.to_account_info(),
        reserve_collateral_mint: ctx.accounts.reserve_collateral_mint.to_account_info(),
        reserve_liquidity_supply: ctx.accounts.klend_reserve_liquidity_supply.to_account_info(),
        user_source_collateral: ctx.accounts.collateral_token_account.to_account_info(),
        user_destination_liquidity: ctx.accounts.harvest_landing_usdc.to_account_info(),
        collateral_token_program: ctx.accounts.token_program.to_account_info(),
        liquidity_token_program: ctx.accounts.token_program.to_account_info(),
        instruction_sysvar_account: ctx.accounts.instruction_sysvar_account.to_account_info(),
    };
    redeem_reserve_collateral(cpi_accounts, collateral_amount, signer_seeds)?;

    // Reload to read post-CPI balance — that's the redeemed USDC.
    ctx.accounts.harvest_landing_usdc.reload()?;
    let landing_balance_after = ctx.accounts.harvest_landing_usdc.amount;
    let redeemed = landing_balance_after.saturating_sub(landing_balance_before);

    // 2. Forward redeemed USDC from landing → recipient, signed by collateral PDA.
    let xfer_accounts = Transfer {
        from: ctx.accounts.harvest_landing_usdc.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.collateral_token_account.to_account_info(),
    };
    let xfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        xfer_accounts,
        signer_seeds,
    );
    token::transfer(xfer_ctx, redeemed)?;

    // Reload recipient + check delta against min_yield (dust gate).
    ctx.accounts.recipient_token_account.reload()?;
    let routed = ctx
        .accounts
        .recipient_token_account
        .amount
        .saturating_sub(recipient_balance_before);
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
