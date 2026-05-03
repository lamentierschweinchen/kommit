use anchor_lang::prelude::*;

#[error_code]
pub enum KommitError {
    #[msg("Program is paused")]
    Paused,
    #[msg("Insufficient principal to withdraw")]
    InsufficientPrincipal,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Project not found")]
    ProjectNotFound,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Unknown adapter id")]
    UnknownAdapter,
    #[msg("Adapter mismatch — lending_position adapter_id != requested")]
    AdapterMismatch,
    #[msg("Yield below dust threshold; harvest skipped")]
    DustHarvest,
}
