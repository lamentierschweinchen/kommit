// Migrations are an early feature. Currently, only `deploy` is supported.
// This script runs after `anchor deploy` and is the place for one-time
// bootstrapping — initialize_config, seed projects, etc.
//
// See https://www.anchor-lang.com/docs/cli#migrate

const anchor = require("@coral-xyz/anchor");

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);

  // Add bootstrap logic here once instructions are wired up:
  //   - initialize_config (one-time)
  //   - register seed projects
};
