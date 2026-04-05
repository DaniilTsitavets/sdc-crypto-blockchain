import { network } from "hardhat";

const { viem, networkName } = await network.connect();

const client = await viem.getPublicClient();

console.log(`Deploying Counter to ${networkName}...`);

const counter = await viem.deployContract("Counter");

console.log("Counter address:", counter.address);