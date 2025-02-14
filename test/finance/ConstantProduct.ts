import { expect } from "chai";
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ConstantProduct, FungibleToken } from "../../typechain-types/contracts/finance";
import { ConstantProduct__factory, FungibleToken__factory } from "../../typechain-types";
import { BigNumber, ContractReceipt } from "ethers";


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
            it("Rejects when dy / dx != y / x", async () => {
                // add liquidity to the pool but not a 1:2 tokenA:tokenB ratio
                // the ratio was initially 1:2 done in the beforeEach
                await expect(cpamm.connect(owner).addLiquidity(
                    tokenASupply, // tokenA',
                    tokenASupply, // 1 tokenB is worth 1 tokenA should fail ❌
                )).to.be.revertedWith("dy / dx != y / x");
            });
        });
    });
    describe("Remove Liquidity", () => {});
    describe("Swap", () => {});
});