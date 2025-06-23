import { task } from "hardhat/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Hardhat task to generate random private keys for DecentraCore .env
// It ensures all key placeholders are declared in .env before regenerating them.

task("gen-keys", "Generate random private keys for .env variables")
  .setAction(async (_, hre) => {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
      console.error("\n❌ .env file not found. Please run 'npx hardhat init-env' first to generate your .env placeholders.\n");
      process.exit(1);
    }

    const content = fs.readFileSync(envPath, { encoding: "utf8" });
    const lines = content.split(/\r?\n/);

    // Variables to regeneration
    const keyVars = [
      "DEPLOYER_PRIVATE_KEY",
      "SEEDER1_PRIVATE_KEY",
      "SEEDER2_PRIVATE_KEY",
      "SEEDER3_PRIVATE_KEY",
      "SEEDER4_PRIVATE_KEY",
      "SEEDER5_PRIVATE_KEY",
      "FAUCET_PRIVATE_KEY",
      "ESCROW_MANAGER_PRIVATE_KEY"
    ];

    // Check declarations: ensure each var is present and not commented out
    const missing = keyVars.filter(key => {
      return !lines.some(l => {
        const trimmed = l.trim();
        return trimmed.startsWith(`${key}=`);
      });
    });
    if (missing.length) {
      console.error(`\n❌ The following variables are not declared in .env: ${missing.join(", ")}`);
      console.error("Please ensure each key is declared (e.g., KEY=) before generating new values.\n");
      process.exit(1);
    }

    console.log("\n🔑 Regenerating keys for:", keyVars.join(", "));  

    // Generate new keys
    const newKeys: Record<string, string> = {};
    keyVars.forEach(varName => {
      const wallet = ethers.Wallet.createRandom();
      newKeys[varName] = wallet.privateKey;
      console.log(`${varName}: ${wallet.privateKey}`);
    });

    // Replace lines
    const updatedLines = lines.map(line => {
      const [key] = line.split('=');
      if (keyVars.includes(key.trim())) {
        return `${key}=${newKeys[key.trim()]}`;
      }
      return line;
    });

    // Write back
    fs.writeFileSync(envPath, updatedLines.join("\n") + "\n", { encoding: "utf8" });
    console.log(`\n✅ .env updated with new random keys at ${envPath}`);
  });

export default {};
