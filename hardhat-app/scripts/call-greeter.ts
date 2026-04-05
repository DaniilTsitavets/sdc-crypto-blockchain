import { network } from "hardhat";

const { viem } = await network.connect();

const greeter = await viem.getContractAt(
  "Greeter",
  "0xf56174E6c03a831f136430390Ef509CeE5Ee45ad"
);

const message = await greeter.read.greet();
console.log("greet() returned:", message);