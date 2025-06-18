import { ethers } from 'hardhat';
import { EscrowFactory } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import mongo from '../database/mongo';
import { RealEstateDocument } from '../database/interfaces';
import { getResilientProvider } from '../utils/provider'; // adjust path
import * as deployLogs from '../../logs/realEstate/deploy.json';
import dotenv from 'dotenv';
dotenv.config();


export class EscrowFactoryListener {
    private escrowFactory: EscrowFactory | undefined;
    private deployer: Wallet;
    private escrowManager: Wallet; // lender, appraiser, inspector
    private mongo = mongo;

    constructor(private provider: WebSocketProvider) {
        if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER is not set");
        } else if (!process.env.ESCROW_MANAGER_PRIVATE_KEY) {
            throw new Error("ESCROW_MANAGER_PRIVATE_KEY is not set");
        }
        // Initialize deployer
        this.deployer = new ethers.Wallet(
            process.env.DEPLOYER_PRIVATE_KEY, 
            this.provider
        );
        // Initialize escrowManager
        this.escrowManager = new ethers.Wallet(
            process.env.ESCROW_MANAGER_PRIVATE_KEY, 
            this.provider
        );
    }

    async setEscrowFactory(escrowFactoryAddress: string) {
        this.escrowFactory = await ethers.getContractAt("EscrowFactory", escrowFactoryAddress, this.deployer);
    }

    listenForEscrowCreated() {
        if (!this.escrowFactory) {
            console.error("EscrowFactoryListener - EscrowFactory contract not set. Please set it first.");
            return;
        }
        console.log("Listening for EscrowFactory events...");
        this.escrowFactory.on("EscrowCreated", async (
            escrow: string, // address of the escrow
            escrowId: string, // id of the escrow to get the details, need to store
            buyer: string, // address of the buyer, need to store
            seller: string, // address of the seller
            nonce: BigNumber, // nonce of the escrow
            event
        ) => {
            console.log("Escrow created. Attempting to save buyer and escrowId to MongoDB...");
            const data: RealEstateDocument = { buyer, escrowId };
            await this.mongo.updateRealEstate(data).catch(err => {
                console.error("EscrowFactoryListener - Error updating RealEstate document: ", err);
            });
            // lender (escrow manager) needs to add the finance contract address to escrow contract
            // 1. create escrow contract instance
            const escrowContract = await ethers.getContractAt("Escrow", escrow, this.escrowManager); // escrow manager is the lender
            // 2. add finance contract address to escrow contract
            await escrowContract.connect(this.escrowManager).setFinanceContract(deployLogs.contracts.finance);
            console.log("EscrowFactoryListener - EscrowCreated event detected. Added finance contract address to escrow contract.");
        });
    }

    removeListeners() {
        if (!this.escrowFactory) return;
        this.escrowFactory.removeAllListeners("EscrowCreated");
        console.log("Removed all listeners from EscrowFactory contract.");
    }
}

// const escrowFactoryListener = new EscrowFactoryListener(
//     getResilientProvider(
//         process.env.PROVIDER_URL!.replace(/^https?:\/\//, "ws://").replace(/\/$/, "")
//     )  // replace http(s):// with ws(s)://
// );
// escrowFactoryListener.setEscrowFactory(deployLogs['contracts'].escrowFactory).then(() => {
//     console.log("Successfully set escrow factory address.");
//     // Start listening for events
//     console.log("Initializing listener...");
//     escrowFactoryListener.listenForEscrowCreated(); // listen for escrow created event
//     console.log("Listener successfully initialized!");
// }).catch(err => {
//     console.error("Error setting escrow factory address: ", err);
//     // process.exit(1);
// }); // set escrow factory address