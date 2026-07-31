// ---------------------------------------------------------------------------
// OSINT validators — pure, local, dependency-free.
//
// Detect the chain + format of a wallet address or transaction hash entirely
// in the browser (nothing leaves the client) and build links to the relevant
// public block explorers. Format detection only — on-chain existence and EIP-55
// checksum validity must be confirmed on the explorer itself.
// ---------------------------------------------------------------------------

export interface ExplorerLink {
  name: string;
  url: string;
}

export interface AddressInspection {
  input: string;
  valid: boolean;
  chain: string | null;
  format: string | null;
  note: string | null;
  explorers: ExplorerLink[];
}

export interface TxInspection {
  input: string;
  valid: boolean;
  chain: string | null;
  format: string | null;
  explorers: ExplorerLink[];
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BTC_LEGACY = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const BTC_BECH32 = /^bc1[a-z0-9]{11,71}$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_TX = /^0x[0-9a-fA-F]{64}$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;

export function inspectAddress(raw: string): AddressInspection {
  const input = raw.trim();
  if (!input) {
    return { input, valid: false, chain: null, format: null, note: null, explorers: [] };
  }

  if (EVM_ADDRESS.test(input)) {
    const mixedCase = input !== input.toLowerCase() && input !== input.toUpperCase();
    return {
      input,
      valid: true,
      chain: "Ethereum / EVM",
      format: "EVM (20-byte hex)",
      note: mixedCase
        ? "Mixed-case detected — appears EIP-55 checksummed. Confirm on-chain."
        : "All-lowercase — checksum casing not present; verify on the explorer.",
      explorers: [
        { name: "Etherscan", url: `https://etherscan.io/address/${input}` },
        { name: "Blockchair", url: `https://blockchair.com/ethereum/address/${input}` },
        { name: "BscScan", url: `https://bscscan.com/address/${input}` },
      ],
    };
  }

  if (TRON_ADDRESS.test(input)) {
    return {
      input,
      valid: true,
      chain: "TRON",
      format: "TRON (Base58, T-prefixed)",
      note: null,
      explorers: [{ name: "Tronscan", url: `https://tronscan.org/#/address/${input}` }],
    };
  }

  if (BTC_BECH32.test(input)) {
    return {
      input,
      valid: true,
      chain: "Bitcoin",
      format: "Bitcoin (Bech32 / SegWit)",
      note: null,
      explorers: [
        { name: "Blockchair", url: `https://blockchair.com/bitcoin/address/${input}` },
        {
          name: "Blockchain.com",
          url: `https://www.blockchain.com/explorer/addresses/btc/${input}`,
        },
      ],
    };
  }

  if (BTC_LEGACY.test(input)) {
    return {
      input,
      valid: true,
      chain: "Bitcoin",
      format: input.startsWith("3") ? "Bitcoin (P2SH)" : "Bitcoin (Legacy P2PKH)",
      note: null,
      explorers: [
        { name: "Blockchair", url: `https://blockchair.com/bitcoin/address/${input}` },
        {
          name: "Blockchain.com",
          url: `https://www.blockchain.com/explorer/addresses/btc/${input}`,
        },
      ],
    };
  }

  return {
    input,
    valid: false,
    chain: null,
    format: null,
    note: "Not a recognized Bitcoin, EVM, or TRON address format.",
    explorers: [],
  };
}

export function inspectTxHash(raw: string): TxInspection {
  const input = raw.trim();
  if (!input) {
    return { input, valid: false, chain: null, format: null, explorers: [] };
  }

  if (EVM_TX.test(input)) {
    return {
      input,
      valid: true,
      chain: "Ethereum / EVM",
      format: "EVM transaction (0x + 64 hex)",
      explorers: [
        { name: "Etherscan", url: `https://etherscan.io/tx/${input}` },
        { name: "Blockchair", url: `https://blockchair.com/ethereum/transaction/${input}` },
      ],
    };
  }

  if (HEX64.test(input)) {
    return {
      input,
      valid: true,
      chain: "Bitcoin or TRON",
      format: "64-char hex (no 0x) — Bitcoin or TRON",
      explorers: [
        { name: "Blockchair (BTC)", url: `https://blockchair.com/bitcoin/transaction/${input}` },
        { name: "Tronscan (TRX)", url: `https://tronscan.org/#/transaction/${input}` },
      ],
    };
  }

  return { input, valid: false, chain: null, format: null, explorers: [] };
}
