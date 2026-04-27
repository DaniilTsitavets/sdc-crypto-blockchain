const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses = JSON.parse(fs.readFileSync("deployed.json"));
  const proxyAddress = addresses.proxy;

  console.log("Upgrading proxy at:", proxyAddress);

  // Deploy V2 implementation manually
  const MyTokenV2Factory = await ethers.getContractFactory("MyTokenV2");
  const v2Impl = await MyTokenV2Factory.deploy();
  await v2Impl.waitForDeployment();
  const v2ImplAddress = await v2Impl.getAddress();
  console.log("New V2 implementation deployed at:", v2ImplAddress);

  // Call upgradeToAndCall on the proxy (owner only)
  const proxy = await ethers.getContractAt("MyTokenV1", proxyAddress);
  const upgradeTx = await proxy.upgradeToAndCall(v2ImplAddress, "0x");
  await upgradeTx.wait();
  console.log("Upgrade tx:", upgradeTx.hash);

  // Verify new implementation address
  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Implementation address in proxy:", newImpl);

  // Verify state is preserved
  const tokenV2 = await ethers.getContractAt("MyTokenV2", proxyAddress);

  const ownerBalance = await tokenV2.balanceOf(deployer.address);
  console.log("\nOwner balance after upgrade:", ethers.formatEther(ownerBalance), "MTK");

  const deadBalance = await tokenV2.balanceOf("0x000000000000000000000000000000000000dEaD");
  console.log("Dead address balance:       ", ethers.formatEther(deadBalance), "MTK");

  const ver = await tokenV2.version();
  console.log("\nversion():", ver);

  addresses.v2 = v2ImplAddress;
  fs.writeFileSync("deployed.json", JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});