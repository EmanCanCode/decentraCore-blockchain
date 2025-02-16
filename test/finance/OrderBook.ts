import { expect } from "chai";
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractReceipt } from 'ethers';
import { FungibleToken } from '../../typechain-types/contracts/finance/FungibleToken';
import { OrderBook } from "../../typechain-types";

describe("Order Book", () => {
    let owner: SignerWithAddress;
    let signers: SignerWithAddress[];
    let tokenA: FungibleToken;
    let obmm: OrderBook;
    const etherAddr = "0x0000000000000000000000000000000000000000";  // address of ether
    const initialSupply: string = "10000000000000000000000000000000";
    beforeEach(async () => {
        // get signers
        [owner, ...signers] = await ethers.getSigners();
        // deploy token contracts
        const TokenA = await ethers.getContractFactory("FungibleToken");
        tokenA = await TokenA.deploy("Token A", "TKA", initialSupply);
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
        let receipt: ContractReceipt;
        beforeEach(async () => {
            // assert that the contract has no ether
            const balance = await ethers.provider.getBalance(obmm.address);
            expect(balance).to.equal(0);
            // assert that users balance is 0
            const userBalance = await obmm.tokens(etherAddr, owner.address);
            expect(userBalance).to.equal(0);
            // deposit ether
            const tx = await obmm.depositEther({ value: ethers.utils.parseEther("1") });
            receipt = await tx.wait();
        });
        it("Stores and tracks user deposit", async () => {
            const balance = await ethers.provider.getBalance(obmm.address);
            expect(balance).to.equal(ethers.utils.parseEther("1"));
            const userBalance = await obmm.tokens(etherAddr, owner.address);
            expect(userBalance).to.equal(ethers.utils.parseEther("1"));
        });
        it("Emits Deposit event", async () => {
            const events = receipt.events!;
            const event = events.filter((event) => event.event === "Deposit")[0];
            expect(event.event!).to.equal("Deposit");
            const args = event.args!;
            expect(args.token).to.equal(etherAddr);
            expect(args.user).to.equal(owner.address);
            expect(args.amount).to.equal(ethers.utils.parseEther("1"));
            expect(args.balance).to.equal(ethers.utils.parseEther("1"));
        });
    });

    describe("Deposit Token", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // assert that the contract has no token balance
                const balance = await tokenA.balanceOf(obmm.address);
                expect(balance).to.equal(0);
                // assert that users balance is 0
                const userBalance = await obmm.tokens(tokenA.address, owner.address);
                expect(userBalance).to.equal(0);
                // deposit token
                await tokenA.approve(obmm.address, ethers.utils.parseEther("1"));
                const tx = await obmm.depositToken(tokenA.address, ethers.utils.parseEther("1"));
                receipt = await tx.wait();
            });
            it("Stores and tracks user deposit", async () => {
                const balance = await tokenA.balanceOf(obmm.address);
                expect(balance).to.equal(ethers.utils.parseEther("1"));
                const userBalance = await obmm.tokens(tokenA.address, owner.address);
                expect(userBalance).to.equal(ethers.utils.parseEther("1"));
            });
            it("Emits Deposit event", async () => {
                const events = receipt.events!;
                const event = events.filter((event) => event.event === "Deposit")[0];
                expect(event.event!).to.equal("Deposit");
                const args = event.args!;
                expect(args.token).to.equal(tokenA.address);
                expect(args.user).to.equal(owner.address);
                expect(args.amount).to.equal(ethers.utils.parseEther("1"));
                expect(args.balance).to.equal(ethers.utils.parseEther("1"));
            });
        });
        describe("Failure", () => {
            it("Reverts when token address is ether address", async () => {
                await expect(obmm.depositToken(
                    etherAddr,
                    ethers.utils.parseEther("1")
                )).to.be.revertedWith("Invalid token address");
            });
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