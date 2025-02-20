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
            }

            console.log(`Record ${i + 1} created and updated`);
        }
    }

}

const seed = new Seed();
seed.main(
    '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // inventoryManagementAddress
    '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' // provenanceAddress
).then(() => {
    console.log("Seed complete");
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});


export const items = [
    {
        name: "Apple",
        description: "Granny Smith",
        reorderThreshold: 20
    },
    {
        name: "Banana",
        description: "Cavendish",
        reorderThreshold: 35
    },
    {
        name: "Cherry",
        description: "Bing",
        reorderThreshold: 30
    }
];