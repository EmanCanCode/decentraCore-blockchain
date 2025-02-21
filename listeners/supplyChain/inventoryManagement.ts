import { ethers } from 'hardhat';
import { InventoryManagement } from '../../typechain-types';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import { Mongo } from '../database/mongo';
import { toReadableAmount } from '../helpers';
import dotenv from 'dotenv';
import { InventoryManagementDocumentBase } from '../database/interfaces';
dotenv.config();


export class InventoryManagementListener {
    private provider: WebSocketProvider;
    private inventoryManagement: InventoryManagement | undefined;
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

    async setInventoryManagement(inventoryManagementAddress: string) {
        this.inventoryManagement = await ethers.getContractAt("InventoryManagement", inventoryManagementAddress, this.deployer);
    }

    listenForStockUpdated() {
        if (!this.inventoryManagement) {
            console.error("InventoryManagementListener - InventoryManagement contract not set. Please set it first.");
            return;
        }
        console.log("Listening for InventoryManagement StockUpdated...");
        this.inventoryManagement.on('StockUpdated', async (
            itemId: BigNumber, 
            newQuantity: BigNumber, 
            movementType: number, // enums are number in ethers.js
            timestamp: BigNumber, 
            note: string,
        ) => {
            // we need to track three main things:
            // 1. totalMovements
            // 2. totalOutbound
            // 3. totalReorders
            
            // since this is being called, no matter what we are incrementing totalMovements
            // if movementType is 1, we are incrementing totalOutbound
            let isOutbound = false;
            if (movementType === 1) isOutbound = true;

            // check for item quantity, if it is less than reorderThreshold, we should updateStock using automated process contract and increment totalReorders
            let reorder = false;
            const item = await this.inventoryManagement?.items(itemId)!;
            if (item.quantity.lt(item.reorderThreshold)) {
                // updateStock using automated process contract 
                const automatedProcess = await ethers.getContractAt(
                    "AutomatedProcess", 
                    await this.inventoryManagement!.automatedProcess(),
                    this.deployer
                );
                await automatedProcess.connect(this.deployer).updateStock(
                    itemId,
                    item.reorderThreshold, // quantity 
                    0, // inbound
                    'Warehouse',
                    'Reorder'
                );
                
                // set reorder to true
                reorder = true;
            }

            // update supplyChain document
            const document: InventoryManagementDocumentBase = {
                type: 'InventoryManagement',
                totalMovements: 1,
                totalOutbound: isOutbound ? 1 : 0,
                totalReorders: reorder ? 1 : 0
            };
            await this.mongo.updateSupplyChain(document).catch(error => {
                console.error("Error updating supplyChain document:", error);
            });
            console.log("InventoryManagement document updated");
            
        });
    }

    listenForItemTransferred() {
        if (!this.inventoryManagement) {
            console.error("InventoryManagementListener - InventoryManagement contract not set. Please set it first.");
            return;
        }
        console.log("Listening for InventoryManagement ItemTransferred...");
        this.inventoryManagement.on('ItemTransferred', async () => {
            // we dont care about anything here, just increment totalMovements
            const document: InventoryManagementDocumentBase = {
                type: 'InventoryManagement',
                totalMovements: 1,
                totalOutbound: 0,
                totalReorders: 0
            };

            await this.mongo.updateSupplyChain(document).catch(error => {
                console.error("Error updating supplyChain document:", error);
            });
            console.log("InventoryManagement document updated");
        });
    }
}