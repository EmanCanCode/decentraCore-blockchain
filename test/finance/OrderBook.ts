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
                const wrongSigner = signers[0];
                await expect(
                    obmm.connect(wrongSigner).cancelOrder(1)
                ).to.be.revertedWith("Not your order");
            });

            it("Reverts when order is already filled", async () => {
                // cheeky - took the beforeEach from fill order
                // get our actors
                const _signers = await ethers.getSigners();
                const actor1 = _signers[1];  // trust me, im a doctor
                const actor2 = _signers[2];
                // send actors tokens
                await tokenA.connect(owner).transfer(
                    await actor1.getAddress(),
                    ethers.utils.parseEther("10")
                );
                // actor 1 approves obmm to spend his tokens
                await tokenA.connect(actor1).approve(obmm.address, ethers.utils.parseEther("5"));
                // actor 1 deposits tokens
                await obmm.connect(actor1).depositToken(tokenA.address, ethers.utils.parseEther("5"));
                // actor 1 makes order. give 1 token for 1 ether (simple exchange rate)
                await obmm.connect(actor1).makeOrder(
                    ethers.constants.AddressZero,
                    ethers.utils.parseEther("1"),
                    tokenA.address,
                    ethers.utils.parseEther("1"),
                );
                // actor 2 deposits ether
                await obmm.connect(actor2).depositEther(
                    { value: ethers.utils.parseEther("5") }
                );
                // actor 2 fills order
                const tx = await obmm.connect(actor2).fillOrder(2);
                // get receipt
                receipt = await tx.wait();
                // assert order has been filled
                expect(await obmm.orderFilled(2)).to.be.true;

                // cancel filled order should revert
                await expect(obmm.connect(actor1).cancelOrder(2)).to.be.revertedWith(
                    "Order already filled"
                );
            });

            it("Reverts when the order is already cancelled", async () => {
                // cancel same order should revert
                await expect(obmm.cancelOrder(1)).to.be.revertedWith(
                    "Order already cancelled"
                );
            });
        });
    });

    describe("Fill Order", () => {
        // SCENARIO: actor 1 is giving token for ether. actor 2 is filling the order of ether for token
        let receipt: ContractReceipt;
        let actor1: SignerWithAddress;
        let actor2: SignerWithAddress;
        beforeEach(async () => {
            // get our actors
            const _signers = await ethers.getSigners();
            actor1 = _signers[1];  // trust me, im a doctor
            actor2 = _signers[2];
            // send actors tokens
            await tokenA.connect(owner).transfer(
                await actor1.getAddress(),
                ethers.utils.parseEther("10")
            );
            // actor 1 approves obmm to spend his tokens
            await tokenA.connect(actor1).approve(obmm.address, ethers.utils.parseEther("5"));
            // actor 1 deposits tokens
            await obmm.connect(actor1).depositToken(tokenA.address, ethers.utils.parseEther("5"));
            // actor 1 makes order. give 1 token for 1 ether (simple exchange rate)
            await obmm.connect(actor1).makeOrder(
                ethers.constants.AddressZero,
                ethers.utils.parseEther("1"),
                tokenA.address,
                ethers.utils.parseEther("1"),
            );
            // actor 2 deposits ether
            await obmm.connect(actor2).depositEther(
                { value: ethers.utils.parseEther("5") }
            );
            // actor 2 fills order
            const tx = await obmm.connect(actor2).fillOrder(1);
            // get receipt
            receipt = await tx.wait();
            // assert order has been filled
            expect(await obmm.orderFilled(1)).to.be.true;
        });
        describe("Success", () => {
            it("Fills the order (transfers tokens and fees)", async () => {
                // check balances of actor 1 and actor 2 and owner (fee account)
                expect(await obmm.tokens(tokenA.address, actor1.address)).to.equal(ethers.utils.parseEther('4'));  // deposited 5, made order of 1 token for 1 ether
                expect(await obmm.tokens(ethers.constants.AddressZero, actor1.address)).to.equal(ethers.utils.parseEther('1'));  // listed the 1 token for 1 ether
                expect(await obmm.tokens(tokenA.address, actor2.address)).to.equal(ethers.utils.parseEther('1'));  // filled 1 token
                // the tokens(ether, actor2) should return 4 - (1 + 0.01) (fee)
                expect(await obmm.tokens(ethers.constants.AddressZero, actor2.address)).to.equal(ethers.utils.parseEther('3.99')); // 1 percent fee is 0.01 ether
                // fee account should have 0.01 ether
                expect(await obmm.tokens(ethers.constants.AddressZero, owner.address)).to.equal(ethers.utils.parseEther('0.01'));
            });
            it("Tracks filled order", async () => {
                expect(await obmm.orderFilled(1)).to.be.true;
            });
            it("Emits Trade event", async () => {
                const events = receipt.events!;
                const event = events.filter((event) => event.event === "Trade")[0];
                expect(event.event!).to.equal("Trade");
                const args = event.args!;
                expect(args.id).to.equal(1);
                expect(args.user).to.equal(actor1.address);
                expect(args.tokenGet).to.equal(ethers.constants.AddressZero); // user GOT ether
                expect(args.amountGet).to.equal(ethers.utils.parseEther("1"));
                expect(args.tokenGive).to.equal(tokenA.address); // user GAVE token
                expect(args.amountGive).to.equal(ethers.utils.parseEther("1"));
                expect(args.userFill).to.equal(actor2.address);
                const block = await ethers.provider.getBlock(receipt.blockNumber!);
                expect(args.timestamp).to.equal(block.timestamp);
            });
        });
        describe("Failure", () => {
            it("Reverts when invalid order id", async () => {
                await expect(
                    obmm.fillOrder(2)
                ).to.be.revertedWith("Invalid order id");
            });
            it("Reverts when order is already cancelled", async () => {
                // make order then cancel it
                await obmm.connect(actor1).makeOrder(
                    ethers.constants.AddressZero,
                    ethers.utils.parseEther("1"),
                    tokenA.address,
                    ethers.utils.parseEther("1"),
                );
                await obmm.connect(actor1).cancelOrder(2);
                // fill the cancelled order
                await expect(obmm.connect(actor2).fillOrder(2)).to.be.revertedWith("Order already cancelled");
            });
            it("Reverts when order is already filled", async () => {
                // try to fill order 1 (was filled in the beforeEach). should revert
                await expect(obmm.connect(actor2).fillOrder(1)).to.be.revertedWith("Order already filled");
            });
            it("Reverts when the order filler does not have enough balance", async () => {
                // make order with actor 1
                await obmm.connect(actor1).makeOrder(
                    ethers.constants.AddressZero,
                    ethers.utils.parseEther("6"),
                    tokenA.address,
                    ethers.utils.parseEther("6"),
                );
                // fill order with actor 2. should revert because actor 2 does not have enough ether
                await expect(obmm.connect(actor2).fillOrder(2)).to.be.revertedWith("Trade failed: Insufficient balance to cover amount plus fee");
            });
            it("Reverts when the order maker does not have enough balance", async () => {
                // make order with actor 1
                await obmm.connect(actor1).makeOrder(
                    ethers.constants.AddressZero,
                    ethers.utils.parseEther("2"),
                    tokenA.address,
                    ethers.utils.parseEther("6"),
                );
                // fill order with actor 2. should revert because actor 1 does not have enough token
                await expect(obmm.connect(actor2).fillOrder(2)).to.be.revertedWith("Trade failed: Order maker has insufficient token balance");
            });
        });
    });
});