// Kamino klend adapter — hand-rolled CPI helpers for the two instructions
// we need from klend (`deposit_reserve_liquidity` + `redeem_reserve_collateral`).
//
// Why hand-rolled instead of `declare_program!`: klend's IDL has multiple
// instructions whose anchor `Accounts` struct names collide when `declare_program!`
// expands them into the same module (e.g. `__cpi_client_accounts_farms_accounts`
// is generated multiple times). Pruning the IDL would work but adds maintenance
// surface. We only need 2 of klend's 62 instructions, so direct CPI is cheaper.
//
// Discriminators were extracted from the converted klend IDL on 2026-05-03:
//   deposit_reserve_liquidity:  [169, 201, 30, 126, 6, 205, 102, 68]
//   redeem_reserve_collateral:  [234, 117, 181, 125, 185, 142, 220, 29]
// IDL provenance: `anchor idl fetch --provider.cluster mainnet
//   KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` then `anchor idl convert`.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::pubkey::Pubkey;

/// Klend program ID. Same on mainnet and devnet.
pub const KLEND_PROGRAM_ID: Pubkey =
    anchor_lang::solana_program::pubkey!("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");

const DEPOSIT_RESERVE_LIQUIDITY_DISCRIMINATOR: [u8; 8] = [169, 201, 30, 126, 6, 205, 102, 68];
const REDEEM_RESERVE_COLLATERAL_DISCRIMINATOR: [u8; 8] = [234, 117, 181, 125, 185, 142, 220, 29];

/// Account context for `deposit_reserve_liquidity`. Order matches klend's IDL exactly.
/// `owner` (the escrow PDA) signs via `invoke_signed` with the escrow seeds.
pub struct DepositReserveLiquidityAccounts<'info> {
    pub owner: AccountInfo<'info>,
    pub reserve: AccountInfo<'info>,
    pub lending_market: AccountInfo<'info>,
    pub lending_market_authority: AccountInfo<'info>,
    pub reserve_liquidity_mint: AccountInfo<'info>,
    pub reserve_liquidity_supply: AccountInfo<'info>,
    pub reserve_collateral_mint: AccountInfo<'info>,
    pub user_source_liquidity: AccountInfo<'info>,
    pub user_destination_collateral: AccountInfo<'info>,
    pub collateral_token_program: AccountInfo<'info>,
    pub liquidity_token_program: AccountInfo<'info>,
    pub instruction_sysvar_account: AccountInfo<'info>,
}

/// Account context for `redeem_reserve_collateral`. Order matches klend's IDL exactly.
pub struct RedeemReserveCollateralAccounts<'info> {
    pub owner: AccountInfo<'info>,
    pub lending_market: AccountInfo<'info>,
    pub reserve: AccountInfo<'info>,
    pub lending_market_authority: AccountInfo<'info>,
    pub reserve_liquidity_mint: AccountInfo<'info>,
    pub reserve_collateral_mint: AccountInfo<'info>,
    pub reserve_liquidity_supply: AccountInfo<'info>,
    pub user_source_collateral: AccountInfo<'info>,
    pub user_destination_liquidity: AccountInfo<'info>,
    pub collateral_token_program: AccountInfo<'info>,
    pub liquidity_token_program: AccountInfo<'info>,
    pub instruction_sysvar_account: AccountInfo<'info>,
}

/// CPI: deposit `liquidity_amount` USDC into the klend reserve and receive cTokens.
/// `signer_seeds` are the escrow PDA seeds since `owner` is the escrow.
pub fn deposit_reserve_liquidity<'info>(
    accounts: DepositReserveLiquidityAccounts<'info>,
    liquidity_amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(8 + 8);
    data.extend_from_slice(&DEPOSIT_RESERVE_LIQUIDITY_DISCRIMINATOR);
    data.extend_from_slice(&liquidity_amount.to_le_bytes());

    let ix = Instruction {
        program_id: KLEND_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*accounts.owner.key, true),
            AccountMeta::new(*accounts.reserve.key, false),
            AccountMeta::new_readonly(*accounts.lending_market.key, false),
            AccountMeta::new_readonly(*accounts.lending_market_authority.key, false),
            AccountMeta::new_readonly(*accounts.reserve_liquidity_mint.key, false),
            AccountMeta::new(*accounts.reserve_liquidity_supply.key, false),
            AccountMeta::new(*accounts.reserve_collateral_mint.key, false),
            AccountMeta::new(*accounts.user_source_liquidity.key, false),
            AccountMeta::new(*accounts.user_destination_collateral.key, false),
            AccountMeta::new_readonly(*accounts.collateral_token_program.key, false),
            AccountMeta::new_readonly(*accounts.liquidity_token_program.key, false),
            AccountMeta::new_readonly(*accounts.instruction_sysvar_account.key, false),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            accounts.owner.clone(),
            accounts.reserve.clone(),
            accounts.lending_market.clone(),
            accounts.lending_market_authority.clone(),
            accounts.reserve_liquidity_mint.clone(),
            accounts.reserve_liquidity_supply.clone(),
            accounts.reserve_collateral_mint.clone(),
            accounts.user_source_liquidity.clone(),
            accounts.user_destination_collateral.clone(),
            accounts.collateral_token_program.clone(),
            accounts.liquidity_token_program.clone(),
            accounts.instruction_sysvar_account.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}

/// CPI: redeem `collateral_amount` cTokens for the underlying USDC.
pub fn redeem_reserve_collateral<'info>(
    accounts: RedeemReserveCollateralAccounts<'info>,
    collateral_amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(8 + 8);
    data.extend_from_slice(&REDEEM_RESERVE_COLLATERAL_DISCRIMINATOR);
    data.extend_from_slice(&collateral_amount.to_le_bytes());

    let ix = Instruction {
        program_id: KLEND_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*accounts.owner.key, true),
            AccountMeta::new_readonly(*accounts.lending_market.key, false),
            AccountMeta::new(*accounts.reserve.key, false),
            AccountMeta::new_readonly(*accounts.lending_market_authority.key, false),
            AccountMeta::new_readonly(*accounts.reserve_liquidity_mint.key, false),
            AccountMeta::new(*accounts.reserve_collateral_mint.key, false),
            AccountMeta::new(*accounts.reserve_liquidity_supply.key, false),
            AccountMeta::new(*accounts.user_source_collateral.key, false),
            AccountMeta::new(*accounts.user_destination_liquidity.key, false),
            AccountMeta::new_readonly(*accounts.collateral_token_program.key, false),
            AccountMeta::new_readonly(*accounts.liquidity_token_program.key, false),
            AccountMeta::new_readonly(*accounts.instruction_sysvar_account.key, false),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            accounts.owner.clone(),
            accounts.lending_market.clone(),
            accounts.reserve.clone(),
            accounts.lending_market_authority.clone(),
            accounts.reserve_liquidity_mint.clone(),
            accounts.reserve_collateral_mint.clone(),
            accounts.reserve_liquidity_supply.clone(),
            accounts.user_source_collateral.clone(),
            accounts.user_destination_liquidity.clone(),
            accounts.collateral_token_program.clone(),
            accounts.liquidity_token_program.clone(),
            accounts.instruction_sysvar_account.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}
