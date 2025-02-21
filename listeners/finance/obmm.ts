import { ethers } from 'hardhat';
import { OrderBook } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import { Mongo } from '../database/mongo';
import { toReadableAmount } from '../helpers';
import dotenv from 'dotenv';
dotenv.config();

export class ObmmListener {
    private provider: WebSocketProvider;
    private obmm: OrderBook | undefined;
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

    async setObmm(obmmAddress: string) {
        this.obmm = await ethers.getContractAt("OrderBook", obmmAddress, this.deployer);
    }

    listenForCancelledOrders() {
        if (!this.obmm) {
            console.error("ObmmListener - OBMM contract not set. Please set it first.");
            return;
        }
        console.log("Listening for OBMM cancelled orders...");
        this.obmm.on("Cancel", async () => {
            await this.mongo.updateFinance(
                "OBMM",
                0,
                0,
                true
            ).catch(error => {
                console.error("Error updating finance document:", error);
            });
            
        });
    }

    listenForFilledOrders() {
        if (!this.obmm) {
            console.error("ObmmListener - OBMM contract not set. Please set it first.");
            return;
        }
        console.log("Listening for OBMM filled orders...");
        this.obmm.on("Trade", async (
            id: BigNumber,
            user: string,
            tokenGet: string,
            amountGet: BigNumber,
            tokenGive: string,
            amountGive: BigNumber,
            timestamp: BigNumber,
            event
        ) => {
            // get the fees
            const fees = amountGet.mul(await this.obmm!.feePercent()).div(100); // calculate fees
            const volume = amountGet.add(amountGive); // calculate volume

            // udpate finance document
            await this.mongo.updateFinance(
                "OBMM",
                toReadableAmount(volume),
                toReadableAmount(fees), // im sure theres a less headachy way to do this. been coding for a while now so i am just going to do this
                false,
                true
            ).catch(error => {
                console.error("Error updating finance document:", error);
            });
        });
    }
}