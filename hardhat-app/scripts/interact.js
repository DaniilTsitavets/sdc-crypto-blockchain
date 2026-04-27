const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [owner] = await ethers.getSigners();
  const { proxy: proxyAddress } = JSON.parse(fs.readFileSync("deployed.json"));

  console.log("Using proxy at:", proxyAddress);

  const token = await ethers.getContractAt("MyTokenV1", proxyAddress);

  // Mint 1000 tokens to owner
  const mintAmount = ethers.parseEther("1000");
  console.log("\nMinting 1000 MTK to", owner.address);
  const mintTx = await token.mint(owner.address, mintAmount);
  await mintTx.wait();
  console.log("Mint tx:", mintTx.hash);

  let balance = await token.balanceOf(owner.address);
  console.log("Owner balance:", ethers.formatEther(balance), "MTK");

  // Transfer 100 tokens to a second account (or back to owner for demo)
  const recipient = "0x000000000000000000000000000000000000dEaD";
  const transferAmount = ethers.parseEther("100");
  console.log("\nTransferring 100 MTK to", recipient);
  const transferTx = await token.transfer(recipient, transferAmount);
  await transferTx.wait();
  console.log("Transfer tx:", transferTx.hash);

  balance = await token.balanceOf(owner.address);
  const recipientBalance = await token.balanceOf(recipient);
  console.log("Owner balance after transfer:    ", ethers.formatEther(balance), "MTK");
  console.log("Recipient balance after transfer:", ethers.formatEther(recipientBalance), "MTK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});