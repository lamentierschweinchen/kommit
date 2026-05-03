use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::adapters::kamino::{redeem_reserve_collateral, RedeemReserveCollateralAccounts};
use crate::errors::KommitError;
use crate::events::Withdrawn;
use crate::state::{AdapterId, Commitment, LendingPosition, Project};

/// Withdraw principal back to the user.
///
/// Two paths, picked transparently by the handler based on escrow balance:
///
/// **Escrow-only (layer-1 path):** if the escrow PDA holds `>= amount` USDC,
/// transfer escrow → user directly. `redeem_collateral_amount` is ignored,
/// `remaining_accounts` is ignored.
///
/// **Klend-redeem path (layer-2):** if escrow holds `< amount`, the caller
/// must (a) pass `redeem_collateral_amount > 0` (off-chain crank computes
/// the right cToken count from klend's exchange rate so that the redeemed
/// USDC covers the gap), and (b) supply 14 `remaining_accounts` in this exact
/// order:
///
/// ```text
/// 0  collateral_token_account (PDA, seeds [b"collateral", project])
/// 1  lending_position         (PDA, seeds [b"lending", project, &[adapter_id]])
/// 2  klend_reserve            (mut)
/// 3  klend_lending_market
/// 4  klend_lending_market_authority
/// 5  klend_reserve_liquidity_mint     (must equal usdc_mint)
/// 6  klend_reserve_collateral_mint    (mut)
/// 7  klend_reserve_liquidity_supply   (mut)
/// 8  klend_collateral_token_program   (typically Token Program)
/// 9  klend_liquidity_token_program    (typically Token Program)
/// 10 klend_instruction_sysvar_account
/// 11 klend_program
/// 12 (reserved for future klend extension)
/// 13 (reserved for future klend extension)
/// ```
///
/// Withdrawals are NEVER gated by `config.paused` — kill-switch invariant.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [Commitment::SEED, user.key().as_ref(), project.key().as_ref()],
        bump = commitment.bump,
        has_one = user,
        has_one = project,
    )]
    pub commitment: Account<'info, Commitment>,

    pub project: Account<'info, Project>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = user,
    )]
    pub user_usdc_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [Commitment::ESCROW_SEED, project.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = escrow_token_account,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    amount: u64,
    redeem_collateral_amount: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let project_key = ctx.accounts.project.key();
    let escrow_bump = ctx.bumps.escrow_token_account;

    let commitment = &mut ctx.accounts.commitment;
    let old_principal = commitment.principal;
    let amount = if amount == u64::MAX { old_principal } else { amount };
    require!(amount > 0, KommitError::InvalidAmount);
    require!(amount <= old_principal, KommitError::InsufficientPrincipal);

    commitment.accrue(now)?;
    let old_active = commitment.active_score;

    // If escrow doesn't have enough USDC, redeem from klend first.
    let escrow_balance = ctx.accounts.escrow_token_account.amount;
    if escrow_balance < amount {
        require!(
            redeem_collateral_amount > 0,
            KommitError::InvalidAmount
        );

        // remaining_accounts layout per doc-comment above.
        let ra = ctx.remaining_accounts;
        require!(ra.len() >= 12, KommitError::InvalidAmount);

        let collateral_token_account = &ra[0];
        let lending_position_ai = &ra[1];
        let klend_reserve = &ra[2];
        let klend_lending_market = &ra[3];
        let klend_lending_market_authority = &ra[4];
        let klend_reserve_liquidity_mint = &ra[5];
        let klend_reserve_collateral_mint = &ra[6];
        let klend_reserve_liquidity_supply = &ra[7];
        let klend_collateral_token_program = &ra[8];
        let klend_liquidity_token_program = &ra[9];
        let klend_instruction_sysvar_account = &ra[10];
        // ra[11] reserved (klend_program access via the adapter constant);
        // included in layout for future-proofing.

        // Validate the collateral PDA seeds + bump (Anchor doesn't auto-validate
        // accounts in remaining_accounts).
        let (expected_collateral, collateral_bump) = Pubkey::find_program_address(
            &[Commitment::COLLATERAL_SEED, project_key.as_ref()],
            ctx.program_id,
        );
        require_keys_eq!(
            *collateral_token_account.key,
            expected_collateral,
            KommitError::Unauthorized
        );

        // Validate the lending_position PDA + adapter_id continuity.
        let (expected_lp, _lp_bump) = Pubkey::find_program_address(
            &[
                LendingPosition::SEED,
                project_key.as_ref(),
                &[AdapterId::Kamino as u8],
            ],
            ctx.program_id,
        );
        require_keys_eq!(
            *lending_position_ai.key,
            expected_lp,
            KommitError::Unauthorized
        );

        // CPI redeem, signed by the collateral PDA.
        let collateral_seeds: &[&[u8]] = &[
            Commitment::COLLATERAL_SEED,
            project_key.as_ref(),
            &[collateral_bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[collateral_seeds];

        let cpi_accounts = RedeemReserveCollateralAccounts {
            owner: collateral_token_account.clone(),
            lending_market: klend_lending_market.clone(),
            reserve: klend_reserve.clone(),
            lending_market_authority: klend_lending_market_authority.clone(),
            reserve_liquidity_mint: klend_reserve_liquidity_mint.clone(),
            reserve_collateral_mint: klend_reserve_collateral_mint.clone(),
            reserve_liquidity_supply: klend_reserve_liquidity_supply.clone(),
            user_source_collateral: collateral_token_account.clone(),
            user_destination_liquidity: ctx.accounts.escrow_token_account.to_account_info(),
            collateral_token_program: klend_collateral_token_program.clone(),
            liquidity_token_program: klend_liquidity_token_program.clone(),
            instruction_sysvar_account: klend_instruction_sysvar_account.clone(),
        };
        redeem_reserve_collateral(cpi_accounts, redeem_collateral_amount, signer_seeds)?;

        // Reload escrow + decrement supplied. Klend's redeem returns the actual
        // USDC delta; we observe via the escrow balance change.
        ctx.accounts.escrow_token_account.reload()?;
        let new_escrow_balance = ctx.accounts.escrow_token_account.amount;
        let redeemed_usdc = new_escrow_balance.saturating_sub(escrow_balance);

        // Decrement principal-supplied on the LendingPosition. We deserialize/
        // serialize manually since LendingPosition is in remaining_accounts.
        let mut lp_data = lending_position_ai.try_borrow_mut_data()?;
        let mut lp = LendingPosition::try_deserialize(&mut &lp_data[..])?;
        lp.supplied = lp.supplied.saturating_sub(redeemed_usdc);
        let mut writer: &mut [u8] = &mut lp_data;
        LendingPosition::try_serialize(&lp, &mut writer)?;

        // After redeem, escrow MUST have enough to satisfy the withdraw.
        require!(
            new_escrow_balance >= amount,
            KommitError::InsufficientPrincipal
        );
    }

    // Transfer USDC escrow → user, signed by the escrow PDA.
    let escrow_seeds: &[&[u8]] = &[Commitment::ESCROW_SEED, project_key.as_ref(), &[escrow_bump]];
    let signer_seeds: &[&[&[u8]]] = &[escrow_seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        to: ctx.accounts.user_usdc_token_account.to_account_info(),
        authority: ctx.accounts.escrow_token_account.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    let remaining = old_principal - amount;
    commitment.principal = remaining;

    if remaining == 0 {
        commitment.active_score = 0;
    } else {
        let scaled = old_active
            .checked_mul(remaining as u128)
            .ok_or(KommitError::MathOverflow)?
            / (old_principal as u128);
        commitment.active_score = scaled;
    }

    emit!(Withdrawn {
        user: ctx.accounts.user.key(),
        project: project_key,
        amount,
    });

    Ok(())
}
