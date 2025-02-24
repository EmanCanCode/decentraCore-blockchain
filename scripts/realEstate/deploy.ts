import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import fs from "fs";
import path from "path";
import { Wallet } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// i assume the metadata manager is running (run npm run metadata)
export class Deploy {
    private deployer: Wallet;
    private provider_url: string;
    private provider: JsonRpcProvider;
    private seeders: Wallet[];

    constructor() {
        if (!process.env.PROVIDER_URL) {
            throw new Error("PROVIDER_URL is not set");
        } else if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER is not set");
        } else if (
            !process.env.SEEDER1_PRIVATE_KEY ||
            !process.env.SEEDER2_PRIVATE_KEY ||
            !process.env.SEEDER3_PRIVATE_KEY
        ) {
            throw new Error("Seeders is not set");
        } else if (!process.env.METADATA_URL) {
            throw new Error("METADATA_URL is not set");
        }

        this.provider_url = process.env.PROVIDER_URL;
        this.provider = new ethers.providers.JsonRpcProvider(this.provider_url);
        this.deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);
        this.seeders = [
            new ethers.Wallet(process.env.SEEDER1_PRIVATE_KEY, this.provider),
            new ethers.Wallet(process.env.SEEDER2_PRIVATE_KEY, this.provider),
            new ethers.Wallet(process.env.SEEDER3_PRIVATE_KEY, this.provider)
        ];
    }

    async main() {
        // deploy the real estate contract
        const RealEstate = await ethers.getContractFactory("RealEstate", this.deployer);
        const realEstate = await RealEstate.deploy();
        await realEstate.deployed();
        console.table({
            "RealEstate deployed to": realEstate.address
        });

        // mint all the tokens

        // Single-Family Homes (IDs 1, 2, 3)
        await realEstate.connect(this.deployer).mintBatch(
            this.seeders[0].address,            // seeder1 receives all single-family tokens
            [1, 2, 3],                          // token IDs
            [30, 30, 30],                       // amounts for each ID
            [
                `${process.env.METADATA_URL}/realEstate/singleFamily/type1.json`,
                `${process.env.METADATA_URL}/realEstate/singleFamily/type2.json`,
                `${process.env.METADATA_URL}/realEstate/singleFamily/type3.json`
            ],
            "0x"
        );
        console.log("Minted Single-Family Homes: IDs 1, 2, 3 to seeder1");

        // Multi-Family Homes (IDs 4, 5, 6)
        await realEstate.connect(this.deployer).mintBatch(
            this.seeders[1].address,            // seeder2 receives all multi-family tokens
            [4, 5, 6],                          // token IDs
            [50, 50, 50],                       // amounts for each ID
            [
                `${process.env.METADATA_URL}/realEstate/multiFamily/type1.json`,
                `${process.env.METADATA_URL}/realEstate/multiFamily/type2.json`,
                `${process.env.METADATA_URL}/realEstate/multiFamily/type3.json`
            ],
            "0x"
        );
        console.log("Minted Multi-Family Homes: IDs 4,5,6 to seeder2");

        // Luxury Homes (IDs 7, 8, 9)
        await realEstate.connect(this.deployer).mintBatch(
            this.seeders[2].address,            // seeder3 receives all luxury tokens
            [7, 8, 9],                          // token IDs
            [10, 10, 10],                       // amounts for each ID
            [
                `${process.env.METADATA_URL}/realEstate/luxury/type1.json`,
                `${process.env.METADATA_URL}/realEstate/luxury/type2.json`,
                `${process.env.METADATA_URL}/realEstate/luxury/type3.json`
            ],
            "0x"
        );
        console.log("Minted Luxury Homes: IDs 7,8,9 to seeder3");

        console.table({
            "Single-Family Home ID 1 URI": await realEstate.uri(1),
            "Single-Family Home ID 2 URI": await realEstate.uri(2),
            "Single-Family Home ID 3 URI": await realEstate.uri(3),
            "Multi-Family Home ID 4 URI": await realEstate.uri(4),
            "Multi-Family Home ID 5 URI": await realEstate.uri(5),
            "Multi-Family Home ID 6 URI": await realEstate.uri(6),
            "Luxury Home ID 7 URI": await realEstate.uri(7),
            "Luxury Home ID 8 URI": await realEstate.uri(8),
            "Luxury Home ID 9 URI": await realEstate.uri(9)
        });

        // deploy the real estate escrow factory contract
        const EscrowFactory = await ethers.getContractFactory("EscrowFactory", this.deployer);
        const escrowFactory = await EscrowFactory.deploy();
        await escrowFactory.deployed();
        console.table({
            "EscrowFactory deployed to": escrowFactory.address
        }); 

        // seeders have to give escrow factory contract approval to spend their tokens
        for (let seeder of this.seeders) {
            await realEstate.connect(seeder).setApprovalForAll(escrowFactory.address, true);
            console.log(`Seeder ${this.seeders.indexOf(seeder) + 1} approved EscrowFactory to spend their tokens`);
        }

        this.saveDeployedContracts(realEstate.address, escrowFactory.address);

        return {
            realEstate: realEstate.address,
            escrowFactory: escrowFactory.address
        };
    }

    private saveDeployedContracts(
        realEstateAddress: string,
        escrowFactoryAddress: string
    ) {
        const filePath = path.resolve(__dirname, "../../logs/realEstate/deploy.json");
        const deploymentLog = {
            contracts: {
                "realEstate": realEstateAddress,
                "escrowFactory": escrowFactoryAddress
            },
            timestamp: Date.now() // current time
        };
        fs.writeFileSync(filePath, JSON.stringify(deploymentLog, null, 2));
        console.log("Deployed contracts saved to:", filePath);
    }
}

const deploy = new Deploy();
deploy.main().then(() => {
    console.log("Deployment completed successfully");
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});