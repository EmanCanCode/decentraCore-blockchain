import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { AutomatedProcess, Provenance } from "../../typechain-types";
import { encodeProductId, productRecords, State } from "../../helpers/provenance";
import { ContractReceipt } from "ethers";


describe("Provenance", () => {
    let owner: SignerWithAddress;
    let automatedProcess: AutomatedProcess;
    let provenance: Provenance;

    beforeEach(async () => {
        // get signers
        [owner] = await ethers.getSigners();
        // deploy AutomatedProcess
        const AutomatedProcessFactory = await ethers.getContractFactory("AutomatedProcess");
        automatedProcess = await AutomatedProcessFactory.deploy();
        await automatedProcess.deployed();
        // deploy Provenance
        const ProvenanceFactory = await ethers.getContractFactory("Provenance");
        provenance = await ProvenanceFactory.deploy();
        await provenance.deployed();
        // set automatedProcess address
        await provenance.connect(owner).setAutomatedProcess(automatedProcess.address);
        // set provenance address on the Automated Process contract
        await automatedProcess.connect(owner).setProvenance(provenance.address);
    });
    
    describe("Deployment", () => {
        it("Should set the right owner", async () => {
            expect(await provenance.owner()).to.equal(owner.address);
        });
    });

    describe("Create Record", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            let recordCreator: SignerWithAddress;
            const product = productRecords[0];
            const processValue = ethers.utils.parseEther("5");
            let productId: string;
            beforeEach(async () => {
                // get record creator
                recordCreator = (await ethers.getSigners())[1];
                // assert the nonce is 0 (no records created yet)
                expect(await provenance.nonce(recordCreator.address)).to.equal(0);
                // assert that product history is empty for nonce 1 (as that is the nonce that will be used)
                productId = encodeProductId(recordCreator.address, 1);
                const productHistory = await provenance.getHistory(productId);
                expect(productHistory.length).to.equal(0);
                // create a record
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
            it("Increases the nonce", async () => {
                expect(await provenance.nonce(recordCreator.address)).to.equal(1);
            });
            it("Creates a new product history record using product id", async () => {
                const productHistory = await provenance.getHistory(productId);
                // console.log(productHistory);
                expect(productHistory.length).to.equal(1);
            });
            it("Sets process value on Automated Process contract", async () => {
                expect(await automatedProcess.processValues(recordCreator.address, 1)).to.equal(processValue);
            });
            it("Emits CreatedRecord event", async () => {
                // find event
                let event = receipt.events?.find((event) => event.event === "CreatedRecord");
                // assert event exists
                expect(event).to.not.be.undefined;
                event = event!;
                // redunant but good practice
                expect(event.event).to.equal("CreatedRecord");
                // assert event data
                const args = event.args!;
                expect(args.productName).to.equal(product.productName);
                expect(args.variety).to.equal(product.variety);
                expect(args.productType).to.equal(product.productType);
                expect(args.timestamp).to.equal(product.timestamp);
                expect(args.location).to.equal(product.location);
                expect(args.state).to.equal(product.state);
                expect(args.additionalInfo).to.equal(product.additionalInfo);
                expect(args.recordCreator).to.equal(recordCreator.address);
                expect(args.nonce).to.equal(1);
                expect(args.value).to.equal(processValue);
                // makes it easier to compare product id in lower case
                expect(args.productId.toLowerCase()).to.equal(productId.toLowerCase());
            });
        });
        describe("Failure", () => {
            it("Reverts when Automated Process contract is not set", async () => {
                // unset automatedProcess, this should cause the transaction to revert
                await provenance.connect(owner).setAutomatedProcess(ethers.constants.AddressZero);
                const product = productRecords[0];
                await expect(
                    provenance.connect(owner).createRecord(
                        product.productName,
                        product.variety,
                        product.productType,
                        product.timestamp,
                        product.location,
                        product.state,
                        product.additionalInfo
                    )
                ).to.be.revertedWith("Automated Process not set");
            });
        });
    });
    
    describe("Set Automated Process", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                const tx = await provenance.connect(owner).setAutomatedProcess(owner.address);
                receipt = await tx.wait();
            });
            it("Sets Automated Process", async () => {
                expect(await provenance.automatedProcess()).to.equal(owner.address);
            });
            it("Emits SetAutomatedProcess event", async () => {
                // find event
                let event = receipt.events?.find((event) => event.event === "SetAutomatedProcess");
                // assert event exists
                expect(event).to.not.be.undefined;
                event = event!;
                // redunant but good practice
                expect(event.event).to.equal("SetAutomatedProcess");
                // assert event data
                const args = event.args!;
                expect(args.automatedProcess).to.equal(owner.address);
            });
        });
        describe("Failure", () => {
            it("Reverts when other than owner calls", async () => {
                const otherThanOwner = (await ethers.getSigners())[1];
                await expect(
                    provenance.connect(otherThanOwner).setAutomatedProcess(otherThanOwner.address)
                ).to.be.revertedWith("Only the owner can set the automated process");
            });
        });
    });

    describe("Update Record", () => {
        let receipt: ContractReceipt;
        let recordCreator: SignerWithAddress;
        let product = productRecords[0];
        const completedState: State = State.Completed;
        const processValue = ethers.utils.parseEther("5");
        let productId: Uint8Array;
        beforeEach(async () => {
            // create record
            recordCreator = (await ethers.getSigners())[1];
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
            // assert that product history length is 1
            productId = ethers.utils.arrayify(encodeProductId(recordCreator.address, 1));
            let productHistory = await provenance.getHistory(productId);
            expect(productHistory.length).to.equal(1);

            // update record with owner
            // THIS IS BREAKING THE TEST
            await provenance.connect(recordCreator).updateRecord(
                productId,
                product.timestamp + 1,
                '0x000001',
                State.InTransit,
                "Shipped to the first location"
            );
            // assert the length of product history is 2
            productHistory = await provenance.getHistory(productId);
            expect(productHistory.length).to.equal(2);
            // update record with record creator
            const tx = await provenance.connect(recordCreator).updateRecord(
                productId,
                product.timestamp + 2,
                '0x000002',
                completedState,
                "Received at the final location"
            );
            receipt = await tx.wait();
        });
        describe("Success", () => {
            it("Updates by adding record", async () => {
                const productHistory = await provenance.getHistory(productId);
                // console.log(productHistory);
                expect(productHistory.length).to.equal(3);
            });
            it("Emits UpdatedRecord event", async () => {
                // find event
                let event = receipt.events?.find((event) => event.event === "UpdatedRecord");
                // assert event exists
                expect(event).to.not.be.undefined;
                event = event!;
                // redunant but good practice
                expect(event.event).to.equal("UpdatedRecord");
                // assert event data
                const args = event.args!;
                expect(args.productId).to.equal(ethers.utils.hexlify(productId));
                expect(args.timestamp).to.equal(product.timestamp + 2);
                expect(args.location).to.equal('0x000002');
                expect(args.state).to.equal(completedState);
                expect(args.additionalInfo).to.equal("Received at the final location");
                expect(args.recordUpdater).to.equal(recordCreator.address);  // could be owner as well thats why we are checking the address
            });
        });
        describe("Failure", () => {
            it("Reverts when no record found for product id", async () => {
                // different nonce used to create product id
                const fakeProductId = ethers.utils.arrayify(encodeProductId(recordCreator.address, 2));
                // this is cheeky bc i check for the length of the product history before i check if its completed
                // as this is completed in the beforeEach. nonetheless, this is a valid test 
                await expect(
                    provenance.connect(recordCreator).updateRecord(
                        fakeProductId,
                        product.timestamp + 1,
                        '0x000001',
                        State.InTransit,
                        "Shipped to the first location"
                    )
                ).to.be.revertedWith("No record found for this product ID");
            });
            it("Reverts when other than owner or record creator calls", async () => {
                const otherThanOwnerOrRecordCreator = (await ethers.getSigners())[2];
                await expect(
                    provenance.connect(otherThanOwnerOrRecordCreator).updateRecord(
                        productId,
                        product.timestamp + 1,
                        '0x000001',
                        State.InTransit,
                        "Shipped to the first location"
                    )
                ).to.be.revertedWith("Only the owner or the creator of the record can update it");
            });
            it("Reverts when in 'Completed' state", async () => {
                // try to pass the same product id to updateRecord
                await expect(
                    provenance.connect(recordCreator).updateRecord(
                        productId,
                        product.timestamp + 1,
                        '0x000001',
                        State.InTransit,
                        "Shipped to the first location"
                    )
                ).to.be.revertedWith("Cannot update a record that is in the 'Completed' state");
            });
        });
    });
});