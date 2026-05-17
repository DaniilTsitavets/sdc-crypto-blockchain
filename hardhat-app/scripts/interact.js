/**
 * interact.js
 *
 * Demonstrates:
 *   1. Minting a soulbound visit card (ERC-721) to the student wallet.
 *   2. Batch minting 10 game characters (ERC-1155) — 1 of each — to the owner.
 *   3. Batch transferring 2 characters to the student wallet.
 *
 * Prerequisites:
 *   - Both contracts deployed (run `npm run deploy` first).
 *   - deployed.json present with contract addresses.
 *   - STUDENT_WALLET set in .env (or hardcoded below).
 */

require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");

// ── Student wallet — replace with the actual student address ────────────────
const STUDENT_WALLET =
  process.env.STUDENT_WALLET || "0x000000000000000000000000000000000000dEaD";

// ── IPFS URIs — replace with your actual CIDs after uploading to IPFS ───────
const ERC721_METADATA_URI =
  process.env.ERC721_METADATA_URI ||
  "ipfs://QmYOUR_ERC721_CID/visit-card.json";

const ERC1155_URIS = [
  process.env.ERC1155_URI_0 || "ipfs://QmYOUR_CID/0.json",
  process.env.ERC1155_URI_1 || "ipfs://QmYOUR_CID/1.json",
  process.env.ERC1155_URI_2 || "ipfs://QmYOUR_CID/2.json",
  process.env.ERC1155_URI_3 || "ipfs://QmYOUR_CID/3.json",
  process.env.ERC1155_URI_4 || "ipfs://QmYOUR_CID/4.json",
  process.env.ERC1155_URI_5 || "ipfs://QmYOUR_CID/5.json",
  process.env.ERC1155_URI_6 || "ipfs://QmYOUR_CID/6.json",
  process.env.ERC1155_URI_7 || "ipfs://QmYOUR_CID/7.json",
  process.env.ERC1155_URI_8 || "ipfs://QmYOUR_CID/8.json",
  process.env.ERC1155_URI_9 || "ipfs://QmYOUR_CID/9.json",
];

async function main() {
  const { soulboundVisitCard: svcAddr, gameCharacterCollection: gccAddr } =
    JSON.parse(fs.readFileSync("deployed.json"));

  const [owner] = await ethers.getSigners();
  console.log("Owner:", owner.address);
  console.log("Student wallet:", STUDENT_WALLET);

  const svc = await ethers.getContractAt("SoulboundVisitCardERC721", svcAddr);
  const gcc = await ethers.getContractAt(
    "GameCharacterCollectionERC1155",
    gccAddr
  );

  // ── 1. Set ERC-1155 URIs ─────────────────────────────────────────────────
  console.log("\n[1/4] Setting ERC-1155 metadata URIs (batch)...");
  const tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const setURIsTx = await gcc.setTokenURIBatch(tokenIds, ERC1155_URIS);
  await setURIsTx.wait();
  console.log("  tx:", setURIsTx.hash);

  // ── 2. Mint soulbound visit card (ERC-721) ───────────────────────────────
  console.log("\n[2/4] Minting soulbound visit card to student...");
  const mintSVCTx = await svc.mint(
    STUDENT_WALLET,
    "Daniil Tsitavets",       // studentName
    "STU-2024-001",           // studentID
    "Blockchain Development", // course
    2024,                     // year
    ERC721_METADATA_URI
  );
  await mintSVCTx.wait();
  console.log("  tx:", mintSVCTx.hash);

  const card = await svc.getVisitCard(0);
  console.log("  Visit card data:", {
    studentName: card.studentName,
    studentID: card.studentID,
    course: card.course,
    year: card.year.toString(),
  });

  // ── 3. Batch mint all 10 characters (ERC-1155) to owner ──────────────────
  console.log("\n[3/4] Batch minting 10 game characters to owner...");
  const amounts = new Array(10).fill(1);
  const mintBatchTx = await gcc.mintBatch(owner.address, tokenIds, amounts);
  await mintBatchTx.wait();
  console.log("  tx:", mintBatchTx.hash);

  for (const id of tokenIds) {
    const bal = await gcc.balanceOf(owner.address, id);
    const char = await gcc.getCharacter(id);
    console.log(`  Token #${id} (${char.characterName}): owner balance = ${bal}`);
  }

  // ── 4. Batch transfer 2 characters to student wallet ────────────────────
  console.log("\n[4/4] Batch transferring characters #0 and #1 to student...");
  const transferTx = await gcc.safeBatchTransferFrom(
    owner.address,
    STUDENT_WALLET,
    [0, 1],
    [1, 1],
    "0x"
  );
  await transferTx.wait();
  console.log("  tx:", transferTx.hash);

  const studentBal0 = await gcc.balanceOf(STUDENT_WALLET, 0);
  const studentBal1 = await gcc.balanceOf(STUDENT_WALLET, 1);
  console.log(`  Student balance: #0 = ${studentBal0}, #1 = ${studentBal1}`);

  // ── Verify soulbound: transfer attempt should revert ────────────────────
  console.log("\n[Bonus] Verifying soulbound — transfer should revert...");
  try {
    await svc
      .connect(owner)
      ["safeTransferFrom(address,address,uint256)"](
        STUDENT_WALLET,
        owner.address,
        0
      );
    console.log("  ERROR: transfer should have reverted!");
  } catch (e) {
    console.log("  Correctly reverted:", e.reason || e.message.split("(")[0].trim());
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});