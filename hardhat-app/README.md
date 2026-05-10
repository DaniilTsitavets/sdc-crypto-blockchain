# MultiSigWallet

A multi-signature wallet smart contract written in Solidity 0.8.22. Funds can only be moved when a minimum number of owners (`required`) approve a transaction.

---

## Contract Design

### Data Structures

| Storage | Purpose |
|---|---|
| `address[] owners` | Ordered list of wallet owners |
| `mapping(address => bool) isOwner` | O(1) ownership check |
| `uint required` | Minimum confirmations needed to execute |
| `Transaction[] transactions` | All submitted transactions (append-only) |
| `mapping(uint => mapping(address => bool)) isConfirmed` | Per-tx per-owner confirmation flag |

```solidity
struct Transaction {
    address to;
    uint value;
    bytes data;
    bool executed;
    uint confirmationCount;
}
```

### Transaction Lifecycle

```
submit → confirm (×N) → execute
               ↑
           revoke (before execute)
```

1. **Submit** — any owner proposes a transaction (recipient, ETH value, calldata).
2. **Confirm** — each owner independently confirms. Duplicate confirmations are rejected.
3. **Execute** — any owner triggers execution once `confirmationCount >= required`. Uses checks-effects-interactions: `executed = true` is set before the external call.
4. **Revoke** — an owner can withdraw their confirmation at any point before execution.

### Access Control

Every state-changing function is guarded by the `onlyOwner` modifier. Modifiers `txExists`, `notExecuted`, and `notConfirmed` enforce invariants before any storage is touched.

### Events

| Event | Emitted when |
|---|---|
| `Deposit(sender, value, balance)` | ETH received via `receive()` |
| `SubmitTransaction(owner, txId, to, value, data)` | Transaction proposed |
| `ConfirmTransaction(owner, txId)` | Owner confirms |
| `RevokeConfirmation(owner, txId)` | Owner revokes |
| `ExecuteTransaction(owner, txId)` | Transaction executed |

---

## Deployment

### Prerequisites

```bash
cd hardhat-app
npm install
```

Copy `.env.example` to `.env` and fill in your values:

```
PRIVATE_KEY=<deployer private key>
SEPOLIA_RPC_URL=<your RPC endpoint>
```

### Local (Hardhat network)

```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Sepolia testnet

```bash
npm run deploy
# equivalent to: npx hardhat run scripts/deploy.js --network sepolia
```

The deploy script uses the first three signers as owners and sets `required = 2`.

---

## Interacting with the Contract

After deployment, copy the printed contract address and use Hardhat console or ethers.js:

```js
const wallet = await ethers.getContractAt("MultiSigWallet", "<address>");

// Fund the wallet
await owner.sendTransaction({ to: await wallet.getAddress(), value: ethers.parseEther("1") });

// Propose a transfer
const txId = await wallet.submitTransaction.staticCall(recipient, ethers.parseEther("0.5"), "0x");
await wallet.submitTransaction(recipient, ethers.parseEther("0.5"), "0x");

// Two owners confirm
await wallet.connect(owner1).confirmTransaction(txId);
await wallet.connect(owner2).confirmTransaction(txId);

// Execute
await wallet.connect(owner1).executeTransaction(txId);
```

---

## Running Tests

```bash
npx hardhat test
# or
npm test
```

31 tests cover:
- Deployment validation (empty owners, invalid required, duplicates, zero address)
- ETH deposits and `Deposit` event
- `submitTransaction` — success and non-owner rejection
- `confirmTransaction` — counting, duplicate rejection, non-existent tx
- `executeTransaction` — threshold enforcement, re-execution guard, ETH transfer verification
- `revokeConfirmation` — state rollback, post-revoke execution prevention
- Edge cases — calldata storage, multi-tx coexistence, any owner can execute

---

## Security Considerations

**Checks-Effects-Interactions pattern**
`executed = true` is written to storage before the external `.call()`. This prevents re-entrancy: any re-entrant call to `executeTransaction` hits the `notExecuted` modifier and reverts.

**Confirmation count integrity**
`confirmationCount` is incremented/decremented only through `confirmTransaction` / `revokeConfirmation`, both of which verify the current confirmation state first (`notConfirmed` / `require(isConfirmed[...])`). This prevents double-counting and underflow.

**Input validation at construction**
The constructor rejects empty owner lists, `required = 0`, `required > owners.length`, zero addresses, and duplicate owners. Invalid state is impossible to reach after deployment.

**No owner management after deployment**
Owners are fixed at construction. This eliminates an entire class of privilege-escalation attacks (malicious `addOwner` proposals). Dynamic ownership would require additional multi-sig governance of the governance itself.

**External call failure propagates**
`require(success, "tx failed")` ensures a failed external call reverts the transaction, keeping `executed = true` and the contract balance consistent.

**Potential limitations to be aware of**
- No timelock or expiry on pending transactions — a pending tx remains executable indefinitely.
- No on-chain owner enumeration for confirmations — off-chain tooling must track who has confirmed.
- No ETH recovery mechanism if all owners lose their keys.

---

## Purpose of Multi-Sig Wallets in DeFi

A single private key is a single point of failure. Multi-sig wallets distribute trust: an attacker must compromise `required` out of `N` independent keys to move funds. This makes them the standard for:

- **Treasury management** — DAOs and protocols hold community funds in multi-sigs so no single contributor can drain them.
- **Protocol upgrades** — upgrade calls are submitted as multi-sig transactions, requiring agreement from several core team members before any proxy is changed.
- **Exchange hot wallets** — operational wallets require 2-of-3 or 3-of-5 approval, limiting damage from a single compromised operator.
- **Escrow and joint accounts** — parties split control so neither can act unilaterally.

The trade-off is operational overhead: every action requires coordination between key holders. Production systems (e.g. Gnosis Safe) add off-chain signing and a relayer so confirmations are collected via signatures rather than on-chain transactions, reducing gas costs significantly.