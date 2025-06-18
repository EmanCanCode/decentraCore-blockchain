import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "ethers";
import { DeployedContracts } from "./interfaces";
import * as financeContracts from '../../logs/finance/deploy.json';
import dotenv from 'dotenv';
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
        } else if (
            // ensure seeders are set
            !process.env.SEEDER1_PRIVATE_KEY ||
            !process.env.SEEDER2_PRIVATE_KEY ||
            !process.env.SEEDER3_PRIVATE_KEY ||
            !process.env.SEEDER4_PRIVATE_KEY ||
            !process.env.SEEDER5_PRIVATE_KEY
        ) {
            throw new Error("SEEDER_PRIVATE_KEY is not set");
        }
        // initialize provider and deployer
        this.provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
        this.deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);
        // initialize seeders
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
            let tx = await tokenA.transfer(this.seeders[i].address, oneMillionTokens);
            await tx.wait();
            tx = await tokenB.transfer(this.seeders[i].address, oneMillionTokens);
            await tx.wait();
        }

        // if CPAMM is deployed, seed it
        if (contracts.CPAMM) {
            // create cpamm instance
            const cpamm = await ethers.getContractAt("ConstantProduct", contracts.CPAMM, this.deployer);
            // deployer adds liquidity. should be fine since deployer has started with 1 trillion tokens
            const oneBillionTokens = ethers.utils.parseEther('1000000000');
            let tx = await tokenA.connect(this.deployer).approve(cpamm.address, oneBillionTokens);
            await tx.wait();
            tx = await tokenB.connect(this.deployer).approve(cpamm.address, oneBillionTokens);
            await tx.wait();
            tx = await cpamm.connect(this.deployer).addLiquidity(
                oneBillionTokens,
                oneBillionTokens
            );
            await tx.wait();

            // seeders make swaps
            for (let i = 0; i < this.seeders.length; i++) {
                // create random number that is no more than 1/4 of one million
                let random = ethers.utils.parseEther(
                    Math.floor(Math.random() * 250000).toString()
                ); // 250000 is 1/4 of one million
                let tx = await tokenA.connect(this.seeders[i]).approve(cpamm.address, random);
                await tx.wait();

                // trade random amount of tokenA for tokenB
                tx = await cpamm.connect(this.seeders[i]).swap(
                    tokenA.address,
                    random
                );
                await tx.wait();

                // trade random amount of tokenB for tokenA
                random = ethers.utils.parseEther(
                    Math.floor(Math.random() * 250000).toString()
                );
                tx = await tokenB.connect(this.seeders[i]).approve(cpamm.address, random);
                await tx.wait();

                tx = await cpamm.connect(this.seeders[i]).swap(
                    tokenB.address,
                    random
                );
                await tx.wait();
            }

        }

        // if CSAMM is deployed, seed it
        if (contracts.CSAMM) {
            // create csamm instance
            const csamm = await ethers.getContractAt("ConstantSum", contracts.CSAMM, this.deployer);
            // deployer adds liquidity. should be fine since deployer has started with 1 trillion tokens
            const oneBillionTokens = ethers.utils.parseEther('1000000000');
            let tx = await tokenA.connect(this.deployer).approve(csamm.address, oneBillionTokens);
            await tx.wait();

            tx = await tokenB.connect(this.deployer).approve(csamm.address, oneBillionTokens);
            await tx.wait();
            
            tx = await csamm.connect(this.deployer).addLiquidity(
                oneBillionTokens,
                oneBillionTokens
            );
            await tx.wait();
            // console.log("Liquidity added to CSAMM \n");
            // console.log("CSAMM - Token A reserves: ", (await csamm.reserveA()).toString() + '\n');
            // console.log("CSAMM - Token B reserves: ", (await csamm.reserveB()).toString() + '\n');

            // // seeders make swaps
            // for (let i = 0; i < this.seeders.length; i++) {
            //     // create random number that is no more than 1/4 of one million
            //     let random = ethers.utils.parseEther(
            //         Math.floor(Math.random() * 250000).toString()
            //     ); // 250000 is 1/4 of one million
            //     await tokenA.connect(this.seeders[i]).approve(csamm.address, random);
            //     // trade random amount of tokenA for tokenB
            //     await csamm.connect(this.seeders[i]).swap(
            //         tokenA.address,
            //         random
            //     );
            //     

            //     // trade random amount of tokenB for tokenA
            //     random = ethers.utils.parseEther(
            //         Math.floor(Math.random() * 250000).toString()
            //     );
            //     await tokenB.connect(this.seeders[i]).approve(csamm.address, random);
            //     await csamm.connect(this.seeders[i]).swap(
            //         tokenB.address,
            //         random
            //     );
            //     
            // }
        }

        // if OBMM is deployed, seed it
        if (contracts.OBMM) {
            // create obmm instance
            const obmm = await ethers.getContractAt("OrderBook", contracts.OBMM, this.deployer);
            
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
                
            }

            // seeder 5 makes multiple orders - cancels all orders
            // make order 
            await obmm.connect(this.seeders[4]).makeOrder(
                ethAddr,
                ethers.utils.parseEther('1'),
                tokenA.address,
                ethers.utils.parseEther('100')
            );
            
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

const { OBMM, ...deployedContractAddresses } = financeContracts['contracts'];
seed.main(deployedContractAddresses).then(() => {
    console.log("Seed completed");
    process.exit(0);
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
