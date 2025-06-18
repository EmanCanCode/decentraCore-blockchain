import { ethers } from 'hardhat';
import { Provenance } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import mongo from '../database/mongo';
import { toReadableAmount } from '../helpers';
import { ProvenanceDocumentBase } from '../database/interfaces';
import { decodeProductId } from '../../helpers/provenance';
import * as deployLogs from '../../logs/supplyChain/deploy.json';
import dotenv from 'dotenv';
import { getResilientProvider } from '../utils/provider';
dotenv.config();

export class ProvenanceListener {
    private provenance: Provenance | undefined;
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
        // listen for CreatedRecord event
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
        // listen for UpdatedRecord event
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

    removeListeners() {
        if (!this.provenance) return;
        this.provenance.removeAllListeners("CreatedRecord");
        this.provenance.removeAllListeners("UpdatedRecord");
        console.log("Removed all listeners from Provenance contract.");
    }
}

// // initialize websocket provider
// const raw = process.env.PROVIDER_URL!;
// // turn http(s):// to ws(s)://
// const url = raw.replace(/^https?:\/\//, "ws://").replace(/\/$/, "");
// const provider = getResilientProvider(url);
// const provenanceListener = new ProvenanceListener(provider);

// (async () => {
//     try {
//         // initialize contract
//         await provenanceListener.setProvenance(deployLogs.contracts.provenance);
//         // start listening
//         console.log("Starting ProvenanceListener...");
//         provenanceListener.listenForCreatedRecord();
//         provenanceListener.listenForUpdatedRecord();
//         console.log("ProvenanceListener initialized successfully.");
//     } catch (error) {
//         console.error("Error initializing ProvenanceListener:", error);
//     }
// })();