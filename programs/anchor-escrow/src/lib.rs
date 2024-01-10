use anchor_lang::prelude::*;

pub mod state;
pub use state::*;
pub mod contexts;
pub use contexts::*;

declare_id!("3xQs9K4kbhkECPMommzqtrVqRpnG4nuEamnRAzUGB5u5");


#[program]
pub mod anchor_escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
      ctx.accounts.deposit(deposit)?;
      ctx.accounts.save(seed, receive, &ctx.bumps)?;
      Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
      ctx.accounts.refund_and_close_vault()?;
      Ok(())
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
      ctx.accounts.deposit()?;
      ctx.accounts.withdraw_and_close_vault()?;
      Ok(())
    }
}