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
}
