use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::adapters::kamino::{
    redeem_reserve_collateral, RedeemReserveCollateralAccounts, ReserveSnapshot,
};
use crate::errors::KommitError;
use crate::events::YieldHarvested;
use crate::state::{AdapterId, Commitment, KaminoAdapterConfig, LendingPosition, Project};

/// Harvest accrued yield: redeem cTokens for USDC, route to recipient.
/// Permissionless crank.
///
/// **C1 redesign (QA 2026-05-05):** the program now computes the yield
/// amount on-chain instead of trusting a caller-supplied `collateral_amount`.
/// Steps:
/// 1. Read the klend reserve snapshot (total_liquidity, mint_total_supply).
/// 2. Compute the redeemable USDC value of the project's cToken holdings.
/// 3. yield_amount = redeemable_value − lending_position.supplied (saturating).
/// 4. If yield_amount < min_yield → DustHarvest. (No CPI fired.)
/// 5. Compute cTokens to redeem for *yield_amount only* (rounding down).
/// 6. CPI klend redeem; collateral PDA signs; lands in harvest_landing_usdc.
/// 7. Forward observed delta to recipient via signed SPL transfer.
/// 8. Re-validate: routed must still satisfy ≥ min_yield (defence-in-depth
///    against klend exchange-rate changes between snapshot and CPI).
/// 9. **Do NOT decrement lending_position.supplied.** Principal stays
///    continuously supplied; only the yield delta moves.
///
/// **C2 enforcement:** the klend account graph is key-equality validated
/// against `KaminoAdapterConfig` BEFORE any read or CPI.
///
/// **Routing detail:** klend's `redeem_reserve_collateral` requires
/// `user_destination_liquidity.authority == owner` (the redeem signer). We
/// redeem into a dedicated landing ATA owned by the collateral PDA, then
/// forward to the recipient ATA.
#[derive(Accounts)]
pub struct Harvest<'info> {
    #[account(mut)]
    pub project: Box<Account<'info, Project>>,

    #[account(seeds = [KaminoAdapterConfig::SEED], bump = adapter_config.bump)]
    pub adapter_config: Box<Account<'info, KaminoAdapterConfig>>,

    #[account(
        mut,
        seeds = [LendingPosition::SEED, project.key().as_ref(), &[AdapterId::Kamino as u8]],
        bump = lending_position.bump,
        constraint = lending_position.project == project.key() @ KommitError::AdapterMismatch,
    )]
    pub lending_position: Box<Account<'info, LendingPosition>>,

    /// Collateral PDA holding cTokens. Signs as klend `owner` for redeem AND
    /// as the authority of `harvest_landing_usdc` AND of the second-hop
    /// forward to recipient.
    #[account(
        mut,
        seeds = [Commitment::COLLATERAL_SEED, project.key().as_ref()],
        bump,
        token::mint = reserve_collateral_mint,
        token::authority = collateral_token_account,
    )]
    pub collateral_token_account: Box<Account<'info, TokenAccount>>,

    /// Per-project USDC landing account owned by the collateral PDA. Klend
    /// redeems INTO this; harvest then forwards from here to recipient.
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

    // --- klend account graph; each is key-equality validated against
    //     adapter_config in the handler before CPI. ---
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

pub fn handler(ctx: Context<Harvest>, min_yield: u64) -> Result<()> {
    // C2: enforce the approved klend reserve graph BEFORE any read or CPI.
    let cfg = &ctx.accounts.adapter_config;
    require_keys_eq!(ctx.accounts.klend_reserve.key(), cfg.usdc_reserve, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_lending_market.key(), cfg.usdc_lending_market, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_lending_market_authority.key(), cfg.usdc_market_authority, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_reserve_liquidity_mint.key(), cfg.usdc_liquidity_mint, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_reserve_liquidity_supply.key(), cfg.usdc_liquidity_supply, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.reserve_collateral_mint.key(), cfg.usdc_collateral_mint, KommitError::AdapterMismatch);
    require_keys_eq!(ctx.accounts.klend_program.key(), cfg.klend_program, KommitError::AdapterMismatch);

    // C1: compute the yield amount on-chain.
    let reserve_data = ctx.accounts.klend_reserve.try_borrow_data()?;
    let snapshot = ReserveSnapshot::read(&reserve_data).ok_or(KommitError::AdapterMismatch)?;
    drop(reserve_data);

    let ctoken_balance = ctx.accounts.collateral_token_account.amount;
    let redeemable_value = snapshot.redeemable_value(ctoken_balance);
    let supplied = ctx.accounts.lending_position.supplied;
    let yield_amount = redeemable_value.saturating_sub(supplied);

    require!(yield_amount >= min_yield, KommitError::DustHarvest);

    // Conservative cTokens-to-redeem: rounds down so klend's actual redeem
    // produces ≤ yield_amount in USDC. Final routing amount is observed
    // from balance deltas after the CPI.
    let ctokens_to_redeem = snapshot.ctokens_for_usdc(yield_amount);
    require!(ctokens_to_redeem > 0, KommitError::DustHarvest);

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
    redeem_reserve_collateral(cpi_accounts, ctokens_to_redeem, signer_seeds)?;

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

    // Re-validate the dust gate against the actual routed amount
    // (defence-in-depth: klend's exchange rate could shift between our
    // snapshot read and the redeem CPI; klend rounding is also possible).
    ctx.accounts.recipient_token_account.reload()?;
    let routed = ctx
        .accounts
        .recipient_token_account
        .amount
        .saturating_sub(recipient_balance_before);
    require!(routed >= min_yield, KommitError::DustHarvest);

    // QA C1: do NOT decrement lending_position.supplied. Principal stays
    // continuously supplied; we only routed the yield delta. Off-chain
    // accounting for cumulative yield + last harvest ts is what we track.
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
