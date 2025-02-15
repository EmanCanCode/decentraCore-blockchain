import { expect } from "chai";
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractReceipt } from "ethers";
import { ConstantProduct, FungibleToken } from "../../typechain-types/contracts/finance";
import { ConstantProduct__factory, FungibleToken__factory } from "../../typechain-types";


describe("ConstantProduct", () => {
    // signers
    let owner: SignerWithAddress;
    let signers: SignerWithAddress[];
    // declare two token contracts
    let tokenA: FungibleToken;
    let tokenB: FungibleToken;
    // declare the constant product contract
    let cpamm: ConstantProduct;
    const initialSupply: string = "10000000000000000000000000000000";
    beforeEach(async () => {
        // signers
        [owner, ...signers] = await ethers.getSigners();
        // deploy the token contracts
        let factory: FungibleToken__factory | ConstantProduct__factory = await ethers.getContractFactory("FungibleToken");
        tokenA = await factory.deploy("Token A", "TKA", initialSupply);
        tokenB = await factory.deploy("Token B", "TKB", initialSupply);
        // deploy the constant product contract
        factory = await ethers.getContractFactory("ConstantProduct");
        cpamm = await factory.deploy(tokenA.address, tokenB.address);
    });

    describe("Deployment", () => {
        it("Sets token contracts", async () => {
            expect(await cpamm.tokenA()).to.equal(tokenA.address);
            expect(await cpamm.tokenB()).to.equal(tokenB.address);
        });

        it("Sets the owner", async () => {
            expect(await cpamm.owner()).to.equal(owner.address);
        });
    });

    describe("Add Liquidity", () => {
        let receipt: ContractReceipt;
        const tokenASupply = "10000000000";
        const tokenBSupply = "5000000000";
        let startingLP: BigNumber;
        beforeEach(async () => {
            // approve tokenA and tokenB to cpamm
            await tokenA.connect(owner).approve(
                cpamm.address, initialSupply
            );
            await tokenB.connect(owner).approve(
                cpamm.address, initialSupply
            );
            startingLP = await cpamm.balanceOf(owner.address);
            expect(startingLP).to.equal("0");
            // add liquidity to the pool
            let tx = await cpamm.connect(owner).addLiquidity(
                tokenASupply, // tokenA',
                tokenBSupply, // 1 tokenB is worth 2 tokenA
            );
            receipt = await tx.wait();
        });
        describe("Success", () => {
            it("Adds liquidity to the pool", async () => {
                // check reserves been updated, and tokens been transferred
                expect(await cpamm.reserveA()).to.equal(tokenASupply);
                expect(await tokenA.balanceOf(cpamm.address)).to.equal(tokenASupply);
                expect(await cpamm.reserveB()).to.equal(tokenBSupply);
                expect(await tokenB.balanceOf(cpamm.address)).to.equal(tokenBSupply);
                // ensures that reserves + user token balances = initial supply
                expect((await cpamm.reserveA()).add(await tokenA.balanceOf(owner.address))).to.equal(initialSupply);
                expect((await cpamm.reserveB()).add(await tokenB.balanceOf(owner.address))).to.equal(initialSupply);
            });
            it("Updates user LP tokens", async () => {
                let lp = await cpamm.balanceOf(owner.address);
                // check user LP tokens been minted
                // assert that the user LP tokens are greater than 0 (startingLP = 0)
                expect(lp.gt(startingLP)).to.be.true;
            });
            it("Emits AddedLiquidity event", async () => {
                // get the events from the receipt
                const events = receipt.events!;
                // filter for the one that has an event called "AddedLiquidity"
                const addedLiquidityEvent = events.find((event) => event.event === "AddedLiquidity")!;
                const args = addedLiquidityEvent.args!;
                expect(args.to).to.equal(owner.address);
                expect(args.shares).to.equal(await cpamm.balanceOf(owner.address));
                expect(args.shares.gt(0)).to.be.true;
            });
        });
        describe("Failure", () => {
            it("Reverts when dy / dx != y / x", async () => {
                // add liquidity to the pool but not a 1:2 tokenA:tokenB ratio
                // the ratio was initially 1:2 done in the beforeEach
                await expect(cpamm.connect(owner).addLiquidity(
                    tokenASupply, // tokenA',
                    tokenASupply, // 1 tokenB is worth 1 tokenA should fail ❌
                )).to.be.revertedWith("dy / dx != y / x");
            });
        });
    });

    describe("Remove Liquidity", () => {
        const tokenASupply = "10000000000";
        const tokenBSupply = "5000000000";
        // add liquidity to the pool so that we can remove it and test
        beforeEach(async () => {
            // approve tokenA and tokenB to cpamm 
            await tokenA.connect(owner).approve(
                cpamm.address, initialSupply
            );
            await tokenB.connect(owner).approve(
                cpamm.address, initialSupply
            );
            await cpamm.connect(owner).addLiquidity(
                tokenASupply, // tokenA',
                tokenBSupply, // 1 tokenB is worth 2 tokenA
            );
        });
        describe("Success", () => {
            let receipt: ContractReceipt;
            let initialShares: BigNumber;
            beforeEach(async () => {
                // get the shares of the user
                initialShares = await cpamm.balanceOf(owner.address);
                // remove all liquidity from the pool / return shares to the pool
                const tx = await cpamm.connect(owner).removeLiquidity(initialShares);
                receipt = await tx.wait();
            });

            it("Removes liquidity, providing tokens", async () => {
                // check reserves been updated, and tokens been transferred
                expect(await cpamm.reserveA()).to.equal(0);
                expect(await tokenA.balanceOf(cpamm.address)).to.equal(0);
                expect(await cpamm.reserveB()).to.equal(0);
                expect(await tokenB.balanceOf(cpamm.address)).to.equal(0);
                // check user LP tokens been burnt
                expect(await cpamm.balanceOf(owner.address)).to.equal(0);
                // check user tokens been transferred
                expect(await tokenA.balanceOf(owner.address)).to.equal(initialSupply);
                expect(await tokenB.balanceOf(owner.address)).to.equal(initialSupply);
            });
            it("Updates user LP tokens", async () => {
                expect(await cpamm.balanceOf(owner.address)).to.equal(0);
            });
            it("Emits a RemovedLiquidity event", async () => {
                const events = receipt.events!;
                const removedLiquidityEvent = events.find((event) => event.event === "RemovedLiquidity")!;
                const args = removedLiquidityEvent.args!;
                expect(args.from).to.equal(owner.address);
                expect(args.shares).to.equal(initialShares);
            });
        });

        describe("Failure", () => {
            it("Reverts when amount of either token given back = 0", async () => {
                // attempt to remove only 1 LP token from a pool with a large totalSupply,
                // which should yield 0 for at least one token due to integer division.
                await expect(cpamm.connect(owner).removeLiquidity(1)).to.be.revertedWith("amountA or amountB = 0");
            });
        });
    });

    describe("Swap", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            const tokenReserveBeforeSwap = {
                tokenA:"10000000000",
                tokenB:"5000000000"
            };
            const swapAmount = "7000000";
            beforeEach(async () => {
                // approve tokenA and tokenB to cpamm
                await tokenA.connect(owner).approve(
                    cpamm.address, initialSupply
                );
                await tokenB.connect(owner).approve(
                    cpamm.address, initialSupply
                );
                // add liquidity to the pool
                await cpamm.connect(owner).addLiquidity(
                    tokenReserveBeforeSwap.tokenA, // tokenA',
                    tokenReserveBeforeSwap.tokenB, // 1 tokenB is worth 2 tokenA
                );
                const actor = signers[0];
                // send some tokenA to the user
                await tokenA.connect(owner).transfer(actor.address, swapAmount);
                // ensure that the user has the tokenA and no tokenB
                expect(await tokenA.balanceOf(actor.address)).to.equal(swapAmount);
                expect(await tokenB.balanceOf(actor.address)).to.equal(0);
                // approve cpamm to spend the user's tokenA
                await tokenA.connect(actor).approve(cpamm.address, swapAmount);


                // swap tokenA for tokenB
                const tx = await cpamm.connect(actor).swap(tokenA.address, swapAmount);
                receipt = await tx.wait();
            });
            it("Swaps tokens with user", async () => {
                const actor = signers[0];
                // todo: do the math (expected tokenA and tokenB balances) and assert
                // check user has no tokenA
                expect(await tokenA.balanceOf(actor.address)).to.equal(0);
                // check user has tokenB
                expect((await tokenB.balanceOf(actor.address)).gt(0)).to.be.true;
            });
            it("Updates reserves", async () => {
                const actor = signers[0];
                 // ensure that the reserves has 99.7% of the tokenA swapped (6979000) + tokenReserveBeforeSwap.tokenA
                 expect(await cpamm.reserveA()).to.equal(
                    BigNumber.from(tokenReserveBeforeSwap.tokenA).add(6979000)
                );
                // ensure that the reserves is tokenReserveBeforeSwap.tokenB - usersTokenB
                expect(await cpamm.reserveB()).to.equal(
                    BigNumber.from(tokenReserveBeforeSwap.tokenB).sub(await tokenB.balanceOf(actor.address))
                );
            });
            it("Gives owner the fees from the swap", async () => {
                // check that owner received fees (0.3% of swap or 21000) from actor swapping tokenA
                // added liquidity, gave token A to actor, then got 0.3% of the swap amount
                const expectedOwnerAmount = BigNumber.from(initialSupply).sub(tokenReserveBeforeSwap.tokenA).sub(swapAmount).add(21000);
                expect(await tokenA.balanceOf(owner.address)).to.equal(expectedOwnerAmount);
            });
            it("Emits a Swapped event", async () => {
                const actor = signers[0];
                const events = receipt.events!;
                const swappedEvent = events.find((event) => event.event === "Swapped")!;
                const args = swappedEvent.args!;
                expect(args.from).to.equal(actor.address);
                expect(args.to).to.equal(tokenB.address);
                expect(args.amountReceived).to.equal(swapAmount);
                expect(args.amountReturned).to.equal(await tokenB.balanceOf(actor.address));
            });
        });
        describe("Failure", () => { // i didnt test all the require statements in the contract for this fn because theyre on the return of ERC20 functions that are already tested (openzeppelin)
            it("Reverts when token is not in pair", async () => {
                // if address is not in the pair, it should revert
                // dont have to add liquidity to test this
                await expect(cpamm.connect(owner).swap(owner.address, '10000000000')).to.be.revertedWith("Token not in pair");
            });
            it("Reverts when amount to receive is 0", async () => { 
                // if the amount to receive is 0, it should revert
                // dont have to add liquidity to test this
                await expect(cpamm.connect(owner).swap(tokenA.address, '0')).to.be.revertedWith("Amount must be greater than 0");
            });
        });
    });
});