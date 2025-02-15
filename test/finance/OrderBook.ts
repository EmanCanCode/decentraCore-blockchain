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
            beforeEach(async () => {});
            it("Add liquidity to the pool", async () => {});
            it("Mint shares (LP Token) to the sender and updates reserves", async () => {});
            it("Emits a AddedLiquidity event", async () => {});
        });
        describe("Failure", () => {
            it("Reverts when reserve ratio does not match", () => {});
            it("Reverts when shares given is 0", () => {});
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