import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import dotenv from 'dotenv';
import { BigNumber, Wallet } from "ethers";
import { DeployedContracts } from "./interfaces";
dotenv.config();


export class Seed {
    private provider: JsonRpcProvider;
    private deployer: Wallet;
    private seeders: Wallet[]; // seeders are wallets that will seed the market makers

    constructor() {
        if (!process.env.PROVIDER_URL) {
            throw new Error("PROVIDER_URL is not set");
        } else if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER_PRIVATE_KEY is not set");
        }
        this.provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
        this.deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);
        // ensure seeders are set
        if (
            !process.env.SEEDER1_PRIVATE_KEY ||
            !process.env.SEEDER2_PRIVATE_KEY ||
            !process.env.SEEDER3_PRIVATE_KEY ||
            !process.env.SEEDER4_PRIVATE_KEY ||
            !process.env.SEEDER5_PRIVATE_KEY
        ) {
            throw new Error("SEEDER_PRIVATE_KEY is not set");
        }
        // add seeders
        this.seeders = [
            new ethers.Wallet(
                process.env.SEEDER1_PRIVATE_KEY,
                this.provider
            ),
            new ethers.Wallet(
                process.env.SEEDER2_PRIVATE_KEY,
                this.provider
            ),
            new ethers.Wallet(
                process.env.SEEDER3_PRIVATE_KEY,
                this.provider
            ),
            new ethers.Wallet(
                process.env.SEEDER4_PRIVATE_KEY,
                this.provider
            ),
            new ethers.Wallet(
                process.env.SEEDER5_PRIVATE_KEY,
                this.provider
            )
        ];
    }


    async main(
        contracts: DeployedContracts
    ) {
        const keys = Object.keys(contracts);
        // make sure tokens are deployed
        if (!contracts["Eman Token 1"] || !contracts["Eman Token 2"]) {
            throw new Error("Tokens must be deployed to seed");
        }
        // since the type is [key: string]: string, ensure that at least 3 contracts are deployed (two tokens and one market maker)
        if (keys.length < 3) {
            throw new Error("At least 3 contracts must be deployed to seed - two tokens and one market maker");
        }

        // create a token instance
        const tokenA = await ethers.getContractAt("FungibleToken", contracts["Eman Token 1"], this.deployer);
        const tokenB = await ethers.getContractAt("FungibleToken", contracts["Eman Token 2"], this.deployer);
        const oneMillionTokens = ethers.utils.parseEther('1000000');
        // seed the seeders
        for (let i = 0; i < this.seeders.length; i++) {
            // send 1m of each token to each seeder
            await tokenA.transfer(this.seeders[i].address, oneMillionTokens);
            await tokenB.transfer(this.seeders[i].address, oneMillionTokens);
        }

        // if CPAMM is deployed, seed it
        if (contracts.cpamm) {
            // create cpamm instance
            const cpamm = await ethers.getContractAt("ConstantProduct", contracts.cpamm, this.deployer);
            // deployer adds liquidity. should be fine since deployer has started with 1 trillion tokens
            const oneBillionTokens = ethers.utils.parseEther('1000000000');
            await tokenA.connect(this.deployer).approve(cpamm.address, oneBillionTokens);
            await tokenB.connect(this.deployer).approve(cpamm.address, oneBillionTokens);
            await cpamm.connect(this.deployer).addLiquidity(
                oneBillionTokens,
                oneBillionTokens
            );
            console.log("Liquidity added to CPAMM \n");
            console.log("CPAMM - Token A reserves: ", (await cpamm.reserveA()).toString() + '\n');
            console.log("CPAMM - Token B reserves: ", (await cpamm.reserveB()).toString() + '\n');

            // seeders make swaps
            for (let i = 0; i < this.seeders.length; i++) {
                // create random number that is no more than 1/4 of one million
                let random = ethers.utils.parseEther(
                    Math.floor(Math.random() * 250000).toString()
                ); // 250000 is 1/4 of one million
                await tokenA.connect(this.seeders[i]).approve(cpamm.address, random);
                // trade random amount of tokenA for tokenB
                await cpamm.connect(this.seeders[i]).swap(
                    tokenA.address,
                    random
                );

                // trade random amount of tokenB for tokenA
                random = ethers.utils.parseEther(
                    Math.floor(Math.random() * 250000).toString()
                );
                await tokenB.connect(this.seeders[i]).approve(cpamm.address, random);
                await cpamm.connect(this.seeders[i]).swap(
                    tokenB.address,
                    random
                );
            }
        }

        // if CSAMM is deployed, seed it
        if (contracts.csamm) {
            // create csamm instance
            const csamm = await ethers.getContractAt("ConstantSum", contracts.csamm, this.deployer);
            // deployer adds liquidity. should be fine since deployer has started with 1 trillion tokens
            const oneBillionTokens = ethers.utils.parseEther('1000000000');
            await tokenA.connect(this.deployer).approve(csamm.address, oneBillionTokens);
            await tokenB.connect(this.deployer).approve(csamm.address, oneBillionTokens);
            await csamm.connect(this.deployer).addLiquidity(
                oneBillionTokens,
                oneBillionTokens
            );
            console.log("Liquidity added to CSAMM \n");
            console.log("CSAMM - Token A reserves: ", (await csamm.reserveA()).toString() + '\n');
            console.log("CSAMM - Token B reserves: ", (await csamm.reserveB()).toString() + '\n');

            // seeders make swaps
            for (let i = 0; i < this.seeders.length; i++) {
                // create random number that is no more than 1/4 of one million
                let random = ethers.utils.parseEther(
                    Math.floor(Math.random() * 250000).toString()
                ); // 250000 is 1/4 of one million
                await tokenA.connect(this.seeders[i]).approve(csamm.address, random);
                // trade random amount of tokenA for tokenB
                await csamm.connect(this.seeders[i]).swap(
                    tokenA.address,
                    random
                );

                // trade random amount of tokenB for tokenA
                random = ethers.utils.parseEther(
                    Math.floor(Math.random() * 250000).toString()
                );
                await tokenB.connect(this.seeders[i]).approve(csamm.address, random);
                await csamm.connect(this.seeders[i]).swap(
                    tokenB.address,
                    random
                );
            }
        }

        // if OBMM is deployed, seed it
        if (contracts.obmm) {
            // create obmm instance
            const obmm = await ethers.getContractAt("OrderBook", contracts.obmm, this.deployer);

            // deposits
            for (let i = 0; i < this.seeders.length; i++) {
                // deposit ether
                await obmm.connect(this.seeders[i]).depositEther({ value: ethers.utils.parseEther('50') }); // 50 ether

                // deposit entire balance of tokenA
                let seederTokenBalance = await tokenA.balanceOf(this.seeders[i].address);
                await tokenA.connect(this.seeders[i]).approve(obmm.address, seederTokenBalance);
                await obmm.connect(this.seeders[i]).depositToken(
                    tokenA.address,
                    seederTokenBalance
                );

                // deposit entire balance of tokenB
                seederTokenBalance = await tokenB.balanceOf(this.seeders[i].address);
                await tokenB.connect(this.seeders[i]).approve(obmm.address, seederTokenBalance);
                await obmm.connect(this.seeders[i]).depositToken(
                    tokenB.address,
                    seederTokenBalance
                );
            }

            const ethAddr = ethers.constants.AddressZero;

            // seeder 1 makes multiple orders - giving tokenA in return for eth
            let seederBalance = await obmm.tokens(tokenA.address, this.seeders[0].address);
            for (let i = 0; i < 5; i++) {
                // every iteration the amount of eth they're asking for should be 1% more than the previous iteration
                let price = ethers.utils.parseEther((1 + i / 100).toString());
                await obmm.connect(this.seeders[0]).makeOrder(
                    ethAddr,
                    price,
                    tokenA.address,
                    seederBalance.div(5) // they should make order 1/5 of their balance every time (use whole balance)
                );
                await this.wait(1); // wait 1 second
            }


            // seeder 2 makes multiple orders - giving tokenB in return for eth
            seederBalance = await obmm.tokens(tokenB.address, this.seeders[1].address);
            for (let i = 0; i < 5; i++) {
                // every iteration the amount of eth they're asking for should be 1% more than the previous iteration
                let price = ethers.utils.parseEther((1 + i / 100).toString());
                await obmm.connect(this.seeders[1]).makeOrder(
                    ethAddr,
                    price,
                    tokenB.address,
                    seederBalance.div(5) // they should make order 1/5 of their balance every time (use whole balance)
                );
                await this.wait(1); // wait 1 second
            }


            // seeder 3 makes multiple orders - giving tokenA for tokenB
            seederBalance = await obmm.tokens(tokenA.address, this.seeders[2].address);
            for (let i = 0; i < 5; i++) {
                // every iteration the amount of tokenB they're asking for should be 1% more than the previous iteration
                let price = ethers.utils.parseEther((1.3 + i / 100).toString());
                await obmm.connect(this.seeders[2]).makeOrder(
                    tokenB.address,
                    price,
                    tokenA.address,
                    seederBalance.div(5) // they should make order 1/5 of their balance every time (use whole balance)
                );
                await this.wait(1); // wait 1 second
            }

            // seeder 4 fills some orders
            // lets give our seeder some more chedda to play with
            await tokenA.connect(this.deployer).transfer(
                this.seeders[3].address,
                ethers.utils.parseEther('1000000')  // 1 million tokens
            );
            await tokenB.connect(this.deployer).transfer(
                this.seeders[3].address,
                ethers.utils.parseEther('1000000')  // 1 million tokens
            );
            // fills out the first 2 orders of every seeder // i.e order 1, 2, 6, 7, 11, 12
            const ordersToFill = [1, 2, 6, 7, 11, 12];
            for (let order of ordersToFill) {
                await obmm.connect(this.seeders[3]).fillOrder(order);
                await this.wait(1); // wait 1 second
            }

            // seeder 5 makes multiple orders - cancels all orders
            // make order 
            await obmm.connect(this.seeders[4]).makeOrder(
                ethAddr,
                ethers.utils.parseEther('1'),
                tokenA.address,
                ethers.utils.parseEther('100')
            );
            await this.wait(1); // wait 1 second
            const orderIdToCancel = await obmm.orderCount();
            // cancel order
            await obmm.connect(this.seeders[4]).cancelOrder(orderIdToCancel);
        }
    }

    async wait(seconds: number) {
        return new Promise((resolve) => {
            setTimeout(resolve, seconds * 1000);
        });
    }
}

const seed = new Seed();

seed.main({
    "Eman Token 1": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "Eman Token 2": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    "CPAMM": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
    "CSAMM": "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    "OBMM": "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318"
}).then(() => {
    console.log("Seed completed");
    process.exit(0);
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
