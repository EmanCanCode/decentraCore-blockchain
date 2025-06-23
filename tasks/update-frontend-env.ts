import { task } from "hardhat/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Hardhat task to generate an Angular environment.ts snippet
// It reads contract addresses from deploy logs, derives seeder/other addresses from .env keys,
// then outputs the updated environment.ts content for the frontend.

task("update-frontend-env", "Generate Angular environment.ts with up-to-date addresses")
  .setAction(async (_, hre) => {
    // 1. Locate deploy log files (relative to project root)
    const root = process.cwd();
    const financeLogPath = path.join(root, "logs/finance/deploy.json");
    const realEstateLogPath = path.join(root, "logs/realEstate/deploy.json");
    const supplyChainLogPath = path.join(root, "logs/supplyChain/deploy.json");

    // 2. Load JSON
    if (
      !fs.existsSync(financeLogPath) ||
      !fs.existsSync(realEstateLogPath) ||
      !fs.existsSync(supplyChainLogPath)
    ) {
      console.error("\n❌ One or more deploy log files are missing. Expecting:");
      console.error(`  - ${financeLogPath}`);
      console.error(`  - ${realEstateLogPath}`);
      console.error(`  - ${supplyChainLogPath}`);
      process.exit(1);
    }
    const financeLog = JSON.parse(fs.readFileSync(financeLogPath, 'utf8'));
    const realEstateLog = JSON.parse(fs.readFileSync(realEstateLogPath, 'utf8'));
    const supplyChainLog = JSON.parse(fs.readFileSync(supplyChainLogPath, 'utf8'));

    // 3. Derive seeder addresses from .env private keys
    const seederKeys = [
      process.env.SEEDER1_PRIVATE_KEY!,
      process.env.SEEDER2_PRIVATE_KEY!,
      process.env.SEEDER3_PRIVATE_KEY!,
      process.env.SEEDER4_PRIVATE_KEY!,
      process.env.SEEDER5_PRIVATE_KEY!
    ];
    const seederAddrs = seederKeys.map((pk, i) => {
      if (!pk) {
        console.error(`Missing SEEDER${i + 1}_PRIVATE_KEY in .env`);
        process.exit(1);
      }
      return new ethers.Wallet(pk).address;
    });

    // 4. Get Escrow Manager address
    const escrowMgr = new ethers.Wallet(process.env.ESCROW_MANAGER_PRIVATE_KEY!).address;

    // 5. Rename 'finance' → 'mortgageFinance' in realEstate contracts
    const rawRE = realEstateLog.contracts;
    const realEstateContracts = {
      ...rawRE,
      mortgageFinance: rawRE.finance
    };
    delete realEstateContracts.finance;

    // 6. Build environment.ts content
    const envTs = `export const environment = {
  url: 'http://localhost:4200',
  production: false,
  financeContracts: ${JSON.stringify(financeLog.contracts, null, 2)},
  supplyChainContract: ${JSON.stringify(supplyChainLog.contracts, null, 2)},
  realEstateContracts: ${JSON.stringify(realEstateContracts, null, 2)},
  seederAddresses: {
    seeder1: '${seederAddrs[0]}',
    seeder2: '${seederAddrs[1]}',
    seeder3: '${seederAddrs[2]}',
    seeder4: '${seederAddrs[3]}',
    seeder5: '${seederAddrs[4]}'
  },
  web3: {
    rpcUrl: 'http://127.0.0.1:8545/',
    chainIdHex: '0x7A69',
    chainName: 'Hardhat Playground'
  },
  api: 'http://localhost:3000',
  escrowManager: '${escrowMgr}'
};
`;

    // 7. Output to console
    console.log("\n--- Copy the following snippet into your Angular environment.ts ---\n");
    console.log(envTs);
    console.log("\n🎉 update-frontend-env complete. Paste into your src/environments/environment.ts");
  });

export default {};
