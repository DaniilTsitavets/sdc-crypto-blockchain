const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyToken", function () {
  let myToken;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const MyToken = await ethers.getContractFactory("MyToken");
    myToken = await MyToken.deploy(ethers.parseEther("1000000"));
    await myToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial supply", async function () {
      expect(await myToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("1000000")
      );
    });

    it("Should set the right owner", async function () {
      expect(await myToken.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await myToken.name()).to.equal("MyToken");
      expect(await myToken.symbol()).to.equal("MTK");
    });
  });

  describe("Minting", function () {
    it("Owner can mint new tokens", async function () {
      await myToken.mint(addr1.address, ethers.parseEther("500"));
      expect(await myToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("500")
      );
    });

    it("Non-owner cannot mint tokens", async function () {
      await expect(
        myToken.connect(addr1).mint(addr1.address, ethers.parseEther("500"))
      ).to.be.revertedWithCustomError(myToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      await myToken.transfer(addr1.address, ethers.parseEther("100"));
      expect(await myToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("100")
      );
    });

    it("Should fail when transferring more than balance", async function () {
      await expect(
        myToken.connect(addr1).transfer(addr2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(myToken, "ERC20InsufficientBalance");
    });

    it("Should update balances after transfer", async function () {
      const amount = ethers.parseEther("100");
      await myToken.transfer(addr1.address, amount);
      await myToken.connect(addr1).transfer(addr2.address, amount);

      expect(await myToken.balanceOf(addr1.address)).to.equal(0);
      expect(await myToken.balanceOf(addr2.address)).to.equal(amount);
    });
  });
});