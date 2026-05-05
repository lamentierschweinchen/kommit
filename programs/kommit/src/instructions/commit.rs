use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::KommitError;
use crate::events::Committed;
use crate::state::{Commitment, KommitConfig, Project};

#[derive(Accounts)]
pub struct Commit<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Commitment::SIZE,
        seeds = [Commitment::SEED, user.key().as_ref(), project.key().as_ref()],
        bump,
    )]
    pub commitment: Account<'info, Commitment>,

    #[account(mut)]
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
        init_if_needed,
        payer = user,
        seeds = [Commitment::ESCROW_SEED, project.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = escrow_token_account,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(seeds = [KommitConfig::SEED], bump = config.bump)]
    pub config: Account<'info, KommitConfig>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Commit>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, KommitError::Paused);
    require!(amount > 0, KommitError::InvalidAmount);

    let now = Clock::get()?.unix_timestamp;

    // SPL transfer: user_usdc → escrow.
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_usdc_token_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    let commitment = &mut ctx.accounts.commitment;
    let user_key = ctx.accounts.user.key();
    let project_key = ctx.accounts.project.key();

    if commitment.principal == 0 && commitment.user == Pubkey::default() {
        // Fresh commitment — just initialized.
        commitment.user = user_key;
        commitment.project = project_key;
        commitment.principal = amount;
        commitment.deposit_ts = now;
        commitment.active_score = 0;
        commitment.lifetime_score = 0;
        commitment.last_accrual_ts = now;
        commitment.bump = ctx.bumps.commitment;
    } else {
        // Top-up. Accrue first so scores reflect the period before the new deposit,
        // then recompute weighted-average deposit_ts and increment principal.
        let delta = commitment.accrue(now)?;
        // QA M1: emit PointsAccrued so the indexer materializes lifetime_score
        // exactly (instead of approximating between explicit accrue calls).
        if delta > 0 {
            emit!(crate::events::PointsAccrued {
                user: commitment.user,
                project: commitment.project,
                active_delta: delta,
                lifetime_total: commitment.lifetime_score,
            });
        }

        let old_principal = commitment.principal as u128;
        let new_amount = amount as u128;
        let old_ts = commitment.deposit_ts as u128;
        let now_u = now as u128;

        let weighted = old_principal
            .checked_mul(old_ts)
            .ok_or(KommitError::MathOverflow)?
            .checked_add(new_amount.checked_mul(now_u).ok_or(KommitError::MathOverflow)?)
            .ok_or(KommitError::MathOverflow)?;
        let total = old_principal
            .checked_add(new_amount)
            .ok_or(KommitError::MathOverflow)?;
        commitment.deposit_ts = (weighted / total) as i64;

        commitment.principal = commitment
            .principal
            .checked_add(amount)
            .ok_or(KommitError::MathOverflow)?;
    }

    let project = &mut ctx.accounts.project;
    project.cumulative_principal = project
        .cumulative_principal
        .checked_add(amount)
        .ok_or(KommitError::MathOverflow)?;

    emit!(Committed {
        user: user_key,
        project: project_key,
        amount,
        ts: now,
    });

    Ok(())
}
