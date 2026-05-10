const hre = require("hardhat");

async function main() {
  const [deployer, owner2, owner3] = await hre.ethers.getSigners();

  const owners = [deployer.address, owner2.address, owner3.address];
  const required = 2;

  console.log("Deploying MultiSigWallet...");
  console.log("Owners:", owners);
  console.log("Required confirmations:", required);

  const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
  const wallet = await MultiSigWallet.deploy(owners, required);
  await wallet.waitForDeployment();

  const address = await wallet.getAddress();
  console.log("MultiSigWallet deployed to:", address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});