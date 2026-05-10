const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
  let wallet;
  let owner1, owner2, owner3, nonOwner;

  const REQUIRED = 2;

  beforeEach(async function () {
    [owner1, owner2, owner3, nonOwner] = await ethers.getSigners();

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    wallet = await MultiSigWallet.deploy(
      [owner1.address, owner2.address, owner3.address],
      REQUIRED
    );
    await wallet.waitForDeployment();
  });

  // ---------------------------------------------------------------------------
  // Deployment
  // ---------------------------------------------------------------------------

  describe("Deployment", function () {
    it("stores owners correctly", async function () {
      const owners = await wallet.getOwners();
      expect(owners).to.deep.equal([
        owner1.address,
        owner2.address,
        owner3.address,
      ]);
    });

    it("stores required correctly", async function () {
      expect(await wallet.required()).to.equal(REQUIRED);
    });

    it("marks each address as owner", async function () {
      expect(await wallet.isOwner(owner1.address)).to.be.true;
      expect(await wallet.isOwner(owner2.address)).to.be.true;
      expect(await wallet.isOwner(owner3.address)).to.be.true;
      expect(await wallet.isOwner(nonOwner.address)).to.be.false;
    });

    it("reverts when owners array is empty", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(MultiSigWallet.deploy([], 1)).to.be.revertedWith(
        "owners required"
      );
    });

    it("reverts when required is 0", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address], 0)
      ).to.be.revertedWith("invalid required count");
    });

    it("reverts when required exceeds owner count", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address, owner2.address], 3)
      ).to.be.revertedWith("invalid required count");
    });

    it("reverts on duplicate owners", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address, owner1.address], 1)
      ).to.be.revertedWith("duplicate owner");
    });

    it("reverts on zero address owner", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([ethers.ZeroAddress], 1)
      ).to.be.revertedWith("zero address owner");
    });
  });

  // ---------------------------------------------------------------------------
  // Deposits
  // ---------------------------------------------------------------------------

  describe("Deposit", function () {
    it("accepts ETH and emits Deposit event", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        owner1.sendTransaction({ to: await wallet.getAddress(), value: amount })
      )
        .to.emit(wallet, "Deposit")
        .withArgs(owner1.address, amount, amount);

      expect(
        await ethers.provider.getBalance(await wallet.getAddress())
      ).to.equal(amount);
    });
  });

  // ---------------------------------------------------------------------------
  // submitTransaction
  // ---------------------------------------------------------------------------

  describe("submitTransaction", function () {
    it("allows an owner to submit a transaction", async function () {
      const to = nonOwner.address;
      const value = ethers.parseEther("0.5");
      const data = "0x";

      await expect(wallet.connect(owner1).submitTransaction(to, value, data))
        .to.emit(wallet, "SubmitTransaction")
        .withArgs(owner1.address, 0, to, value, data);

      expect(await wallet.getTransactionCount()).to.equal(1);
    });

    it("stores transaction fields correctly", async function () {
      const to = nonOwner.address;
      const value = ethers.parseEther("0.1");
      await wallet.connect(owner1).submitTransaction(to, value, "0x");

      const [txTo, txValue, , txExecuted, txConfCount] =
        await wallet.getTransaction(0);
      expect(txTo).to.equal(to);
      expect(txValue).to.equal(value);
      expect(txExecuted).to.be.false;
      expect(txConfCount).to.equal(0);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        wallet.connect(nonOwner).submitTransaction(nonOwner.address, 0, "0x")
      ).to.be.revertedWith("not owner");
    });
  });

  // ---------------------------------------------------------------------------
  // confirmTransaction
  // ---------------------------------------------------------------------------

  describe("confirmTransaction", function () {
    beforeEach(async function () {
      await wallet
        .connect(owner1)
        .submitTransaction(nonOwner.address, ethers.parseEther("0.1"), "0x");
    });

    it("allows an owner to confirm", async function () {
      await expect(wallet.connect(owner1).confirmTransaction(0))
        .to.emit(wallet, "ConfirmTransaction")
        .withArgs(owner1.address, 0);

      const [, , , , count] = await wallet.getTransaction(0);
      expect(count).to.equal(1);
      expect(await wallet.isConfirmed(0, owner1.address)).to.be.true;
    });

    it("increments confirmation count with multiple owners", async function () {
      await wallet.connect(owner1).confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);

      const [, , , , count] = await wallet.getTransaction(0);
      expect(count).to.equal(2);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        wallet.connect(nonOwner).confirmTransaction(0)
      ).to.be.revertedWith("not owner");
    });

    it("reverts for a non-existent transaction", async function () {
      await expect(
        wallet.connect(owner1).confirmTransaction(99)
      ).to.be.revertedWith("tx does not exist");
    });

    it("reverts on duplicate confirmation by same owner", async function () {
      await wallet.connect(owner1).confirmTransaction(0);
      await expect(
        wallet.connect(owner1).confirmTransaction(0)
      ).to.be.revertedWith("tx already confirmed");
    });
  });

  // ---------------------------------------------------------------------------
  // executeTransaction
  // ---------------------------------------------------------------------------

  describe("executeTransaction", function () {
    const txValue = ethers.parseEther("1");

    beforeEach(async function () {
      // Fund the wallet
      await owner1.sendTransaction({
        to: await wallet.getAddress(),
        value: ethers.parseEther("2"),
      });
      // Submit a tx
      await wallet
        .connect(owner1)
        .submitTransaction(nonOwner.address, txValue, "0x");
    });

    it("executes after reaching required confirmations", async function () {
      await wallet.connect(owner1).confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);

      const balanceBefore = await ethers.provider.getBalance(nonOwner.address);
      await expect(wallet.connect(owner1).executeTransaction(0))
        .to.emit(wallet, "ExecuteTransaction")
        .withArgs(owner1.address, 0);

      const balanceAfter = await ethers.provider.getBalance(nonOwner.address);
      expect(balanceAfter - balanceBefore).to.equal(txValue);

      const [, , , executed] = await wallet.getTransaction(0);
      expect(executed).to.be.true;
    });

    it("reverts when confirmations are insufficient", async function () {
      await wallet.connect(owner1).confirmTransaction(0);
      // Only 1 confirmation, required = 2
      await expect(
        wallet.connect(owner1).executeTransaction(0)
      ).to.be.revertedWith("insufficient confirmations");
    });

    it("reverts when called by non-owner", async function () {
      await wallet.connect(owner1).confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await expect(
        wallet.connect(nonOwner).executeTransaction(0)
      ).to.be.revertedWith("not owner");
    });

    it("reverts on re-execution of an already executed transaction", async function () {
      await wallet.connect(owner1).confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.connect(owner1).executeTransaction(0);

      await expect(
        wallet.connect(owner1).executeTransaction(0)
      ).to.be.revertedWith("tx already executed");
    });

    it("reverts for a non-existent transaction", async function () {
      await expect(
        wallet.connect(owner1).executeTransaction(99)
      ).to.be.revertedWith("tx does not exist");
    });
  });

  // ---------------------------------------------------------------------------
  // revokeConfirmation
  // ---------------------------------------------------------------------------

  describe("revokeConfirmation", function () {
    beforeEach(async function () {
      await owner1.sendTransaction({
        to: await wallet.getAddress(),
        value: ethers.parseEther("1"),
      });
      await wallet
        .connect(owner1)
        .submitTransaction(nonOwner.address, ethers.parseEther("0.5"), "0x");
      await wallet.connect(owner1).confirmTransaction(0);
    });

    it("allows an owner to revoke their confirmation", async function () {
      await expect(wallet.connect(owner1).revokeConfirmation(0))
        .to.emit(wallet, "RevokeConfirmation")
        .withArgs(owner1.address, 0);

      const [, , , , count] = await wallet.getTransaction(0);
      expect(count).to.equal(0);
      expect(await wallet.isConfirmed(0, owner1.address)).to.be.false;
    });

    it("prevents execution after revocation drops count below required", async function () {
      await wallet.connect(owner2).confirmTransaction(0);
      // Both confirmed → revoke one
      await wallet.connect(owner1).revokeConfirmation(0);
      // Now only 1 confirmation
      await expect(
        wallet.connect(owner2).executeTransaction(0)
      ).to.be.revertedWith("insufficient confirmations");
    });

    it("reverts when owner has not confirmed", async function () {
      await expect(
        wallet.connect(owner2).revokeConfirmation(0)
      ).to.be.revertedWith("tx not confirmed");
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        wallet.connect(nonOwner).revokeConfirmation(0)
      ).to.be.revertedWith("not owner");
    });

    it("reverts for a non-existent transaction", async function () {
      await expect(
        wallet.connect(owner1).revokeConfirmation(99)
      ).to.be.revertedWith("tx does not exist");
    });

    it("reverts when transaction is already executed", async function () {
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.connect(owner1).executeTransaction(0);

      await expect(
        wallet.connect(owner2).revokeConfirmation(0)
      ).to.be.revertedWith("tx already executed");
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases / integration
  // ---------------------------------------------------------------------------

  describe("Edge cases", function () {
    it("handles a transaction with calldata (not just ETH transfer)", async function () {
      // Deploy a simple counter to call
      const Counter = await ethers.getContractFactory(
        "contracts/MultiSigWallet.sol:MultiSigWallet"
      );
      // Instead, just verify bytes data is stored verbatim
      const data = "0xdeadbeef";
      await wallet.connect(owner1).submitTransaction(nonOwner.address, 0, data);
      const [, , storedData] = await wallet.getTransaction(0);
      expect(storedData).to.equal(data);
    });

    it("all three owners can confirm and any owner can execute", async function () {
      await owner1.sendTransaction({
        to: await wallet.getAddress(),
        value: ethers.parseEther("1"),
      });
      await wallet
        .connect(owner1)
        .submitTransaction(nonOwner.address, ethers.parseEther("0.1"), "0x");

      await wallet.connect(owner1).confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.connect(owner3).confirmTransaction(0);

      const [, , , , count] = await wallet.getTransaction(0);
      expect(count).to.equal(3);

      // owner3 executes (not the submitter)
      await expect(wallet.connect(owner3).executeTransaction(0)).to.emit(
        wallet,
        "ExecuteTransaction"
      );
    });

    it("multiple independent transactions can coexist", async function () {
      await owner1.sendTransaction({
        to: await wallet.getAddress(),
        value: ethers.parseEther("2"),
      });

      await wallet
        .connect(owner1)
        .submitTransaction(nonOwner.address, ethers.parseEther("0.1"), "0x");
      await wallet
        .connect(owner1)
        .submitTransaction(owner3.address, ethers.parseEther("0.2"), "0x");

      expect(await wallet.getTransactionCount()).to.equal(2);

      // Execute only tx 0
      await wallet.connect(owner1).confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.connect(owner1).executeTransaction(0);

      const [, , , ex0] = await wallet.getTransaction(0);
      const [, , , ex1] = await wallet.getTransaction(1);
      expect(ex0).to.be.true;
      expect(ex1).to.be.false;
    });
  });
});