import { task } from "hardhat/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Hardhat task to consolidate ETH into aggregator then redistribute
// - Uses PROVIDER_URL (e.g. http://hardhat:8545) from env instead of hre.ethers.provider
// - Verifies custom .env keys
// - Sweeps all default accounts into aggregator[0], leaving 0.01 ETH in each
// - Distributes 50 ETH to each seeder, 500 ETH to escrow, then splits remainder (minus 0.01) 2:3 owner:faucet

task("migrate-gas", "Consolidate and redistribute Hardhat ETH for DecentraCore")
  .setAction(async (_, hre) => {
    // 1. Network guard: run on 'localhost'
    if (hre.network.name !== "localhost") {
      console.error(`\n❌ migrate-gas must run on the Hardhat network, not '${hre.network.name}'.`);
      process.exit(1);
    }

    // 2. Validate .env keys
    const defaults: Record<string,string> = {
      DEPLOYER_PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      SEEDER1_PRIVATE_KEY:  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      SEEDER2_PRIVATE_KEY:  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
      SEEDER3_PRIVATE_KEY:  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      SEEDER4_PRIVATE_KEY:  "0x47e179ec197488593b187f80a00eb0d13f8733639f19c30a34926a",
      SEEDER5_PRIVATE_KEY:  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
      FAUCET_PRIVATE_KEY:   "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
      ESCROW_MANAGER_PRIVATE_KEY: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"
    };
    for (const key of Object.keys(defaults)) {
      const val = process.env[key];
      if (!val || val === defaults[key]) {
        console.error(`\n❌ Env var ${key} is missing or default. Regenerate with generate-keys.`);
        process.exit(1);
      }
    }

    // 3. RPC provider from env
    const rpcUrl = process.env.PROVIDER_URL;
    if (!rpcUrl) {
      console.error("\n❌ PROVIDER_URL not set in .env");
      process.exit(1);
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // 4. Fetch accounts from node
    const accounts = await provider.listAccounts();
    if (accounts.length < 2) {
      console.error("\n❌ Not enough accounts to migrate.");
      process.exit(1);
    }
    const aggregator = accounts[0];
    console.log(`\n▶️ Aggregator account: ${aggregator}`);

    // 5. Sweep others into aggregator, leaving gas buffer
    const leave = ethers.utils.parseEther("0.01");
    for (let i = 1; i < accounts.length; i++) {
      const from = accounts[i];
      const bal = await provider.getBalance(from);
      if (bal.lte(leave)) continue;
      const gasPrice = await provider.getGasPrice();
      const gasCost  = gasPrice.mul(21000);
      const amount   = bal.sub(gasCost).sub(leave);
      if (amount.lte(0)) continue;
      console.log(`  - Sweeping ${ethers.utils.formatEther(amount)} ETH from ${from}`);
      const tx = {
        to: aggregator,
        value: amount,
        gasPrice
      };
      await provider.getSigner(from).sendTransaction(tx);
    }

    // 6. Build signer for aggregator
    const signer0 = provider.getSigner(aggregator);

    // 7. Seeder addresses
    const seederAddrs = [
      process.env.SEEDER1_PRIVATE_KEY!, process.env.SEEDER2_PRIVATE_KEY!,
      process.env.SEEDER3_PRIVATE_KEY!, process.env.SEEDER4_PRIVATE_KEY!,
      process.env.SEEDER5_PRIVATE_KEY!
    ].map(pk => new ethers.Wallet(pk, provider).address);

    // 8. Distribute 50 ETH each to seeders
    const seederAmt = ethers.utils.parseEther("50");
    for (const addr of seederAddrs) {
      console.log(`→ Sending 50 ETH to seeder ${addr}`);
      await signer0.sendTransaction({ to: addr, value: seederAmt });
    }

    // 9. Send 500 ETH to escrow manager
    const escrowAddr = new ethers.Wallet(process.env.ESCROW_MANAGER_PRIVATE_KEY!, provider).address;
    console.log(`→ Sending 500 ETH to escrow manager ${escrowAddr}`);
    await signer0.sendTransaction({ to: escrowAddr, value: ethers.utils.parseEther("500") });

    // 10. Split (remaining - 0.01): 2/5 owner, 3/5 faucet
    const totalBal    = await provider.getBalance(aggregator);
    const reserve     = ethers.utils.parseEther("0.01");
    const distributable = totalBal.sub(reserve);
    const ownerShare  = distributable.mul(2).div(5);
    const faucetShare = distributable.sub(ownerShare);
    const ownerAddr   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider).address;
    const faucetAddr  = new ethers.Wallet(process.env.FAUCET_PRIVATE_KEY!, provider).address;
    console.log(`→ Distributing owner: ${ethers.utils.formatEther(ownerShare)}, faucet: ${ethers.utils.formatEther(faucetShare)}`);
    await signer0.sendTransaction({ to: ownerAddr,  value: ownerShare  });
    await signer0.sendTransaction({ to: faucetAddr, value: faucetShare });

    console.log("\n✅ migrate-gas complete: reserved 0.01 ETH for gas.");
  });

export default {};
