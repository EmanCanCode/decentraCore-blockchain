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
            const userBalance = await obmm.tokens(ethers.constants.AddressZero, owner.address);
            expect(userBalance).to.equal(0);
            // deposit ether
            const tx = await obmm.depositEther({ value: ethers.utils.parseEther("1") });
            receipt = await tx.wait();
        });
        it("Stores and tracks user deposit", async () => {
            const balance = await ethers.provider.getBalance(obmm.address);
            expect(balance).to.equal(ethers.utils.parseEther("1"));
            const userBalance = await obmm.tokens(ethers.constants.AddressZero, owner.address);
            expect(userBalance).to.equal(ethers.utils.parseEther("1"));
        });
        it("Emits Deposit event", async () => {
            const events = receipt.events!;
            const event = events.filter((event) => event.event === "Deposit")[0];
            expect(event.event!).to.equal("Deposit");
            const args = event.args!;
            expect(args.token).to.equal(ethers.constants.AddressZero);
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
                    ethers.constants.AddressZero,
                    ethers.utils.parseEther("1")
                )).to.be.revertedWith("Invalid token address");
            });
        });
    });

    describe("Withdraw Ether", () => {
        let receipt: ContractReceipt;
        beforeEach(async () => {
            // deposit ether
            await obmm.depositEther({ value: ethers.utils.parseEther("1") });
            // assert that the contract has ether
            const balance = await ethers.provider.getBalance(obmm.address);
            expect(balance).to.equal(ethers.utils.parseEther("1"));
            // assert that users balance is 1
            const userBalance = await obmm.tokens(ethers.constants.AddressZero, owner.address);
            expect(userBalance).to.equal(ethers.utils.parseEther("1"));
            // withdraw ether
            const tx = await obmm.withdrawEther(ethers.utils.parseEther("1"));
            receipt = await tx.wait();
        });

        describe("Success", () => {
            it("Stores and tracks user withdrawal", async () => {
                const balance = await ethers.provider.getBalance(obmm.address);
                expect(balance).to.equal(0);
                const userBalance = await obmm.tokens(ethers.constants.AddressZero, owner.address);
                expect(userBalance).to.equal(0);
            });
            it("Emits Withdraw event", async () => {
                const events = receipt.events!;
                const event = events.filter((event) => event.event === "Withdraw")[0];
                expect(event.event!).to.equal("Withdraw");
                const args = event.args!;
                expect(args.token).to.equal(ethers.constants.AddressZero);
                expect(args.user).to.equal(owner.address);
                expect(args.amount).to.equal(ethers.utils.parseEther("1"));
                expect(args.balance).to.equal(0);
            });
        });
        describe("Failure", () => {
            it("Reverts when user has insufficient balance", async () => {
                await expect(
                    obmm.withdrawEther(ethers.utils.parseEther("1"))
                ).to.be.revertedWith("Insufficient balance");
            });
        });
    });

    describe("Withdraw Token", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // deposit token
                await tokenA.approve(obmm.address, ethers.utils.parseEther("1"));
                await obmm.depositToken(tokenA.address, ethers.utils.parseEther("1"));
                // assert that the contract has token balance
                const balance = await tokenA.balanceOf(obmm.address);
                expect(balance).to.equal(ethers.utils.parseEther("1"));
                // assert that users balance is 1
                const userBalance = await obmm.tokens(tokenA.address, owner.address);
                expect(userBalance).to.equal(ethers.utils.parseEther("1"));
                // withdraw token
                const tx = await obmm.withdrawToken(tokenA.address, ethers.utils.parseEther("1"));
                receipt = await tx.wait();
            });
            it("Stores and tracks user withdrawal", async () => {
                const balance = await tokenA.balanceOf(obmm.address);
                expect(balance).to.equal(0);
                const userBalance = await obmm.tokens(tokenA.address, owner.address);
                expect(userBalance).to.equal(0);
            });
            it("Emits Withdraw event", async () => {
                const events = receipt.events!;
                const event = events.filter((event) => event.event === "Withdraw")[0];
                expect(event.event!).to.equal("Withdraw");
                const args = event.args!;
                expect(args.token).to.equal(tokenA.address);
                expect(args.user).to.equal(owner.address);
                expect(args.amount).to.equal(ethers.utils.parseEther("1"));
                expect(args.balance).to.equal(0);
            });
        });
        describe("Failure", () => {
            it("Reverts when token address is ether address", async () => {
                await expect(obmm.withdrawToken(
                    ethers.constants.AddressZero,
                    ethers.utils.parseEther("1")
                )).to.be.revertedWith("Invalid token address");
            });
            it("Reverts when user has insufficient balance", async () => {
                await expect(
                    obmm.withdrawToken(tokenA.address, ethers.utils.parseEther("1"))
                ).to.be.revertedWith("Insufficient token balance");
            });
        });
    });

    describe("Make Order", () => {
        let receipt: ContractReceipt;
        beforeEach(async () => {
            // deposit token
            await tokenA.approve(obmm.address, ethers.utils.parseEther("1"));
            await obmm.depositToken(tokenA.address, ethers.utils.parseEther("1"));
            // assert order count is 0
            expect(await obmm.orderCount()).to.equal(0);
            // assert there is no order for order count 1 (which will be the order id for the first order)
            const order = await obmm.orders(1);
            expect(order.id).to.equal(0);
            expect(order.user).to.equal(ethers.constants.AddressZero);
            // make order
            const tx = await obmm.makeOrder(tokenA.address, ethers.utils.parseEther("1"), ethers.constants.AddressZero, ethers.utils.parseEther("1"));
            receipt = await tx.wait();
        });
        it("Increments order count", async () => {
            expect(await obmm.orderCount()).to.equal(1);
        });
        it("Stores order", async () => {
            const order = await obmm.orders(1);
            expect(order.id).to.equal(1);
            expect(order.user).to.equal(owner.address);
            expect(order.tokenGet).to.equal(tokenA.address);
            expect(order.amountGet).to.equal(ethers.utils.parseEther("1"));
            expect(order.tokenGive).to.equal(ethers.constants.AddressZero);
            expect(order.amountGive).to.equal(ethers.utils.parseEther("1"));
            const block = await ethers.provider.getBlock(receipt.blockNumber!);
            expect(order.timestamp).to.equal(block.timestamp);
        });
        it("Emits Order event", async () => {
            const events = receipt.events!;
            const event = events.filter((event) => event.event === "Order")[0];
            expect(event.event!).to.equal("Order");
            const args = event.args!;
            expect(args.id).to.equal(1);
            expect(args.user).to.equal(owner.address);
            expect(args.tokenGet).to.equal(tokenA.address);
            expect(args.amountGet).to.equal(ethers.utils.parseEther("1"));
            expect(args.tokenGive).to.equal(ethers.constants.AddressZero);
            expect(args.amountGive).to.equal(ethers.utils.parseEther("1"));
            const block = await ethers.provider.getBlock(receipt.blockNumber!);
            expect(args.timestamp).to.equal(block.timestamp);
        });
    });

    describe("Cancel Order", () => {
        let receipt: ContractReceipt;
        beforeEach(async () => {
            // deposit token
            await tokenA.approve(obmm.address, ethers.utils.parseEther("1"));
            await obmm.depositToken(tokenA.address, ethers.utils.parseEther("1"));
            // make order
            await obmm.makeOrder(tokenA.address, ethers.utils.parseEther("1"), ethers.constants.AddressZero, ethers.utils.parseEther("1"));
            // assert there is an order for order count 1
            const order = await obmm.orders(1);
            expect(order.id).to.equal(1);
            expect(order.user).to.equal(owner.address);
            // cancel order
            const tx = await obmm.cancelOrder(1);
            receipt = await tx.wait();
        });
        describe("Success", () => {
            it("Tracks cancelled order", async () => {
                expect(await obmm.orderCancelled(1)).to.be.true;
            });
            it("Emits Cancel event", async () => {
                const events = receipt.events!;
                const event = events.filter((event) => event.event === "Cancel")[0];
                expect(event.event!).to.equal("Cancel");
                const args = event.args!;
                expect(args.id).to.equal(1);
                expect(args.user).to.equal(owner.address);
                expect(args.tokenGet).to.equal(tokenA.address);
                expect(args.amountGet).to.equal(ethers.utils.parseEther("1"));
                expect(args.tokenGive).to.equal(ethers.constants.AddressZero);
                expect(args.amountGive).to.equal(ethers.utils.parseEther("1"));
                const block = await ethers.provider.getBlock(receipt.blockNumber!);
                expect(args.timestamp).to.equal(block.timestamp);
            });
        });
        describe("Failure", () => {
            it("Reverts when it is not actor's order", async () => {
            });
            it("Reverts when order does not exist", async () => {});
            it("Reverts when order is already filled", async () => {});
            it("Reverts when the order is already cancelled", async () => {});
        });
    });

    describe("Fill Order", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });
});