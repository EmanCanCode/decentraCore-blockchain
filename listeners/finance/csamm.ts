import { ethers } from 'hardhat';
import { ConstantSum } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import mongo from '../database/mongo';
import { toReadableAmount } from '../helpers';
import dotenv from 'dotenv';
dotenv.config();

export class CsammListener {
    private csamm: ConstantSum | undefined;
    private deployer: Wallet;
    private mongo = mongo;

    constructor(private provider: WebSocketProvider) {
        if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER is not set");
        }
        // Initialize deployer
        this.deployer = new ethers.Wallet(
            process.env.DEPLOYER_PRIVATE_KEY, 
            this.provider
        );
    }

    async setCsamm(csammAddress: string) {
        this.csamm = await ethers.getContractAt("ConstantSum", csammAddress, this.deployer);
    }

    listen() {
        if (!this.csamm) {
            console.error("CsammListener - CSAMM contract not set. Please set it first.");
            return;
        }
        console.log("Listening for CSAMM swaps...");
        this.csamm.on("Swapped", async (
            from: string,
            to: string,
            amountReceived: BigNumber,
            amountReturned: BigNumber,
            event
        ) => {
            const fees = amountReceived.mul(3).div(1000); // calculate fees (0.3% of amountReceived)
            const volume = amountReceived.add(amountReturned); // calculate volume
            await this.mongo.updateFinance(
                "CSAMM",
                toReadableAmount(volume),
                toReadableAmount(fees)
            ).catch(error => {
                console.error("Error updating finance document:", error);
            });
        });
    }

    removeListeners() {
        if (!this.csamm) return;
        this.csamm.removeAllListeners("Swapped");
        console.log("Removed all listeners from CSAMM contract.");
    }
}