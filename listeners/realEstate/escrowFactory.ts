import { ethers } from 'hardhat';
import { EscrowFactory } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import mongo from '../database/mongo';
import { RealEstateDocument } from '../database/interfaces';
import * as deployLogs from '../../logs/realEstate/deploy.json';
import dotenv from 'dotenv';
dotenv.config();


export class EscrowFactoryListener {
    private provider: WebSocketProvider;
    private escrowFactory: EscrowFactory | undefined;
    private deployer: Wallet;
    private escrowManager: Wallet; // lender, appraiser, inspector
    private mongo = mongo;

    constructor() {
        if (!process.env.PROVIDER_URL) {
            throw new Error("PROVIDER_URL is not set");
        } else if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER is not set");
        } else if (!process.env.ESCROW_MANAGER_PRIVATE_KEY) {
            throw new Error("ESCROW_MANAGER_PRIVATE_KEY is not set");
        }
        // Initialize WebSocketProvider
        const providerUrl = process.env.PROVIDER_URL.replace(/^https?:\/\//, "");
        this.provider = new ethers.providers.WebSocketProvider(`ws://${providerUrl}`);
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
}