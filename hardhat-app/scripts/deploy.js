const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const MyTokenV1 = await ethers.getContractFactory("MyTokenV1");

  console.log("\nDeploying MyTokenV1 (UUPS proxy)...");
  const proxy = await upgrades.deployProxy(MyTokenV1, [deployer.address], {
    initializer: "initialize",
    kind: "uups",
  });

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Proxy address:          ", proxyAddress);
  console.log("Implementation (V1):    ", implAddress);

  // Save addresses for later scripts
  const fs = require("fs");
  const addresses = { proxy: proxyAddress, v1: implAddress };
  fs.writeFileSync("deployed.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});