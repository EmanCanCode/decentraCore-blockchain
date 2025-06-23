import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import fs from "fs";
import path from "path";
import { Wallet } from "ethers";
import dotenv from "dotenv";
dotenv.config();

export class Deploy {
    private deployer: Wallet;
    private provider_url: string;
    private provider: JsonRpcProvider;

    constructor() {
        if (!process.env.PROVIDER_URL) {
            throw new Error("PROVIDER_URL is not set");
        } else if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER is not set");
        }
        this.provider_url = process.env.PROVIDER_URL;
        this.provider = new ethers.providers.JsonRpcProvider(this.provider_url);
        this.deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);
    }

    async main() {
        // deploy automated process
        const AutomatedProcess = await ethers.getContractFactory("AutomatedProcess", this.deployer);
        const automatedProcess = await AutomatedProcess.deploy();
        await automatedProcess.deployed();

        // deploy inventory management contract
        const InventoryManagement = await ethers.getContractFactory("InventoryManagement", this.deployer);
        const inventoryManagement = await InventoryManagement.deploy();
        await inventoryManagement.deployed();

        // deploy provenance contract
        const Provenance = await ethers.getContractFactory("Provenance", this.deployer);
        const provenance = await Provenance.deploy();
        await provenance.deployed();
        
        console.table({
            "AutomatedProcess deployed to": automatedProcess.address,
            "InventoryManagement deployed to": inventoryManagement.address,
            "Provenance deployed to": provenance.address
        });

        // set automated process on inventory management and provenance contracts
        await inventoryManagement.connect(this.deployer).setAutomatedProcess(automatedProcess.address);
        await provenance.connect(this.deployer).setAutomatedProcess(automatedProcess.address);
        console.table({
            "AutomatedProcess set on InventoryManagement": '✅',
            "AutomatedProcess set on Provenance": '✅'
        });

        // set inventory management and provenance contracts on automated process
        await automatedProcess.connect(this.deployer).setInventoryManagement(inventoryManagement.address);
        await automatedProcess.connect(this.deployer).setProvenance(provenance.address);
        console.table({
            "InventoryManagement set on AutomatedProcess": '✅',
            "Provenance set on AutomatedProcess": '✅'
        });

        // save deployed contracts
        this.saveDeployedContracts(
            automatedProcess.address,
            inventoryManagement.address,
            provenance.address
        );

        return {
            automatedProcess: automatedProcess.address,
            inventoryManagement: inventoryManagement.address,
            provenance: provenance.address
        }
    }

    // need to put the deployedContracts in ../../logs/finance/deploy.json
    private saveDeployedContracts(
        automatedProcessAddress: string,
        inventoryManagementAddress: string,
        provenanceAddress: string
    ) {
        const filePath = path.resolve(process.cwd(), "logs/supplyChain/deploy.json");
        const deploymentLog = {
            contracts: {
                automatedProcess: automatedProcessAddress,
                inventoryManagement: inventoryManagementAddress,
                provenance: provenanceAddress
            },
            timestamp: Date.now() // current time
        };
        fs.writeFileSync(filePath, JSON.stringify(deploymentLog, null, 2));
        console.log("Deployed contracts saved to:", filePath);
    }
}

const deploy = new Deploy();
deploy.main().then(() => {
    console.log("Deployment complete");
    process.exit(0);    
}).catch(error => {
    console.error(error);
    process.exit(1);
});