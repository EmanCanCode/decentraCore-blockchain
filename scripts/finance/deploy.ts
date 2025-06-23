import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import fs from "fs";
import path from "path";
import { Wallet } from "ethers";
import dotenv from "dotenv";
import { ContractsToDeploy, DeployedContracts, DeploymentLog } from "./interfaces";
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

    async main(
        contractsToDeploy: ContractsToDeploy
    ) {
        // ensure that at least one contract is to be deployed
        if (
            !contractsToDeploy.cpamm && 
            !contractsToDeploy.csamm && 
            !contractsToDeploy.obmm
        ) {
            throw new Error("No contracts to deploy");
        }

        // track deployed contracts
        let deployedContracts: DeployedContracts = {};

        // deploy token 1 
        const Token = await ethers.getContractFactory("FungibleToken", this.deployer);
        const token1 = await Token.deploy("Eman Token 1", "EMAN1", ethers.utils.parseEther('1000000000000000')); // 1 quadrillion tokens
        await token1.deployed();
        deployedContracts["Eman Token 1"] = token1.address;
        // make  console.log("Eman Token 1 deployed to:", token1.address); in a table
        
        
        // deploy token2
        const token2 = await Token.deploy("Eman Token 2", "EMAN2", ethers.utils.parseEther('1000000000000000')); // 1 quadrillion tokens
        await token2.deployed();
        deployedContracts["Eman Token 2"] = token2.address;
        console.table({
            "Eman Token 1": token1.address,
            "Eman Token 2": token2.address
        })

        if (contractsToDeploy.cpamm) {
            // deploy cpamm
            const CPAMM = await ethers.getContractFactory("ConstantProduct", this.deployer);
            const cpamm = await CPAMM.deploy(
                token1.address,
                token2.address
            );
            await cpamm.deployed();
            deployedContracts["CPAMM"] = cpamm.address;
            console.table({
                "CPAMM": cpamm.address
            });
        }

        if (contractsToDeploy.csamm) {
            // deploy csamm
            const CSAMM = await ethers.getContractFactory("ConstantSum", this.deployer);
            const csamm = await CSAMM.deploy(
                token1.address,
                token2.address
            );
            await csamm.deployed();
            deployedContracts["CSAMM"] = csamm.address;
            console.table({
                "CSAMM": csamm.address
            });
        }

        if (contractsToDeploy.obmm) {
            // deploy obmm
            const OBMM = await ethers.getContractFactory("OrderBook", this.deployer);
            const obmm = await OBMM.deploy(
                this.deployer.address, // fee account
                1, // fee rate (1%)
            );
            await obmm.deployed();
            deployedContracts["OBMM"] = obmm.address;
            console.table({
                "OBMM": obmm.address
            });
        }

        // save deployed contracts
        this.saveDeployedContracts(deployedContracts);

        return deployedContracts;
    }

    // need to put the deployedContracts in ../../logs/finance/deploy.json
    private saveDeployedContracts(deployedContracts: DeployedContracts) {
        const filePath = path.resolve(process.cwd(), "logs/finance/deploy.json");
        const deploymentLog: DeploymentLog = {
            contracts: deployedContracts,
            timestamp: Date.now() // current time
        };
        fs.writeFileSync(filePath, JSON.stringify(deploymentLog, null, 2));
        console.log("Deployed contracts saved to:", filePath);
    }
}

const deploy = new Deploy();
deploy.main({
    cpamm: true,  // set true if you want to deploy the Constant Product Automated Market Maker Contract (Uniswap)
    csamm: true, // set true if you want to deploy the Constant Sum Automated Market Maker Contract (Balancer)
    obmm: true // set true if you want to deploy the Order Book Market Maker Contract (Delta)
}).then(() => {
    console.log("Deployment complete");
    process.exit(0);
}).catch((error) => {
    console.error(error);
    process.exit(1);
});


