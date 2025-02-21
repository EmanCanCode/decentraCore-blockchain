import { ethers } from 'hardhat';
import { ConstantProduct } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import { Mongo } from '../database/mongo';
import { toReadableAmount } from '../helpers';
import dotenv from 'dotenv';
dotenv.config();

export class CpammListener {
    private provider: WebSocketProvider;
    private cpamm: ConstantProduct | undefined;
    private deployer: Wallet;
    private mongo = new Mongo();

    constructor() {
        if (!process.env.PROVIDER_URL) {
            throw new Error("PROVIDER_URL is not set");
        } else if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER is not set");
        }
        // Initialize WebSocketProvider
        const providerUrl = process.env.PROVIDER_URL.replace(/^https?:\/\//, "");
        this.provider = new ethers.providers.WebSocketProvider(`ws://${providerUrl}`);
        // Initialize deployer
        this.deployer = new ethers.Wallet(
            process.env.DEPLOYER_PRIVATE_KEY, 
            this.provider
        );
    }

    async setCpamm(cpammAddress: string) {
        this.cpamm = await ethers.getContractAt("ConstantProduct", cpammAddress, this.deployer);
    }

    listen() {
        if (!this.cpamm) {
            console.error("CpammListener - CPAMM contract not set. Please set it first.");
            return;
        }   
        console.log("Listening for CPAMM swaps...");
        this.cpamm.on("Swapped", async (
            sender: string, 
            tokenReturned: string, 
            amountReceived: BigNumber, 
            amountReturned: BigNumber, 
            event
        ) => {
            // console.log({ amountReceived });            // calculate fees (0.3% of amountReceived)
            const fees = amountReceived.mul(3).div(1000);
            // calculate volume
            const volume = amountReceived.add(amountReturned);
            // update database
            await this.mongo.updateFinance(
                "CPAMM",
                toReadableAmount(volume),
                toReadableAmount(fees)
            ).catch(error => {
                console.error("Error updating finance document:", error);
            });
        });
    }

   
      
}