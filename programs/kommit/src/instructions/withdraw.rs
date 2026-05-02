use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::KommitError;
use crate::events::Withdrawn;
use crate::state::{Commitment, Project};

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

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Withdrawals are NOT gated by `config.paused` — kill-switch invariant: users can always exit.
    let now = Clock::get()?.unix_timestamp;

    let commitment = &mut ctx.accounts.commitment;
    let old_principal = commitment.principal;

    let amount = if amount == u64::MAX { old_principal } else { amount };
    require!(amount > 0, KommitError::InvalidAmount);
    require!(amount <= old_principal, KommitError::InsufficientPrincipal);

    // Accrue first so lifetime captures everything up to this moment.
    commitment.accrue(now)?;

    // Capture pre-decrement active_score for the partial-withdraw scaling math.
    let old_active = commitment.active_score;

    // Transfer USDC escrow → user, signed by the escrow PDA.
    let project_key = ctx.accounts.project.key();
    let escrow_bump = ctx.bumps.escrow_token_account;
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
        // Full withdrawal: zero active, preserve lifetime.
        commitment.active_score = 0;
    } else {
        // Partial: scale active_score proportionally. u128 multiply-then-divide.
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
