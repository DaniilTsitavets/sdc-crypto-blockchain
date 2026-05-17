const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // ── 1. SoulboundVisitCardERC721 ──────────────────────────────────────────
  console.log("Deploying SoulboundVisitCardERC721...");
  const SVC = await ethers.getContractFactory("SoulboundVisitCardERC721");
  const svc = await SVC.deploy(deployer.address);
  await svc.waitForDeployment();
  const svcAddress = await svc.getAddress();
  console.log("SoulboundVisitCardERC721:", svcAddress);

  // ── 2. GameCharacterCollectionERC1155 ────────────────────────────────────
  console.log("\nDeploying GameCharacterCollectionERC1155...");
  const GCC = await ethers.getContractFactory("GameCharacterCollectionERC1155");
  const gcc = await GCC.deploy(deployer.address);
  await gcc.waitForDeployment();
  const gccAddress = await gcc.getAddress();
  console.log("GameCharacterCollectionERC1155:", gccAddress);

  // ── Save addresses ────────────────────────────────────────────────────────
  const addresses = {
    soulboundVisitCard: svcAddress,
    gameCharacterCollection: gccAddress,
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
  };
  fs.writeFileSync("deployed.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});