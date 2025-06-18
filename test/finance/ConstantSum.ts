import { expect } from "chai";
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractReceipt, Signer } from 'ethers';
import { FungibleToken } from '../../typechain-types/contracts/finance/FungibleToken';
import { ConstantSum } from "../../typechain-types";

describe("Constant Sum", () => {
    let owner: SignerWithAddress;
    let signers: SignerWithAddress[];
    let tokenA: FungibleToken;
    let tokenB: FungibleToken;
    let csamm: ConstantSum;
    const initialSupply: string = "10000000000000000000000000000000"; // 
    beforeEach(async () => {
        // get signers
        [owner, ...signers] = await ethers.getSigners();
        // deploy token contracts
        const TokenA = await ethers.getContractFactory("FungibleToken");
        tokenA = await TokenA.deploy("Token A", "TKA", initialSupply);
        const TokenB = await ethers.getContractFactory("FungibleToken");
        tokenB = await TokenB.deploy("Token B", "TKB", initialSupply);
        // deploy constant sum AMM
        const CSAMM = await ethers.getContractFactory("ConstantSum");
        csamm = await CSAMM.deploy(tokenA.address, tokenB.address);
    });

    describe("Deployment", () => {
        it("Sets the token contracts", async () => {
            expect(await csamm.tokenA()).to.equal(tokenA.address);
            expect(await csamm.tokenB()).to.equal(tokenB.address);
        });
        it("Sets the owner", async () => {
            expect(await csamm.owner()).to.equal(owner.address);
        });
    });

    describe("Add Liquidity", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // approve csamm to spend tokens
                await tokenA.connect(owner).approve(csamm.address, initialSupply);
                await tokenB.connect(owner).approve(csamm.address, initialSupply);
                // assert that the contract does not have any liquidity (used to prove test case 1)
                expect(await csamm.reserveA()).to.equal(0);
                expect(await csamm.reserveB()).to.equal(0);
                // assert that the liquidity provider does not have any shares / LPT (used to prove test case 2)
                expect(await csamm.balanceOf(owner.address)).to.equal(0);
                // add liquidity - 50/50 ratio using the same amount of tokens minted (makes it easy to test)
                const tx = await csamm.connect(owner).addLiquidity(
                    initialSupply, initialSupply
                );
                receipt = await tx.wait();
            });
            it("Adds liquidity to the pool", async () => {
                expect(await csamm.reserveA()).to.equal(initialSupply);
                expect(await csamm.reserveB()).to.equal(initialSupply);
            });
            it("Mint shares (LP Token) to the sender and updates reserves", async () => {
                expect(await csamm.balanceOf(owner.address)).to.not.equal(0);
            });
            it("Emits a AddedLiquidity event", async () => {
                const events = receipt.events!;
                const liquidityEvent = events.find((event) => event.event === "AddedLiquidity")!;
                expect(liquidityEvent.event).to.equal("AddedLiquidity");
                const args = liquidityEvent.args!;
                expect(args.to).to.equal(owner.address);
                expect(args.amount).to.equal(await csamm.balanceOf(owner.address));
            });
        });
        describe("Failure", () => {
            const liquidityAmount = BigNumber.from(initialSupply).div(4);
            beforeEach(async () => {
                // approve csamm to spend tokens
                await tokenA.connect(owner).approve(csamm.address, initialSupply);
                await tokenB.connect(owner).approve(csamm.address, initialSupply);
                // add liquidity - 50/50 ratio using half the amount of tokens minted
                await csamm.connect(owner).addLiquidity(
                    liquidityAmount, liquidityAmount
                );
            });
            it("Reverts when the amounts given are 0", async () => {
                await expect(csamm.connect(owner).addLiquidity(0, 0)).to.be.revertedWith("Amount must be greater than 0");
            });
            it("Reverts when reserve ratio does not match", async () => {
                // add liquidity then try to add liquidity with a different ratio. should revert
                // determine what
                // try to add liquidity with a different ratio
                await expect(csamm.connect(owner).addLiquidity(
                    liquidityAmount, liquidityAmount.mul(2)
                )).to.be.revertedWith("dx / dy != x / y");
            });
        });
    });

    describe("Remove Liquidity", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            let shares: BigNumber;
            beforeEach(async () => {
                // approve csamm to spend tokens
                await tokenA.connect(owner).approve(csamm.address, initialSupply);
                await tokenB.connect(owner).approve(csamm.address, initialSupply);
                // add liquidity - 50/50 ratio using the same amount of tokens minted (makes it easy to test)
                await csamm.connect(owner).addLiquidity(
                    initialSupply, initialSupply
                );
                // assert the reserves are not 0
                expect(await csamm.reserveA()).to.not.equal(0);
                expect(await csamm.reserveB()).to.not.equal(0);
                // assert that the liquidity provider has shares / LPT
                shares = await csamm.balanceOf(owner.address);
                expect(shares).to.not.equal(0);
                // remove liquidity
                const tx = await csamm.connect(owner).removeLiquidity(
                    await csamm.balanceOf(owner.address)
                );
                receipt = await tx.wait();
            });
            it("Removes liquidity from the pool", async () => {
                expect(await csamm.reserveA()).to.equal(0);
                expect(await csamm.reserveB()).to.equal(0);
            });
            it("Updates user shares (LP Token)", async () => {
                expect(await csamm.balanceOf(owner.address)).to.equal(0);
            });
            it("Emits RemovedLiquidity event", async () => {
                const events = receipt.events!;
                const liquidityEvent = events.find((event) => event.event === "RemovedLiquidity")!;
                expect(liquidityEvent.event).to.equal("RemovedLiquidity");
                const args = liquidityEvent.args!;
                expect(args.from).to.equal(owner.address);
                expect(args.amount).to.equal(shares);
            });
        });
        describe("Failure", () => {
            it("Reverts when the shares param is 0", async () => {
                await expect(
                    csamm.connect(owner).removeLiquidity(0)
                ).to.be.revertedWith("Shares must be greater than 0");
            });
        });
    });

    describe("Swap", () => {
        
        describe("Success", () => {
            let receipt: ContractReceipt;
            let actor: SignerWithAddress;
            let liquidityAmount: BigNumber;
            beforeEach(async () => {
                // approve csamm to spend tokens
                await tokenA.connect(owner).approve(csamm.address, initialSupply);
                await tokenB.connect(owner).approve(csamm.address, initialSupply);
                // add liquidity - 50/50 ratio 
                liquidityAmount = BigNumber.from(initialSupply).div(4);
                await csamm.connect(owner).addLiquidity(
                    liquidityAmount, liquidityAmount
                );
                // create another account to swap with
                actor = (await ethers.getSigners())[1];
                // send actor some tokens to swap with
                await tokenA.connect(owner).transfer(actor.address, liquidityAmount);
                // approve csamm to spend tokens
                await tokenA.connect(actor).approve(csamm.address, liquidityAmount);
                // assert the reserves are at liquidity amount
                expect(await csamm.reserveA()).to.equal(liquidityAmount);
                expect(await csamm.reserveB()).to.equal(liquidityAmount);
                // assert that account does not have token B
                expect(await tokenB.balanceOf(actor.address)).to.equal(0);
                // assert owner has half the supply of token A (liquidityAmount is a quarter of the supply. gave qtr for liquidity and qtr for actor)
                expect(await tokenA.balanceOf(owner.address)).to.equal(BigNumber.from(initialSupply).div(2));
                // swap tokens
                const tx = await csamm.connect(actor).swap(
                    tokenA.address, liquidityAmount.div(10)
                );
                receipt = await tx.wait();
            });
            it("Swaps token A for token B", async () => {
                expect(await tokenB.balanceOf(actor.address)).to.not.equal(0);
                expect(await tokenA.balanceOf(actor.address)).to.equal(liquidityAmount.sub(liquidityAmount.div(10)));
            });
            it("Gives owner the fees from the swap", async () => { // asserted the owner balance in the before each
                // if liquidityAmount is a quarter of the supply, and i swapped a tenth of that, the fee should be 0.3% of that
                const fee = liquidityAmount.div(10).mul(3).div(1000);
                expect(
                    (await tokenA.balanceOf(owner.address)).eq(
                        BigNumber.from(initialSupply).div(3).add(fee)
                    )
                );
            });
            it("Updates reserves", async () => {
                expect(await csamm.reserveA()).to.equal(
                    liquidityAmount.add(liquidityAmount.div(10))
                );
                expect((await csamm.reserveB()).lt(liquidityAmount)).to.be.true;
            });
            it("Emits Swapped event", async () => {
                const events = receipt.events!;
                const swapEvent = events.find((event) => event.event === "Swapped")!;
                expect(swapEvent.event).to.equal("Swapped");
                const args = swapEvent.args!;
                expect(args.from).to.equal(tokenA.address);
                expect(args.to).to.equal(tokenB.address);
                expect(args.amountReceived).to.equal(liquidityAmount.div(10));
                expect(args.amountReturned).to.equal(await tokenB.balanceOf(actor.address));
            });
        });
        describe("Failure", () => {
            it("Reverts when token is not in pair", async () => {
                // give zero address, should revert
                await expect(csamm.connect(owner).swap(
                    ethers.constants.AddressZero,
                    5
                )).to.be.revertedWith("Token not in pair");
            });
            it("Reverts when amount received is 0", async () => {
                // give zero amount, should revert
                await expect(csamm.connect(owner).swap(
                    tokenA.address,
                    0
                )).to.be.revertedWith("Amount must be greater than 0");
            });
        });
    });
});