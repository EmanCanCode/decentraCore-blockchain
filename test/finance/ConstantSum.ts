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
    const initialSupply: string = "10000000000000000000000000000000";
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
        // todo: do a before each so the contracts are set the way for individual test casess
        describe("Failure", () => {
            it("Reverts when the amounts given are 0", async () => {
                await expect(csamm.connect(owner).addLiquidity(0, 0)).to.be.revertedWith("Amount must be greater than 0");
            });
            it("Reverts when reserve ratio does not match", async () => {
                // add liquidity then try to add liquidity with a different ratio. should revert
                // approve csamm to spend tokens
                await tokenA.connect(owner).approve(csamm.address, initialSupply);
                await tokenB.connect(owner).approve(csamm.address, initialSupply);
                // add liquidity - 50/50 ratio using half the amount of tokens minted
                const liquidityAmount = BigNumber.from(initialSupply).div(2);
                await csamm.connect(owner).addLiquidity(
                    liquidityAmount, liquidityAmount
                );
                console.log(await csamm.reserveA(), await csamm.reserveB());
                console.log((await csamm.reserveA()).add(await csamm.reserveB()).eq(initialSupply));
                // determine what
                // try to add liquidity with a different ratio
                await expect(csamm.connect(owner).addLiquidity(
                    liquidityAmount, liquidityAmount.add(1)
                )).to.be.revertedWith("dx / dy != x / y");
            });
            it("Reverts when shares given is 0", async  () => {
                // add liquidity
                tokenA.connect(owner).approve(csamm.address, initialSupply);
                tokenB.connect(owner).approve(csamm.address, initialSupply);
                const liquidityAmount = BigNumber.from(initialSupply).div(2);
                csamm.connect(owner).addLiquidity(
                    liquidityAmount, liquidityAmount
                );
                // try to add liquidity with 1 token each to the pool, should revert
                await expect(csamm.connect(owner).addLiquidity(1, 1)).to.be.revertedWith("Shares must be greater than 0")
            });
        });
    });

    describe("Remove Liquidity", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });

    describe("Swap", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });
});