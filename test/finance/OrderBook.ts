import { expect } from "chai";
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractReceipt } from 'ethers';
import { FungibleToken } from '../../typechain-types/contracts/finance/FungibleToken';
import { OrderBook } from "../../typechain-types";

describe("Constant Sum", () => {
    let owner: SignerWithAddress;
    let signers: SignerWithAddress[];
    let tokenA: FungibleToken;
    let tokenB: FungibleToken;
    let obmm: OrderBook;
    const initialSupply: string = "10000000000000000000000000000000";
    beforeEach(async () => {
        // get signers
        [owner, ...signers] = await ethers.getSigners();
        // deploy token contracts
        const TokenA = await ethers.getContractFactory("FungibleToken");
        tokenA = await TokenA.deploy("Token A", "TKA", initialSupply);
        const TokenB = await ethers.getContractFactory("FungibleToken");
        tokenB = await TokenB.deploy("Token B", "TKB", initialSupply);
        // deploy order book
        const OBMM = await ethers.getContractFactory("OrderBook");
        obmm = await OBMM.deploy(owner.address, 1); // fee account is owner, fee is 1%
    });

    describe("Deployment", () => {
        it("Sets the fee account", async () => {
           expect(await obmm.feeAccount()).to.equal(owner.address);
        });
        it("Sets the fee percent", async () => {
            expect(await obmm.feePercent()).to.equal(1);
        });
    });

    describe("Deposit Ether", () => {
        describe("Success", () => {
            beforeEach(async () => {});
            it("", async () => {});
            it("", async () => {});
            it("", async () => {});
        });
        describe("Failure", () => {
            it("Reverts when ", () => {});
            it("Reverts when ", () => {});
        });
    });

    describe("Deposit Token", () => {
        describe("Success", () => {
            beforeEach(async () => {});
            it("", async () => {});
            it("", async () => {});
            it("", async () => {});
        });
        describe("Failure", () => {
            it("Reverts when ", () => {});
            it("Reverts when ", () => {});
        });
    });

    describe("Withdraw Ether", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });

    describe("Withdraw Token", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });

    describe("Make Order", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });
    describe("Cancel Order", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });
    describe("Fill Order", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });
});