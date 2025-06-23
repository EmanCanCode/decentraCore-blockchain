import { task } from "hardhat/config";
import fs from "fs";
import path from "path";

// Hardhat task to log out the backend config JSON for the API
// It reads deploy logs, assembles the config object, and prints it to the console (no file writes).

task("update-backend-config", "Log <backend> src/services/config.json contents based on latest deployments")
  .setAction(async (_, hre) => {
    // 1. Define paths to deployment logs
    const root = process.cwd();
    const financeLogPath     = path.join(root, "logs/finance/deploy.json");
    const supplyChainLogPath = path.join(root, "logs/supplyChain/deploy.json");
    const realEstateLogPath  = path.join(root, "logs/realEstate/deploy.json");

    // 2. Verify that each log file exists
    [financeLogPath, supplyChainLogPath, realEstateLogPath].forEach(p => {
      if (!fs.existsSync(p)) {
        console.error(`\n❌ Missing deploy log: ${p}`);
        process.exit(1);
      }
    });

    // 3. Parse log data
    const financeLog     = JSON.parse(fs.readFileSync(financeLogPath, 'utf8'));
    const supplyChainLog = JSON.parse(fs.readFileSync(supplyChainLogPath, 'utf8'));
    const realEstateLog  = JSON.parse(fs.readFileSync(realEstateLogPath, 'utf8'));

    // 4. Assemble the backend config object
    const backendConfig = {
      finance: financeLog.contracts,
      supplyChain: {
        provenanceAddress: supplyChainLog.contracts.provenance,
        inventoryManagementAddress: supplyChainLog.contracts.inventoryManagement
      },
      realEstate: {
        escrowFactoryAddress: realEstateLog.contracts.escrowFactory,
        realEstateAddress: realEstateLog.contracts.realEstate,
        finance: realEstateLog.contracts.finance
      }
    };

    // 5. Log the final JSON to console for manual copying
    console.log("\n   ");
    console.log("\n--- Backend config snippet: ---\n");
    console.log(JSON.stringify(backendConfig, null, 2));
    console.log("\n✅ update-backend-config complete. Copy and paste into the backend module's src/services/config.json as needed.");
  });

export default {};
