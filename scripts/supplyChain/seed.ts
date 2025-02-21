import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "ethers";
import dotenv from 'dotenv';
import { encodeProductId, productRecords, State } from "../../helpers/provenance";
dotenv.config();

export class Seed {
    private provider: JsonRpcProvider;
    private deployer: Wallet;
    private seeders: Wallet[];

    constructor() {
        if (!process.env.PROVIDER_URL) {
            throw new Error("PROVIDER_URL is not set");
        } else if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER_PRIVATE_KEY is not set");
        } else if (
            !process.env.SEEDER1_PRIVATE_KEY ||
            !process.env.SEEDER2_PRIVATE_KEY ||
            !process.env.SEEDER3_PRIVATE_KEY
        ) {
            throw new Error("SEEDER_PRIVATE_KEY is not set");
        }

        // initialize provider, deployer, and seeders
        this.provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL); 
        this.deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);
        this.seeders = [
            new ethers.Wallet(process.env.SEEDER1_PRIVATE_KEY, this.provider),
            new ethers.Wallet(process.env.SEEDER2_PRIVATE_KEY, this.provider),
            new ethers.Wallet(process.env.SEEDER3_PRIVATE_KEY, this.provider)
        ];
    }

    async main(
        inventoryManagementAddress: string,
        provenanceAddress: string
    ) {
        // create contract instances
        const inventoryManagement = await ethers.getContractAt(
            "InventoryManagement",
            inventoryManagementAddress,
            this.deployer
        );
        const provenance = await ethers.getContractAt(
            "Provenance",
            provenanceAddress,
            this.deployer
        );

        // seed inventory management contract
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // register 3 items with deployer
            await inventoryManagement.connect(this.deployer).registerItem(
                item.name,
                item.description,
                item.reorderThreshold
            );

            // update inventory for each item to the reorder threshold
            await inventoryManagement.connect(this.deployer).updateStock(
                i + 1, // item id
                item.reorderThreshold,
                0, // movement type - 0 is for inbound
                "Store A", // location
                "Initial stock" // note
            );
        }

        // seed provenance contract with three records
        const currentTimestamp = Math.floor(Date.now() / 1000)
        for (let i = 0; i < productRecords.length; i++) {
            const product = productRecords[i];
            await provenance.connect(
                this.seeders[i]
            ).createRecord(
                product.productName,
                product.variety,
                product.productType,
                product.timestamp,
                product.location,
                product.state, 
                product.additionalInfo,
                { value: ethers.utils.parseEther(`0.${i + 1}`) }
            );

            await this.wait(1.5);
            // leave first product in created state
            // if on second product, update to in transit
            if (i == 1) {
                await provenance.connect(
                    this.seeders[i]
                ).updateRecord(
                    ethers.utils.arrayify(encodeProductId(
                        this.seeders[i].address,
                        1
                    )), // product id
                    currentTimestamp, // timestamp
                    "Sent from warehouse", // location
                    State.InTransit, // state
                    "First update" // note
                );
                await this.wait(1.5);
            } else if (i == 2) { // if on third product, update to completed
                await provenance.connect(
                    this.seeders[i]
                ).updateRecord(
                    ethers.utils.arrayify(encodeProductId(
                        this.seeders[i].address, // creator
                        1 // nonce
                    )), // product id
                    currentTimestamp, // timestamp
                    "Received at store", // location
                    State.Completed, // state
                    "Final update" // note
                );
                await this.wait(1.5);
            }

            console.log(`Record ${i + 1} created and updated`);
        }
    }

    async wait(seconds: number) {
        return new Promise(resolve => {
            setTimeout(resolve, seconds * 1000);
        });
    }

}

const seed = new Seed();
seed.main(
    '0x0165878A594ca255338adfa4d48449f69242Eb8F', // inventoryManagementAddress
    '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853' // provenanceAddress
).then(() => {
    console.log("Seed complete");
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});


export const items = [
    {
        name: "Precision Bearings",
        description: "High-grade bearings for industrial machinery",
        reorderThreshold: 20
    },
    {
        name: "Semiconductor Wafers",
        description: "Silicon wafers for chip fabrication",
        reorderThreshold: 35
    },
    {
        name: "Polypropylene Pellets",
        description: "Versatile plastic pellets for molding applications",
        reorderThreshold: 30
    }
];