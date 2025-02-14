import { expect } from "chai";
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
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

    beforeEach(async () => {
        // signers
        [owner, ...signers] = await ethers.getSigners();
        // deploy the token contracts
        let factory: FungibleToken__factory | ConstantProduct__factory = await ethers.getContractFactory("FungibleToken");
        tokenA = await factory.deploy("Token A", "TKA", "10000000000000000000000000000000");
        tokenB = await factory.deploy("Token B", "TKB", "10000000000000000000000000000000");
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

    describe("Add Liquidity", () => {});
    describe("Remove Liquidity", () => {});
    describe("Swap", () => {});
});