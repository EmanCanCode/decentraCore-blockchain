import { task } from "hardhat/config";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

// This Hardhat task interactively generates a .env file for DecentraCore.
// Default values use Hardhat demo private keys and local endpoints for a quick local demo.
// You will be prompted to confirm each value and then to proceed before writing the file.

task("init-env", "Interactive .env generator for DecentraCore")
  .setAction(async (_, hre) => {
    console.log("\n🔧 DecentraCore .env Initializer");
    console.log("Default values below are Hardhat’s demo keys and local URLs for development.");
    console.log("You can accept them by pressing Enter, or type your own.\n");

    const defaultEnv = {
      PROVIDER_URL: "http://127.0.0.1:8545/",
      DEPLOYER_PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      SEEDER1_PRIVATE_KEY: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      SEEDER2_PRIVATE_KEY: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
      SEEDER3_PRIVATE_KEY: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      SEEDER4_PRIVATE_KEY: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
      SEEDER5_PRIVATE_KEY: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
      METADATA_PORT: "3001",
      METADATA_URL: "http://127.0.0.1:3001",
      FAUCET_PRIVATE_KEY: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
      ESCROW_MANAGER_PRIVATE_KEY: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
      BACKEND_API_KEY: "1",
      MONGO_URI: "",
      GMAIL: "",
      GMAIL_APP_PASSWORD: ""
    };

    // Build prompt questions with validation for URLs and hex keys
    const questions = Object.entries(defaultEnv).map(([key, defaultValue]) => {
      const isPrivateKey = key.includes("PRIVATE_KEY");
      const isOptional = ["MONGO_URI", "GMAIL", "GMAIL_APP_PASSWORD"].includes(key);
      return {
        type: "input",
        name: key,
        message: `${key}${isOptional ? ' (optional)' : ''} [default: ${defaultValue}]:`,
        default: defaultValue,
        validate: (input: string) => {
          if (isPrivateKey && input) {
            if (!ethers.utils.isHexString(input) || input.length !== 66) {
              return 'Please enter a valid 0x... private key (66 hex chars)';
            }
          }
          if ((key === 'PROVIDER_URL' || key === 'METADATA_URL') && input) {
            try { new URL(input); } catch {
              return 'Please enter a valid URL';
            }
          }
          return true;
        }
      };
    });

    // Prompt for each variable
    const answers = await inquirer.prompt(questions as any);

    console.log("\nYou entered:");
    Object.entries(answers).forEach(([k, v]) => console.log(`${k}=${v}`));

    // Final confirmation
    const { proceed } = await inquirer.prompt([{ 
      type: 'confirm', 
      name: 'proceed',
      message: 'Proceed with these values and create .env?',
      default: true
    }]);

    if (!proceed) {
      console.log('Aborted .env creation.');
      process.exit(0);
    }

    // Write .env to project root
    const envPath = path.resolve(process.cwd(), ".env");
    const envLines = Object.entries(answers).map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(envPath, envLines.join("\n"), { encoding: "utf8" });
    console.log(`\n✅  .env file successfully created at ${envPath}`);
  });

export default {};
