import { Wallet, ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { ConstantProduct__factory, FungibleToken__factory } from "../typechain-types";
import * as deployLogs from "../logs/finance/deploy.json";
import dotenv from "dotenv";
dotenv.config();

const provider = new JsonRpcProvider(process.env.PROVIDER_URL!);
const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

(async () => {
    const cpamm = ConstantProduct__factory.connect(
        deployLogs.contracts.CPAMM,
        wallet
    );
    const tokenContract = FungibleToken__factory.connect(
        deployLogs.contracts["Eman Token 1"],
        wallet
    );
    
    const tokens = ethers.utils.parseEther("1000"); 
    // have deployer approve the CPAMM to spend 1000 tokens
    let tx = await tokenContract.approve(
        cpamm.address,
        tokens
    );
    await tx.wait();
    console.log(`Approved CPAMM to spend ${tokens.toString()} tokens`);
    const balanceBefore = await tokenContract.balanceOf(wallet.address);
    // call swap on the CPAMM
    tx = await cpamm.swap(
        deployLogs.contracts["Eman Token 1"],
        tokens
    );
    const receipt = await tx.wait();
    console.log(`Swapped ${tokens.toString()} tokens on CPAMM`);
    const balanceAfter = await tokenContract.balanceOf(wallet.address);

    console.table({
        "Balance Before": ethers.utils.formatEther(balanceBefore),
        "Balance After":  ethers.utils.formatEther(balanceAfter),
    });
    // console.log('Receipt:', receipt);
})();