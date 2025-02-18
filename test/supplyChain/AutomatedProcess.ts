import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { AutomatedProcess, InventoryManagement, Provenance } from "../../typechain-types";
import { BigNumber, ContractReceipt } from "ethers";
import { productRecords, encodeProductId, State } from "../../helpers/provenance";
import { item } from "../../helpers/inventoryManagement";

describe("Automated Process", () => {
    let owner: SignerWithAddress;
    let automatedProcess: AutomatedProcess;
    let provenance: Provenance;
    beforeEach(async () => {
        [owner] = await ethers.getSigners();

        const AutomatedProcess = await ethers.getContractFactory("AutomatedProcess");
        automatedProcess = await AutomatedProcess.deploy();
        await automatedProcess.deployed();

        // deploy provenance contract
        const Provenance = await ethers.getContractFactory("Provenance");
        provenance = await Provenance.deploy();

        // set provenance contract on automated process
        await automatedProcess.connect(owner).setProvenance(provenance.address);
        // set automated process on provenance contract (all testing for provenance contract is done in its own test file)
        await provenance.connect(owner).setAutomatedProcess(automatedProcess.address);
    });

    describe("Deployment", () => {
        it("Should set the right owner", async () => {
            expect(await automatedProcess.owner()).to.equal(owner.address);
        });
    });

    describe("Provenance", () => {
        describe("Set Provenance", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // it was set in the very top beforeEach
                expect(await automatedProcess.provenance()).to.equal(provenance.address);
                // unset provenance contract
                await automatedProcess.connect(owner).setProvenance(ethers.constants.AddressZero);
                // assert its unset (default value when deployed)
                expect(await automatedProcess.provenance()).to.equal(ethers.constants.AddressZero);
                // set provenance contract
                const tx = await automatedProcess.connect(owner).setProvenance(provenance.address);
                receipt = await tx.wait();
            });
            describe("Success", () => {
                it("Stores new provenance contract", async () => {
                    expect(await automatedProcess.provenance()).to.equal(provenance.address);
                });
                it("Emits SetProvenance event", async () => {
                    // find event
                    const event = receipt.events?.find((event) => event.event === "SetProvenance");
                    // assert event exists
                    expect(event).to.not.be.undefined;
                    // assert event values, redundant to 👆🏾 but good practice
                    expect(event?.event).to.equal("SetProvenance");
                    expect(event?.args?.provenance).to.equal(provenance.address);
                });
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {
                    let otherThanOwner = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanOwner).setProvenance(ethers.constants.AddressZero) // couldve been any address
                    ).to.be.revertedWith("Not authorized");
                });
            });
        });
        describe("Set Process Value", () => {
            describe("Success", () => {
                let receipt: ContractReceipt;
                const processValue = ethers.utils.parseEther('5');
                // nonce is created from provenance contract, passed in as argument. so we can make it arbitrary for testing
                const nonce = 1; 
                let recordCreator: SignerWithAddress;
                const product = productRecords[0];
                beforeEach(async () => {
                    recordCreator = (await ethers.getSigners())[1];
                    // to call setProcessValue we have to call createRecord on provenance contract.
                    const tx = await provenance.connect(recordCreator).createRecord(
                        product.productName,
                        product.variety,
                        product.productType,
                        product.timestamp,
                        product.location,
                        product.state,
                        product.additionalInfo,
                        { value: processValue }
                    );
                    receipt = await tx.wait();
                });
                it("Stores new process value", async () => {
                    expect(
                        await automatedProcess.processValues(
                            recordCreator.address, 
                            nonce
                        )
                    ).to.equal(processValue);
                });
                it("Receives process value", async () => {
                    // get ether balance of automated process contract
                    expect(
                        await ethers.provider.getBalance(automatedProcess.address)
                    ).to.equal(processValue);
                });
                it("Emits SetProcessValue event", async () => {
                    const blockNumber = receipt.blockNumber!;
                    const filter = {
                        address: automatedProcess.address,  // or whichever contract you're interested in
                        fromBlock: blockNumber,
                        toBlock: blockNumber,
                        topics: [ethers.utils.id("SetProcessValue(address,uint256,uint256)")]
                    };
                    const logs = await ethers.provider.getLogs(filter);
                    const parsedLog = automatedProcess.interface.parseLog(logs[0]);
                    // console.log(parsedLog); 
                    expect(parsedLog.eventFragment.type).to.equal("event");
                    expect(parsedLog.name).to.equal("SetProcessValue");
                    const args = parsedLog.args;
                    expect(args.nonce).to.equal(nonce);
                    expect(args.value).to.equal(processValue);
                    expect(args.actor).to.equal(recordCreator.address);
                });
            });
            describe("Failure", () => {
                it("Reverts when other than provenance calls", async () => {
                    const otherThanProvenance = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanProvenance).setProcessValue(1, otherThanProvenance.address, { value: 0 })
                    ).to.be.revertedWith("Not authorized");
                });
                it("Reverts when provenance contract not set", async () => {
                    // unset provenance contract
                    await automatedProcess.connect(owner).setProvenance(ethers.constants.AddressZero);
                    let otherThanProvenance = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanProvenance).setProcessValue(1, otherThanProvenance.address, { value: 0 })
                    ).to.be.revertedWith("Provenance not set");
                });
            });
        });
        describe("Release Process Value", () => {
            let receipt: ContractReceipt;
            let recordCreator: SignerWithAddress;
            const processValue = ethers.utils.parseEther('5');
            const nonce = 1;
            const product = productRecords[0];
            let ownerBalanceBefore: BigNumber;
            let productId: Uint8Array;
            beforeEach(async () => {
                recordCreator = (await ethers.getSigners())[1];
                // create order, sets process value
                let tx = await provenance.connect(recordCreator).createRecord(
                    product.productName,
                    product.variety,
                    product.productType,
                    product.timestamp,
                    product.location,
                    product.state,
                    product.additionalInfo,
                    { value: processValue }
                );
                await tx.wait();
                // update order to "Completed"
                productId = ethers.utils.arrayify(encodeProductId(recordCreator.address, nonce));
                tx = await provenance.connect(recordCreator).updateRecord(
                    productId,
                    123457, // timestamp
                    'here', // location
                    State.Completed,
                    "Completed order"
                );
                await tx.wait();
                // get owner balance before release
                ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
                // release process value
                tx = await automatedProcess.connect(owner).releaseProcessValue(nonce, recordCreator.address);
                receipt = await tx.wait();
            });
            describe("Success", () => {
                it("Gives process value to owner", async () => {
                    expect(await owner.getBalance()).to.be.gt(ownerBalanceBefore);
                });
                it("Resets process value", async () => {
                    expect(await automatedProcess.processValues(recordCreator.address, nonce)).to.equal(0);
                });
                it("Emits ReleaseProcessValue event", async () => {
                    // find event
                    const event = receipt.events?.find((event) => event.event === "ReleaseProcessValue");
                    // assert event exists
                    expect(event).to.not.be.undefined;
                    // assert event values, redundant to 👆🏾 but good practice
                    expect(event?.event).to.equal("ReleaseProcessValue");
                    const args = event?.args!;
                    expect(args.actor).to.equal(recordCreator.address);
                    expect(args.nonce).to.equal(nonce);
                    expect(args.value).to.equal(processValue);
                });
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {
                    let otherThanOwner = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanOwner).releaseProcessValue(1, otherThanOwner.address)
                    ).to.be.revertedWith("Not authorized");
                });
                it("Reverts when provenance contract not set", async () => {
                    // unset
                    await automatedProcess.connect(owner).setProvenance(ethers.constants.AddressZero);
                    await expect(
                        automatedProcess.connect(owner).releaseProcessValue(1, owner.address)
                    ).to.be.revertedWith("Provenance not set");
                });
                it("Reverts when no process value to release", async () => {
                    // dont set process value
                    await expect(
                        automatedProcess.connect(owner).releaseProcessValue(1, owner.address)
                    ).to.be.revertedWith("No value to release");
                });
                it("Reverts when provenance state not 'Completed'", async () => {
                    // create order, but dont complete it
                    await provenance.connect(recordCreator).createRecord(
                        product.productName,
                        product.variety,
                        product.productType,
                        product.timestamp,
                        product.location,
                        product.state,
                        product.additionalInfo,
                        { value: processValue }
                    );
                    await expect(
                        automatedProcess.connect(owner).releaseProcessValue(2, recordCreator.address)
                    ).to.be.revertedWith("Provenance state not Completed");
                });
            });
        });
    });


    describe("Inventory Management", () => {
        describe("Set Inventory Management", () => {
            describe("Success", () => {
                let receipt: ContractReceipt;
                let inventoryManagement: InventoryManagement;
                beforeEach(async () => {
                    // deploy inventory management contract
                    const InventoryManagement = await ethers.getContractFactory("InventoryManagement");
                    inventoryManagement = await InventoryManagement.deploy();
                    // assert inventory management contract not set
                    expect(await automatedProcess.inventoryManagement()).to.equal(ethers.constants.AddressZero);
                    // set inventory management contract
                    const tx = await automatedProcess.connect(owner).setInventoryManagement(
                        inventoryManagement.address
                    );
                    receipt = await tx.wait();
                });
                it("Stores new Inventory Management contract", async () => {
                    expect(await automatedProcess.inventoryManagement()).to.equal(inventoryManagement.address);
                });
                it("Emits SetInventoryManagement event", async () => {
                    // find event
                    const event = receipt.events?.find((event) => event.event === "SetInventoryManagement");
                    // assert event exists
                    expect(event).to.not.be.undefined;
                    // assert event values, redundant to 👆🏾 but good practice
                    expect(event?.event).to.equal("SetInventoryManagement");
                    expect(event?.args?.inventoryManagement).to.equal(inventoryManagement.address);
                });
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {
                    const otherThanOwner = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(
                            otherThanOwner
                        ).setInventoryManagement(
                            ethers.constants.AddressZero
                        )
                    ).to.be.revertedWith("Not authorized");
                });
            });
        });
        describe("Update Stock", () => {
            describe("Success", () => {
                let receipt: ContractReceipt;
                let inventoryManagement: InventoryManagement;
                beforeEach(async () => {
                    // deploy inventory management contract
                    const InventoryManagement = await ethers.getContractFactory("InventoryManagement");
                    inventoryManagement = await InventoryManagement.deploy();
                    // set inventory management contract
                    await automatedProcess.connect(owner).setInventoryManagement(
                        inventoryManagement.address
                    );
                    // set AP contract on IM contract
                    await inventoryManagement.connect(owner).setAutomatedProcess(automatedProcess.address);
                    // set IM contract on AP contract
                    await automatedProcess.connect(owner).setInventoryManagement(inventoryManagement.address);
                    // register item
                    await inventoryManagement.connect(owner).registerItem(
                        item.name,
                        item.description,
                        item.reorderThreshold
                    );
                    // assert item exists
                    const registeredItem = await inventoryManagement.items(1);
                    expect(registeredItem.name).to.equal(item.name);
                    // assert item has 0 quantity
                    expect(registeredItem.quantity).to.equal(0);
                    // update stock
                    const tx = await automatedProcess.connect(owner).updateStock(
                        1, // item id
                        1, // quantity
                        0, // inbound movement type
                        "location",
                        'note'
                    );
                    receipt = await tx.wait();
                });
                it("Updates stock on Inventory Management contract", async () => {
                    const registeredItem = await inventoryManagement.items(1);
                    expect(registeredItem.quantity).to.equal(1);
                });
                it("Emits UpdatedStock event", async () => {
                    // get event
                    const event = receipt.events?.find((event) => event.event === "UpdatedStock");
                    // assert event exists
                    expect(event).to.not.be.undefined;
                    // assert event values, redundant to 👆🏾 but good practice
                    expect(event?.event).to.equal("UpdatedStock");
                    const args = event?.args!;
                    expect(args.itemId).to.equal(1);
                    expect(args.quantity).to.equal(1);
                    expect(args.movementType).to.equal(0);
                });
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {
                    const otherThanOwner = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanOwner).updateStock(
                            1, // item id
                            1, // quantity
                            0, // inbound movement type
                            "location",
                            'note'
                        )
                    ).to.be.revertedWith("Not authorized");
                });
                it("Reverts when Inventory Management contract not set", async () => {
                    await expect(
                        automatedProcess.connect(owner).updateStock(
                            1, // item id
                            1, // quantity
                            0, // inbound movement type
                            "location",
                            'note'
                        )
                    ).to.be.revertedWith("Inventory management not set");
                });
            });
        });
    });
});
