/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/kommit.json`.
 */
export type Kommit = {
  "address": "GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3",
  "metadata": {
    "name": "kommit",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana yield-routing primitive for early-stage validation"
  },
  "instructions": [
    {
      "name": "accruePoints",
      "docs": [
        "Permissionless crank. Brings a commitment's active + lifetime scores up to date."
      ],
      "discriminator": [
        177,
        159,
        139,
        58,
        243,
        35,
        63,
        89
      ],
      "accounts": [
        {
          "name": "commitment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "commitment.user",
                "account": "commitment"
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "project",
          "relations": [
            "commitment"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "adminPause",
      "docs": [
        "Admin-only. Halts new commits; withdrawals remain allowed."
      ],
      "discriminator": [
        13,
        109,
        240,
        129,
        86,
        245,
        182,
        45
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "adminUnpause",
      "docs": [
        "Admin-only. Resumes commits."
      ],
      "discriminator": [
        119,
        151,
        255,
        104,
        143,
        119,
        66,
        164
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "adminUpdateProjectMetadata",
      "docs": [
        "Admin-only. Rotate the off-chain metadata pointer for a project.",
        "Founders update pitch / image off-chain, admin commits the new IPFS hash on-chain."
      ],
      "discriminator": [
        149,
        64,
        242,
        59,
        163,
        235,
        143,
        112
      ],
      "accounts": [
        {
          "name": "project",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "metadataUriHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "commit",
      "docs": [
        "User commits USDC to a project. Principal sits in a per-project escrow PDA."
      ],
      "discriminator": [
        223,
        140,
        142,
        165,
        229,
        208,
        156,
        74
      ],
      "accounts": [
        {
          "name": "commitment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userUsdcTokenAccount",
          "writable": true
        },
        {
          "name": "escrowTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createProject",
      "docs": [
        "Admin-only. Curate a new project: yield will flow to `recipient_wallet`."
      ],
      "discriminator": [
        148,
        219,
        181,
        42,
        221,
        114,
        145,
        190
      ],
      "accounts": [
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "recipientWallet"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "recipientWallet",
          "type": "pubkey"
        },
        {
          "name": "metadataUriHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "harvest",
      "docs": [
        "Permissionless. Computes accrued yield on-chain from klend reserve state,",
        "redeems just that amount, routes to recipient. Principal stays supplied.",
        "`min_yield` enforces a dust threshold — actual USDC routed must be ≥ min_yield.",
        "(QA C1 redesign 2026-05-05.)"
      ],
      "discriminator": [
        228,
        241,
        31,
        182,
        53,
        169,
        59,
        199
      ],
      "accounts": [
        {
          "name": "project",
          "writable": true
        },
        {
          "name": "adapterConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  97,
                  109,
                  105,
                  110,
                  111,
                  95,
                  97,
                  100,
                  97,
                  112,
                  116,
                  101,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lendingPosition",
          "writable": true
        },
        {
          "name": "collateralTokenAccount",
          "docs": [
            "Collateral PDA holding cTokens. Signs as klend `owner` for redeem AND",
            "as the authority of `harvest_landing_usdc` AND of the second-hop",
            "forward to recipient."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "harvestLandingUsdc",
          "docs": [
            "Per-project USDC landing account owned by the collateral PDA. Klend",
            "redeems INTO this; harvest then forwards from here to recipient."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "collateralTokenAccount"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "recipientTokenAccount",
          "docs": [
            "Recipient's USDC ATA — final destination."
          ],
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "klendReserve",
          "writable": true
        },
        {
          "name": "klendLendingMarket"
        },
        {
          "name": "klendLendingMarketAuthority"
        },
        {
          "name": "klendReserveLiquidityMint"
        },
        {
          "name": "klendReserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "klendProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "minYield",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "docs": [
        "One-time program initialization. Sets the admin pubkey."
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeKaminoAdapterConfig",
      "docs": [
        "Admin-only, one-time. Populates the Kamino klend adapter allowlist",
        "(QA C2). supply / harvest CPIs require key-equality against this PDA."
      ],
      "discriminator": [
        65,
        255,
        154,
        5,
        187,
        45,
        165,
        142
      ],
      "accounts": [
        {
          "name": "adapterConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  97,
                  109,
                  105,
                  110,
                  111,
                  95,
                  97,
                  100,
                  97,
                  112,
                  116,
                  101,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "klendProgram",
          "type": "pubkey"
        },
        {
          "name": "usdcReserve",
          "type": "pubkey"
        },
        {
          "name": "usdcLendingMarket",
          "type": "pubkey"
        },
        {
          "name": "usdcMarketAuthority",
          "type": "pubkey"
        },
        {
          "name": "usdcLiquiditySupply",
          "type": "pubkey"
        },
        {
          "name": "usdcCollateralMint",
          "type": "pubkey"
        },
        {
          "name": "usdcLiquidityMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "supplyToYieldSource",
      "docs": [
        "Permissionless. Supply USDC from the project escrow into the klend reserve.",
        "Caller can pass `u64::MAX` to supply all available escrow."
      ],
      "discriminator": [
        238,
        133,
        3,
        249,
        31,
        83,
        108,
        53
      ],
      "accounts": [
        {
          "name": "project"
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "adapterConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  97,
                  109,
                  105,
                  110,
                  111,
                  95,
                  97,
                  100,
                  97,
                  112,
                  116,
                  101,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrowTokenAccount",
          "docs": [
            "Per-project USDC escrow PDA. Holds committed liquidity. Signs as klend `owner`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "collateralTokenAccount",
          "docs": [
            "Per-project cToken (klend reserve_collateral) PDA. Receives the cTokens.",
            "Mint is the reserve's collateral mint, determined by which klend reserve."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "lendingPosition",
          "docs": [
            "Per-(project, adapter) lending position. Tracks supplied amount + which reserve."
          ],
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "klendReserve",
          "writable": true
        },
        {
          "name": "klendLendingMarket"
        },
        {
          "name": "klendLendingMarketAuthority"
        },
        {
          "name": "klendReserveLiquidityMint"
        },
        {
          "name": "klendReserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "klendProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "User withdraws principal. Always allowed (kill-switch invariant: not gated by pause).",
        "`amount == u64::MAX` withdraws the full principal.",
        "`redeem_collateral_amount` may be 0; if escrow has < amount, caller must",
        "also pass the klend account graph via `remaining_accounts` (see",
        "`Withdraw` doc-comment)."
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "commitment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "project",
          "relations": [
            "commitment"
          ]
        },
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "commitment"
          ]
        },
        {
          "name": "userUsdcTokenAccount",
          "writable": true
        },
        {
          "name": "escrowTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "redeemCollateralAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "commitment",
      "discriminator": [
        61,
        112,
        129,
        128,
        24,
        147,
        77,
        87
      ]
    },
    {
      "name": "kaminoAdapterConfig",
      "discriminator": [
        84,
        166,
        127,
        110,
        150,
        26,
        136,
        224
      ]
    },
    {
      "name": "kommitConfig",
      "discriminator": [
        122,
        241,
        244,
        143,
        232,
        168,
        14,
        102
      ]
    },
    {
      "name": "lendingPosition",
      "discriminator": [
        47,
        255,
        252,
        35,
        20,
        245,
        157,
        243
      ]
    },
    {
      "name": "project",
      "discriminator": [
        205,
        168,
        189,
        202,
        181,
        247,
        142,
        19
      ]
    }
  ],
  "events": [
    {
      "name": "committed",
      "discriminator": [
        70,
        158,
        162,
        86,
        29,
        111,
        143,
        226
      ]
    },
    {
      "name": "pointsAccrued",
      "discriminator": [
        57,
        216,
        47,
        18,
        162,
        247,
        253,
        75
      ]
    },
    {
      "name": "projectCreated",
      "discriminator": [
        192,
        10,
        163,
        29,
        185,
        31,
        67,
        168
      ]
    },
    {
      "name": "projectMetadataUpdated",
      "discriminator": [
        116,
        68,
        187,
        63,
        126,
        197,
        102,
        134
      ]
    },
    {
      "name": "supplyExecuted",
      "discriminator": [
        222,
        82,
        177,
        9,
        184,
        227,
        11,
        16
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    },
    {
      "name": "yieldHarvested",
      "discriminator": [
        49,
        197,
        226,
        232,
        154,
        211,
        249,
        222
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "paused",
      "msg": "Program is paused"
    },
    {
      "code": 6001,
      "name": "insufficientPrincipal",
      "msg": "Insufficient principal to withdraw"
    },
    {
      "code": 6002,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6004,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6005,
      "name": "unknownAdapter",
      "msg": "Unknown adapter id"
    },
    {
      "code": 6006,
      "name": "adapterMismatch",
      "msg": "Adapter mismatch — lending_position adapter_id != requested"
    },
    {
      "code": 6007,
      "name": "dustHarvest",
      "msg": "Yield below dust threshold; harvest skipped"
    }
  ],
  "types": [
    {
      "name": "commitment",
      "docs": [
        "One per (user, project) pair. PDA seeds: [b\"commitment\", user.as_ref(), project.as_ref()]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "principal",
            "type": "u64"
          },
          {
            "name": "depositTs",
            "type": "i64"
          },
          {
            "name": "activeScore",
            "type": "u128"
          },
          {
            "name": "lifetimeScore",
            "type": "u128"
          },
          {
            "name": "lastAccrualTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "committed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "kaminoAdapterConfig",
      "docs": [
        "Singleton allowlist for the Kamino klend adapter — admin curates which",
        "klend program + USDC reserve graph the project escrow PDAs are allowed to",
        "supply into. Without this, supply_to_yield_source's permissionless caller",
        "could bind project principal to any klend reserve (QA C2).",
        "",
        "PDA seeds: [b\"kamino_adapter_config\"]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "klendProgram",
            "type": "pubkey"
          },
          {
            "name": "usdcReserve",
            "type": "pubkey"
          },
          {
            "name": "usdcLendingMarket",
            "type": "pubkey"
          },
          {
            "name": "usdcMarketAuthority",
            "type": "pubkey"
          },
          {
            "name": "usdcLiquiditySupply",
            "type": "pubkey"
          },
          {
            "name": "usdcCollateralMint",
            "type": "pubkey"
          },
          {
            "name": "usdcLiquidityMint",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "kommitConfig",
      "docs": [
        "Singleton program config. PDA seeds: [b\"config\"]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lendingPosition",
      "docs": [
        "One per (project, adapter). Tracks the funds we've routed into a yield source",
        "and the cumulative `vault_handle` (the underlying reserve / market account).",
        "PDA seeds: [b\"lending\", project.as_ref(), &[adapter_id]]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "adapterId",
            "type": "u8"
          },
          {
            "name": "vaultHandle",
            "type": "pubkey"
          },
          {
            "name": "supplied",
            "type": "u64"
          },
          {
            "name": "lastHarvestTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pointsAccrued",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "activeDelta",
            "type": "u128"
          },
          {
            "name": "lifetimeTotal",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "project",
      "docs": [
        "One per founder/team. PDA seeds: [b\"project\", recipient_wallet.as_ref()]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recipientWallet",
            "type": "pubkey"
          },
          {
            "name": "metadataUriHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "cumulativePrincipal",
            "type": "u64"
          },
          {
            "name": "cumulativeYieldRouted",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "projectCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "recipientWallet",
            "type": "pubkey"
          },
          {
            "name": "metadataUriHash",
            "docs": [
              "QA H1: indexer needs the metadata hash at create time so it can",
              "resolve the IPFS pin without a follow-up account fetch."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "projectMetadataUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "newHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "supplyExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "yieldHarvested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
