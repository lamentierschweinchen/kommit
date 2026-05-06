# Program upgrade authority — recovery procedure

> **What this document is.** A persistent, never-deleted record of how to recover the Solana program upgrade authority keypair for Kommit. It contains no secrets — just the procedure. The encrypted backup file and the decryption passphrase are held privately. This document allows future-you (or a successor) to use them.

---

## What's at stake

The keypair `target/deploy/kommit-keypair.json` is the **program upgrade authority** for Kommit's on-chain program. It derives the program ID:

```
GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3
```

Same ID is used on devnet, testnet, and mainnet. The keypair signs `bpf_loader_upgradeable::upgrade()` — anyone holding it can replace the program's bytecode. Anyone without it cannot.

**Loss:** the program at `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3` becomes permanently frozen on its current bytecode. No fixes, no features, no migrations. The program account itself stays usable; only upgrades are blocked.

**Compromise:** whoever has the keypair can deploy malicious bytecode that drains user funds. This is the worst-case outcome.

Treat the keypair the way you'd treat a hardware wallet seed phrase.

---

## What was backed up (2026-05-06)

Two redundant copies were created on this date by the project lead:

1. **Password-manager paste (primary).** The keypair JSON byte array was copied to clipboard via `pbcopy < target/deploy/kommit-keypair.json` and pasted into a private password manager as a secure note. Title pattern: *"Kommit program upgrade authority keypair (GxM3sxMp4...)"*. The password manager is the project lead's private vault; only the project lead has access.

2. **Encrypted file backup (secondary).** Created via:

   ```bash
   openssl enc -aes-256-cbc -salt -pbkdf2 \
     -in target/deploy/kommit-keypair.json \
     -out ~/Documents/kommit-keypair-2026-05-06.enc
   ```

   The `.enc` file lives in the project lead's cloud storage (iCloud / Dropbox / equivalent). The decryption passphrase is held only in the project lead's password manager — separate entry from the keypair note above, so the encrypted file alone is useless to anyone who finds it without the passphrase.

---

## Recovery — primary path (password manager)

If you can access the project lead's password manager:

1. Search for `Kommit program upgrade authority keypair` (or just `Kommit keypair`).
2. Open the secure note. Contents are a JSON byte array that looks like `[12,34,56,...]`.
3. Save those bytes verbatim to `target/deploy/kommit-keypair.json` in the repo. **No reformatting** — Solana expects raw JSON byte array.
4. Verify with:

   ```bash
   solana-keygen pubkey target/deploy/kommit-keypair.json
   ```

   Should print: `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3`. If it doesn't, the file got corrupted somehow — try again, or fall back to the encrypted backup.

---

## Recovery — secondary path (encrypted file)

If the password manager is gone but the encrypted file + passphrase are recoverable:

1. Locate the `.enc` file in cloud storage. Filename pattern: `kommit-keypair-YYYY-MM-DD.enc`. The most recent date wins.
2. Decrypt:

   ```bash
   openssl enc -aes-256-cbc -d -salt -pbkdf2 \
     -in ~/Documents/kommit-keypair-2026-05-06.enc \
     -out target/deploy/kommit-keypair.json
   ```

   You'll be prompted for the decryption passphrase.
3. Verify with `solana-keygen pubkey target/deploy/kommit-keypair.json` → should print the program ID above.
4. Keep the decrypted JSON file mode `0600`:

   ```bash
   chmod 600 target/deploy/kommit-keypair.json
   ```

---

## After recovery — typical operations

Once `target/deploy/kommit-keypair.json` is in place, normal Anchor flows work:

- **`anchor build`** uses the keypair's pubkey via `declare_id!` macro.
- **`anchor deploy`** signs the deploy transaction with this keypair if it's also the wallet authority.
- **`anchor upgrade <program.so> --program-id <pubkey>`** uses this keypair as the upgrade authority signer when configured in `Anchor.toml`.

For a full mainnet deploy or upgrade, see `scripts/deploy_mainnet.sh` (preflight + idempotent deploy + IDL upgrade).

---

## Total loss (both backups gone)

If both the password-manager entry AND the encrypted file are lost:

1. The program at `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3` is permanently frozen on its current bytecode.
2. To ship code changes, deploy a new program at a new program ID. This requires:
   - Updating `declare_id!` in `programs/kommit/src/lib.rs`
   - Updating `Anchor.toml` `[programs.*]` entries
   - Re-bootstrapping `KommitConfig` PDA (different program → different PDA addresses)
   - Migrating user state if any has accumulated on the frozen program
3. Communicate the migration publicly. The frozen program ID stays referenced in the OS / docs for transparency.

This is a serious operational failure. Do not let it happen. Verify backups are accessible at least once per quarter.

---

## Re-backup procedure (when keypair changes — should never happen for this keypair, but in case of rotation)

If the keypair is ever rotated (e.g., transfer to a Squads multisig):

1. Generate the new authority.
2. Run `solana program set-upgrade-authority <program-id> --new-upgrade-authority <new-pubkey>` from the OLD authority.
3. Repeat both backup options (password manager + encrypted file) for the new authority.
4. Add a new section to this document with the new date, the new authority pubkey, and which keypair file/multisig PDA it derives from.
5. Keep the OLD authority's recovery section in this document — historical record. Do not delete.

---

*Last verified: 2026-05-06 by project lead. Both backup paths exercised at backup time. No expiry on the encrypted-file path; passphrase strength is the limiting factor — use a passphrase you can recover via the password manager indefinitely.*
