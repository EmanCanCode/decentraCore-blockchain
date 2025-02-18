import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { InventoryManagement } from "../../typechain-types";
import { ContractReceipt } from "ethers";
import { item } from "../../helpers/inventoryManagement";


describe("Inventory Management", () => {
    let owner: SignerWithAddress;
    let inventoryManagement: InventoryManagement;
    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        const InventoryManagementFactory = await ethers.getContractFactory("InventoryManagement", owner);
        inventoryManagement = await InventoryManagementFactory.deploy();
        await inventoryManagement.deployed();

        // have owner set automated process to its own address
        await inventoryManagement.connect(owner).setAutomatedProcess(owner.address);
    });

    describe("Deployment", () => {
        it("Sets the owner", async () => {
            expect(await inventoryManagement.owner()).to.equal(owner.address);
        });
        it("Sets the next item's id", async () => {
            expect(await inventoryManagement.nextItemId()).to.equal(1);
        });
    });

    describe("Set Automated Process", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // prove it was set in the very beginning
                expect(await inventoryManagement.automatedProcess()).to.equal(owner.address);
                await inventoryManagement.connect(owner).setAutomatedProcess(ethers.constants.AddressZero);
                // assert it was set to zero
                expect(await inventoryManagement.automatedProcess()).to.equal(ethers.constants.AddressZero);
                const tx = await inventoryManagement.connect(owner).setAutomatedProcess(owner.address);
                receipt = await tx.wait();
            });
            it("Stores Automotive Process contract address", async () => {
                expect(await inventoryManagement.automatedProcess()).to.equal(owner.address);
            });
            it("Emits SetAutomatedProcess event", async () => {
                // find event
                const event = receipt.events?.find((event) => event.event === "SetAutomatedProcess");
                // assert event exists
                expect(event).to.not.be.undefined;
                // assert event name redundant but for clarity
                expect(event?.event).to.equal("SetAutomatedProcess");
                // assert event args
                expect(event?.args?.automatedProcess).to.equal(owner.address);
            });
        });
        describe("Failure", () => {
            it("Reverts when other than owner calls", async () => {
                const otherThanOwner = (await ethers.getSigners())[1];
                await expect(
                    inventoryManagement.connect(
                        otherThanOwner
                    ).setAutomatedProcess(otherThanOwner.address)
                ).to.be.revertedWith("Not Authorized");
            });
        });
    });

    describe("Register Item", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // assert no items registered
                const registeredItems = await inventoryManagement.items(1);
                expect(registeredItems.name).to.equal("");
                // assert next item id is 1
                expect(await inventoryManagement.nextItemId()).to.equal(1);
                // register item
                const tx = await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                receipt = await tx.wait();
            });
            it("Stores newly registered item by item id", async () => {
                const registeredItem = await inventoryManagement.items(1);
                expect(registeredItem.name).to.equal(item.name);
                expect(registeredItem.description).to.equal(item.description);
                expect(registeredItem.reorderThreshold).to.equal(item.reorderThreshold);
                expect(registeredItem.quantity).to.equal(0);
            });
            it("Increments the next item's id", async () => {
                expect(await inventoryManagement.nextItemId()).to.equal(2);
            });
            it("Emits ItemRegistered event", async () => {
                // find event
                const event = receipt.events?.find((event) => event.event === "ItemRegistered");
                // assert event exists
                expect(event).to.not.be.undefined;
                // assert event name redundant but for clarity
                expect(event?.event).to.equal("ItemRegistered");
                // assert event args
                expect(event?.args?.itemId).to.equal(1);
                expect(event?.args?.name).to.equal(item.name);
                expect(event?.args?.description).to.equal(item.description);
                expect(event?.args?.reorderThreshold).to.equal(item.reorderThreshold);
            });
        });
        describe("Failure", () => {
            it("Reverts when other than owner calls", async () => {
                const otherThanOwner = (await ethers.getSigners())[1];
                await expect(
                    inventoryManagement.connect(
                        otherThanOwner
                    ).registerItem(item.name, item.description, item.reorderThreshold)
                ).to.be.revertedWith("Not Authorized");
            });
        });
    });

    describe("Update Stock", () => {
        describe("Success", () => {
            beforeEach(async () => {
                // add item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
            });
            it("Adds to item quantity when movement is 'Inbound'", async () => {
                // assert quantity is 0
                const registeredItem = await inventoryManagement.items(1);
                expect(registeredItem.quantity).to.equal(0);
                // update stock
                await inventoryManagement.connect(owner).updateStock(
                    1,
                    1,
                    0, // 0 is for 'Inbound' movement type
                    'location',
                    'note'
                );
                // assert quantity is 1
                const updatedItem = await inventoryManagement.items(1);
                expect(updatedItem.quantity).to.equal(1);
            });
            it("Subtracts from item quantity when movement is 'Outbound'", async () => {
                // add stock
                await inventoryManagement.connect(owner).updateStock(
                    1,
                    1,
                    0, // 0 is for 'Inbound' movement type
                    'location',
                    'note'
                );
                // assert quantity is 1
                let updatedItem = await inventoryManagement.items(1);
                expect(updatedItem.quantity).to.equal(1);
                // remove stock
                await inventoryManagement.connect(owner).updateStock(
                    1,
                    1,
                    1, // 1 is for 'Outbound' movement type
                    'location',
                    'note'
                );
                // assert quantity is 0
                updatedItem = await inventoryManagement.items(1);
                expect(updatedItem.quantity).to.equal(0);
            });
            it("Changes item quantity when movement is 'Adjustment'", async () => {
                // add 5 stock
                await inventoryManagement.connect(owner).updateStock(
                    1,
                    5,
                    0, // 0 is for 'Inbound' movement type
                    'location',
                    'note'
                );
                // assert quantity is 5
                let updatedItem = await inventoryManagement.items(1);
                expect(updatedItem.quantity).to.equal(5);
                // now adjust stock to 10 
                await inventoryManagement.connect(owner).updateStock(
                    1,
                    10,
                    3, // 3 is for 'Adjustment' movement type
                    'location',
                    'note'
                );
                // assert quantity is 10
                updatedItem = await inventoryManagement.items(1);
                expect(updatedItem.quantity).to.equal(10);
            });
            it("Stores inventory managament transaction", async () => {
                // assert transactions array is empty
                let transactions = await inventoryManagement.getTransactionHistory(1);
                expect(transactions.length).to.equal(0);
                // add stock
                await inventoryManagement.connect(owner).updateStock(
                    1,
                    1,
                    0, // 0 is for 'Inbound' movement type
                    'location',
                    'note'
                );
                // assert transaction is stored
                transactions = await inventoryManagement.getTransactionHistory(1);
                expect(transactions.length).to.equal(1);
            });
            it("Emits StockUpdated event", async () => {
                // add stock
                const tx = await inventoryManagement.connect(owner).updateStock(
                    1,
                    1,
                    0, // 0 is for 'Inbound' movement type
                    'location',
                    'note'
                );
                const receipt = await tx.wait();
                // find event
                const event = receipt.events?.find((event) => event.event === "StockUpdated");
                // assert event exists
                expect(event).to.not.be.undefined;
                // assert event name redundant but for clarity
                expect(event?.event).to.equal("StockUpdated");
                // assert event args
                const args = event?.args!;
                expect(args.itemId).to.equal(1);
                expect(args.newQuantity).to.equal(1);
                expect(args.movementType).to.equal(0);
                // get block
                const block = await ethers.provider.getBlock(receipt.blockNumber!);
                expect(args.timestamp).to.equal(block.timestamp);
                expect(args.note).to.equal("note");
            });
        });
        describe("Failure", () => {
            it("Reverts when non-registered item id is passed", async () => {
                await expect(
                    inventoryManagement.connect(owner).updateStock(
                        1,
                        1,
                        1,
                        'location',
                        'note'
                    )
                ).to.be.revertedWith("Item does not exist");
            });
            it("Reverts when Automated Process contract is not set, when other than owner calls", async () => {
                // register item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                const otherThanOwner = (await ethers.getSigners())[1];
                await inventoryManagement.connect(owner).setAutomatedProcess(ethers.constants.AddressZero);
                await expect(
                    inventoryManagement.connect(otherThanOwner).updateStock(
                        1,
                        1,
                        1,
                        'location',
                        'note'
                    )
                ).to.be.revertedWith("Automated Process not set");

            });
            it("Reverts when other than Automated Process and owner calls", async () => {
                const otherThanOwner = (await ethers.getSigners())[1];
                // register item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                await expect(
                    inventoryManagement.connect(otherThanOwner).updateStock(
                        1,
                        1,
                        1,
                        'location',
                        'note'
                    )
                ).to.be.revertedWith("Only the Automated Process can call this function");
            });
            it("Reverts when insufficient stock on 'Outbound' movement type", async () => {
                // add item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                // take advantage of the fact that when item is added quantity is set to 0
                await expect(
                    inventoryManagement.connect(owner).updateStock(
                        1,
                        1,
                        1,  // 1 is for 'Outbound' movement type
                        'location',
                        'note'
                    )
                ).to.be.revertedWith("Insufficient stock");
            });
        });
    });

    describe("Transfer Item", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // add item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                // assert transaction array is empty
                let transactions = await inventoryManagement.getTransactionHistory(1);
                expect(transactions.length).to.equal(0);
                // add stock
                await inventoryManagement.connect(owner).updateStock(
                    1,
                    1,
                    0, // 0 is for 'Inbound' movement type
                    'location',
                    'note'
                );
                // assert quantity is 1
                let updatedItem = await inventoryManagement.items(1);
                expect(updatedItem.quantity).to.equal(1);
                // transfer item
                const tx = await inventoryManagement.connect(owner).transferItem(
                    1,
                    1,
                    "From Location",
                    "To Location",
                    "Note"
                );
                receipt = await tx.wait();
            });
            it("Stores item transaction", async () => {
                // assert transaction array is not empty
                let transactions = await inventoryManagement.getTransactionHistory(1);
                expect(transactions.length).to.equal(2);
                // assert the movement type of the last transaction is 'Transfer'
                const lastTransaction = transactions[1];
                expect(lastTransaction.movementType).to.equal(2);
            });
            it("Emits ItemTransferred event", async () => {
                const event = receipt.events?.find((event) => event.event === "ItemTransferred");
                // assert event exists
                expect(event).to.not.be.undefined;
                // assert event name redundant but for clarity
                expect(event?.event).to.equal("ItemTransferred");
                // assert event args
                const args = event?.args!;
                /*
                    event ItemTransferred(uint256 indexed itemId, uint256 quantity, string fromLocation, string toLocation, uint256 timestamp, string note);
                */
                expect(args.itemId).to.equal(1);
                expect(args.quantity).to.equal(1);
                expect(args.fromLocation).to.equal("From Location");
                expect(args.toLocation).to.equal("To Location");
                // get block
                const block = await ethers.provider.getBlock(receipt.blockNumber!);
                expect(args.timestamp).to.equal(block.timestamp);
                expect(args.note).to.equal("Note");
            });
        });
        describe("Failure", () => {
            it("Reverts when other than owner calls", async () => {
                const otherThanOwner = (await ethers.getSigners())[1];
                await expect(
                    inventoryManagement.connect(otherThanOwner).transferItem(
                        1,
                        1,
                        "From Location",
                        "To Location",
                        "Note"
                    )
                ).to.be.revertedWith("Not Authorized");
            });
            it("Reverts when item is not registered", async () => {
                await expect(
                    inventoryManagement.connect(owner).transferItem(
                        1,
                        1,
                        "From Location",
                        "To Location",
                        "Note"
                    )
                ).to.be.revertedWith("Item does not exist");
            });
            it("Reverts when insufficient stock", async () => {
                // add item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                // take advantage of the fact that when item is added quantity is set to 0
                await expect(
                    inventoryManagement.connect(owner).transferItem(
                        1,
                        1,
                        "From Location",
                        "To Location",
                        "Note"
                    )
                ).to.be.revertedWith("Insufficient stock");
            });
        });
    });

    describe("Set Reorder Threshold", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // add item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                // assert item's reorder threshold is 10
                const registeredItem = await inventoryManagement.items(1);
                expect(registeredItem.reorderThreshold).to.equal(10);
                // set new reorder threshold
                const tx = await inventoryManagement.connect(owner).setReorderThreshold(1, 5);
                receipt = await tx.wait();
            });
            it("Stores item's new reorder threshold value", async () => {
                const registeredItem = await inventoryManagement.items(1);
                expect(registeredItem.reorderThreshold).to.equal(5);
            });
            it("Emits SetReorderThreshold event", async () => {
                const event = receipt.events?.find((event) => event.event === "SetReorderThreshold");
                // assert event exists
                expect(event).to.not.be.undefined;
                // assert event name redundant but for clarity
                expect(event?.event).to.equal("SetReorderThreshold");
                // assert event args
                const args = event?.args!;
                expect(args.itemId).to.equal(1);
                expect(args.threshold).to.equal(5);
            });
        });
        describe("Failure", () => {
            it("Reverts when other than owner calls", async () => {
                const otherThanOwner = (await ethers.getSigners())[1];
                await expect(
                    inventoryManagement.connect(otherThanOwner).setReorderThreshold(1, 10)
                ).to.be.revertedWith("Not Authorized");
            });
            it("Reverts when item id is not registered", async () => {
                await expect(
                    inventoryManagement.connect(owner).setReorderThreshold(1, 10)
                ).to.be.revertedWith("Item does not exist");
            });
        });
    });

    describe("Delete Item", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // add item
                await inventoryManagement.connect(owner).registerItem(
                    item.name, 
                    item.description, 
                    item.reorderThreshold
                );
                // assert item is registered
                const registeredItem = await inventoryManagement.items(1);
                expect(registeredItem.name).to.equal(item.name);
                // delete item
                const tx = await inventoryManagement.connect(owner).deleteItem(1);
                receipt = await tx.wait();
            });
            it("Deletes item", async () => {
                const registeredItem = await inventoryManagement.items(1);
                expect(registeredItem.name).to.equal("");
            });
            it("Emits ItemDeleted event", async () => {
                const event = receipt.events?.find((event) => event.event === "ItemDeleted");
                // assert event exists
                expect(event).to.not.be.undefined;
                // assert event name redundant but for clarity
                expect(event?.event).to.equal("ItemDeleted");
                // assert event args
                expect(event?.args?.itemId).to.equal(1);
            });
        });
        describe("Failure", () => {
            it("Reverts when other than owner calls", async () => {
                const otherThanOwner = (await ethers.getSigners())[1];
                await expect(
                    inventoryManagement.connect(otherThanOwner).deleteItem(1)
                ).to.be.revertedWith("Not Authorized");
            });
            it("Reverts when item id is not registered", async () => {
                await expect(
                    inventoryManagement.connect(owner).deleteItem(1)
                ).to.be.revertedWith("Item does not exist");
            });
        });
    });
});