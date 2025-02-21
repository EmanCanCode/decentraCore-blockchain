import { ethers } from 'hardhat';
import { Provenance } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import { Mongo } from '../database/mongo';
import { toReadableAmount } from '../helpers';
import dotenv from 'dotenv';
import { ProvenanceDocumentBase } from '../database/interfaces';
import { decodeProductId } from '../../helpers/provenance';
dotenv.config();

export class ProvenanceListener {
    private provider: WebSocketProvider;
    private provenance: Provenance | undefined;
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

    async setProvenance(provenanceAddress: string) {
        this.provenance = await ethers.getContractAt("Provenance", provenanceAddress, this.deployer);
    }

    // listen for createRecord
    listenForCreatedRecord() {
        if (!this.provenance) {
            console.error("ProvenanceListener - Provenance contract not set. Please set it first.");
            return;
        }
        console.log("Listening for Provenance CreatedRecord...");
        this.provenance.on('CreatedRecord', async (
            productName: string,
            variety: string,
            productType: string,
            timestamp: BigNumber,
            location: string,
            state: number,
            additionalInfo: string,
            recordCreator: string,
            value: BigNumber,
            nonce: BigNumber,
            productId: string,
            event
        ) => {
            // increment totalRecords by 1
            const document: ProvenanceDocumentBase = {
                'type': 'Provenance',
                totalRecords: 1,
                completedRecords: 0,
                totalValueProcessed:  toReadableAmount(value)

            };
            await this.mongo.updateSupplyChain(document).catch(error => {
                console.error("Error updating supplyChain document:", error);
            });

            console.log("Provenance document updated");
        });
    }


    // listen for UpdatedRecord event for 'Completed' status
    listenForUpdatedRecord() {
        if (!this.provenance) {
            console.error("ProvenanceListener - Provenance contract not set. Please set it first.");
            return;
        }
        console.log("Listening for Provenance UpdatedRecord...");
        this.provenance.on('UpdatedRecord', async (
            productId: string,
            timestamp: BigNumber,
            location: string,
            state: number,
            additionalInfo: string,
            recordUpdater: string
        ) => {
            // all we care about is a state of 2 (Completed)
            // enum State { Created, InTransit, Completed } // could have lots more like "Quality Check Passed", "Rejected", "In Storage", etc.
            if (state != 2) return;

            const document: ProvenanceDocumentBase = {
                'type': 'Provenance',
                totalRecords: 0,
                completedRecords: 1,
                totalValueProcessed: 0
            };

            await this.mongo.updateSupplyChain(document).catch(error => {
                console.error("Error updating supplyChain document:", error);
            });
            console.log("Provenance document updated");

            // release process value to the creator
            const { creator, nonce } = decodeProductId(productId);
            const automatedProcess = await ethers.getContractAt(
                "AutomatedProcess",
                await this.provenance!.automatedProcess(),
                this.deployer
            );
            await automatedProcess.connect(this.deployer).releaseProcessValue(
                nonce,
                creator
            ).catch(error => {
                console.error("Error releasing process value:", error);
            });
            console.log("Process value released");
        });
    }

}