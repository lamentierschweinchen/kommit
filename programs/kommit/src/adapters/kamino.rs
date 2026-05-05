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

// --- Reserve account read for harvest yield computation (QA C1) -----------
//
// Layout traced against klend's deployed devnet binary 2026-05-03 (program
// `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`). Field offsets within
// `Reserve`:
//   8  discriminator
//   8  version (u64)
//   16 LastUpdate { slot u64, stale u8, price_status u8, padding [u8; 6] }
//   32 lending_market
//   32 farm_collateral
//   32 farm_debt
//   ── 128 — start of `liquidity: ReserveLiquidity` ──
//   32 mint_pubkey
//   32 supply_vault
//   32 fee_vault
//   8  total_available_amount   (offset 224)
//   16 borrowed_amount_sf       (offset 232; klend's "scaled fraction": value × 2^60)
//   ...
//   ── 1360 = 128 + 1232 (ReserveLiquidity) — start of 1200-byte padding ──
//   ── 2560 = 1360 + 1200 — start of `collateral: ReserveCollateral` ──
//   32 mint_pubkey               (offset 2560)
//   8  mint_total_supply         (offset 2592 — cToken total supply)
//
// If klend ships a layout change the harvest computation breaks safely:
// either the reads return stale values (yield computed off old totals →
// either DustHarvest or a tiny mistransfer that the routed >= min_yield
// gate catches in our handler) OR an out-of-bounds read panics.

const RESERVE_TOTAL_AVAILABLE_OFFSET: usize = 224;
const RESERVE_BORROWED_SF_OFFSET: usize = 232;
const RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET: usize = 2592;
const RESERVE_MIN_LEN: usize = RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET + 8;

/// Snapshot of the fields we read from a klend Reserve account.
#[derive(Copy, Clone, Debug)]
pub struct ReserveSnapshot {
    pub total_available_amount: u64,
    pub borrowed_amount_sf: u128,
    pub mint_total_supply: u64,
}

impl ReserveSnapshot {
    /// Read the snapshot from a klend Reserve account's raw data.
    /// Returns None if the account data is too short (defensive).
    pub fn read(data: &[u8]) -> Option<Self> {
        if data.len() < RESERVE_MIN_LEN {
            return None;
        }
        let total_available_amount = u64::from_le_bytes(
            data[RESERVE_TOTAL_AVAILABLE_OFFSET..RESERVE_TOTAL_AVAILABLE_OFFSET + 8]
                .try_into()
                .ok()?,
        );
        let borrowed_amount_sf = u128::from_le_bytes(
            data[RESERVE_BORROWED_SF_OFFSET..RESERVE_BORROWED_SF_OFFSET + 16]
                .try_into()
                .ok()?,
        );
        let mint_total_supply = u64::from_le_bytes(
            data[RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET
                ..RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET + 8]
                .try_into()
                .ok()?,
        );
        Some(Self {
            total_available_amount,
            borrowed_amount_sf,
            mint_total_supply,
        })
    }

    /// Total liquidity (USDC base units) currently in the reserve.
    /// Equals `total_available + (borrowed_amount_sf >> 60)`.
    /// Loses the sub-base-unit precision of borrowed_amount_sf — fine for our
    /// scope since we round redemptions down anyway.
    pub fn total_liquidity(&self) -> u128 {
        (self.total_available_amount as u128)
            .saturating_add(self.borrowed_amount_sf >> 60)
    }

    /// USDC value (base units) of `ctoken_amount` cTokens at this reserve's
    /// current exchange rate. Returns 0 if the cToken supply is empty (avoids
    /// div-by-zero — newly-initialized reserves report mint_total_supply = 0).
    pub fn redeemable_value(&self, ctoken_amount: u64) -> u64 {
        if self.mint_total_supply == 0 {
            return 0;
        }
        let total_liq = self.total_liquidity();
        let value = (ctoken_amount as u128)
            .saturating_mul(total_liq)
            .checked_div(self.mint_total_supply as u128)
            .unwrap_or(0);
        u64::try_from(value).unwrap_or(u64::MAX)
    }

    /// Inverse of `redeemable_value`: how many cTokens correspond to a target
    /// USDC amount. Conservative — rounds DOWN so the actual klend redeem
    /// produces ≤ `target_usdc`. The harvest handler observes the real delta
    /// after the CPI and re-validates against `min_yield`.
    pub fn ctokens_for_usdc(&self, target_usdc: u64) -> u64 {
        let total_liq = self.total_liquidity();
        if total_liq == 0 {
            return 0;
        }
        let ctokens = (target_usdc as u128)
            .saturating_mul(self.mint_total_supply as u128)
            .checked_div(total_liq)
            .unwrap_or(0);
        u64::try_from(ctokens).unwrap_or(u64::MAX)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a synthetic reserve buffer with the three fields we read.
    fn fake_reserve(total_avail: u64, borrowed_sf: u128, mint_total_supply: u64) -> Vec<u8> {
        let mut v = vec![0u8; RESERVE_MIN_LEN];
        v[RESERVE_TOTAL_AVAILABLE_OFFSET..RESERVE_TOTAL_AVAILABLE_OFFSET + 8]
            .copy_from_slice(&total_avail.to_le_bytes());
        v[RESERVE_BORROWED_SF_OFFSET..RESERVE_BORROWED_SF_OFFSET + 16]
            .copy_from_slice(&borrowed_sf.to_le_bytes());
        v[RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET
            ..RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET + 8]
            .copy_from_slice(&mint_total_supply.to_le_bytes());
        v
    }

    #[test]
    fn reserve_snapshot_reads_fields() {
        let data = fake_reserve(1_000_000, (500_000u128) << 60, 1_500_000);
        let s = ReserveSnapshot::read(&data).unwrap();
        assert_eq!(s.total_available_amount, 1_000_000);
        assert_eq!(s.borrowed_amount_sf, 500_000u128 << 60);
        assert_eq!(s.mint_total_supply, 1_500_000);
        assert_eq!(s.total_liquidity(), 1_500_000);
    }

    #[test]
    fn redeemable_value_one_to_one_at_init() {
        // 1:1 exchange rate (no borrows, total_liq == mint_total_supply).
        let data = fake_reserve(1_000_000, 0, 1_000_000);
        let s = ReserveSnapshot::read(&data).unwrap();
        assert_eq!(s.redeemable_value(100), 100);
        assert_eq!(s.ctokens_for_usdc(100), 100);
    }

    #[test]
    fn redeemable_value_with_yield_accrued() {
        // After borrows accrue interest: total_liq > mint_total_supply.
        // mint=1_000_000, total_liq=1_100_000 → 1 cToken = 1.1 USDC.
        let data = fake_reserve(1_100_000, 0, 1_000_000);
        let s = ReserveSnapshot::read(&data).unwrap();
        // 100 cTokens → 110 USDC.
        assert_eq!(s.redeemable_value(100), 110);
        // 110 USDC → 100 cTokens.
        assert_eq!(s.ctokens_for_usdc(110), 100);
    }

    #[test]
    fn empty_reserve_returns_zero_safely() {
        let data = fake_reserve(0, 0, 0);
        let s = ReserveSnapshot::read(&data).unwrap();
        assert_eq!(s.redeemable_value(100), 0);
        assert_eq!(s.ctokens_for_usdc(100), 0);
    }

    #[test]
    fn short_data_returns_none() {
        let data = vec![0u8; 100];
        assert!(ReserveSnapshot::read(&data).is_none());
    }
}

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
