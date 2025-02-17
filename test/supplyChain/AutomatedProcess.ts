import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { AutomatedProcess } from "../../typechain-types";
import { ContractReceipt } from "ethers";


describe("Automated Process", () => {
    let owner: SignerWithAddress;
    let automatedProcess: AutomatedProcess;
    beforeEach(async () => {
        [owner] = await ethers.getSigners();

        const AutomatedProcess = await ethers.getContractFactory("AutomatedProcess");
        automatedProcess = await AutomatedProcess.deploy();
        await automatedProcess.deployed();
    });

    describe("Deployment", () => {
        it("Should set the right owner", async () => {
            expect(await automatedProcess.owner()).to.equal(owner.address);
        });
    });

    describe("Provenance", () => {
        describe("Set Provenance", () => {
            let receipt: ContractReceipt;
            let provenanceContractAddress: string;
            beforeEach(async () => {
                // set provenance contract
                // we can make it arbitrary for testing bc we are not testing the provenance contract here
                provenanceContractAddress = (await ethers.getSigners())[1].address;
                // assert provenance contract not set
                expect(await automatedProcess.provenance()).to.equal(ethers.constants.AddressZero);
                const tx = await automatedProcess.connect(owner).setProvenance(provenanceContractAddress);
                receipt = await tx.wait();
            });
            describe("Success", () => {
                it("Stores new provenance contract", async () => {
                    expect(await automatedProcess.provenance()).to.equal(provenanceContractAddress);
                });
                it("Emits SetProvenance event", async () => {
                    // find event
                    const event = receipt.events?.find((event) => event.event === "SetProvenance");
                    // assert event exists
                    expect(event).to.not.be.undefined;
                    // assert event values, redundant to 👆🏾 but good practice
                    expect(event?.event).to.equal("SetProvenance");
                    expect(event?.args?.provenance).to.equal(provenanceContractAddress);
                });
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {
                    let otherThanOwner = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanOwner).setProvenance(provenanceContractAddress)
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
                let provenance: Provenance_;
                let recipient: SignerWithAddress;
                beforeEach(async () => {
                    // set provenance contract
                    [provenance, recipient]  = (await ethers.getSigners());  // wink wink, nudge nudge. check the bottom of the file
                    // no need to assert as we have already tested this in the previous test                    
                    await automatedProcess.connect(owner).setProvenance(provenance.address);
                    // assert process value not set
                    expect(await automatedProcess.processValues(recipient.address, nonce)).to.equal(0);
                    // set process value
                    const tx = await automatedProcess.connect(provenance).setProcessValue(
                        nonce, 
                        recipient.address, 
                        { value: processValue }
                    );
                    receipt = await tx.wait();
                });
                it("Stores new process value", async () => {
                    expect(await automatedProcess.processValues(recipient.address, nonce)).to.equal(processValue);
                });
                it("Emits SetProcessValue event", async () => {
                    // find event
                    const event = receipt.events?.find((event) => event.event === "SetProcessValue");
                    // assert event exists
                    expect(event).to.not.be.undefined;
                    // assert event values, redundant to 👆🏾 but good practice
                    expect(event?.event).to.equal("SetProcessValue");
                    expect(event?.args?.recipient).to.equal(recipient.address);
                    expect(event?.args?.nonce).to.equal(nonce);
                    expect(event?.args?.value).to.equal(processValue);
                });
            });
            describe("Failure", () => {
                it("Reverts when other than provenance calls", async () => {
                    const provenance = (await ethers.getSigners())[1];
                    // set provenance contract
                    await automatedProcess.connect(owner).setProvenance(provenance.address);
                    const otherThanProvenance = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanProvenance).setProcessValue(1, otherThanProvenance.address, { value: 0 })
                    ).to.be.revertedWith("Not authorized");
                });
                it("Reverts when provenance contract not set", async () => {
                    let otherThanProvenance = (await ethers.getSigners())[2];
                    await expect(
                        automatedProcess.connect(otherThanProvenance).setProcessValue(1, otherThanProvenance.address, { value: 0 })
                    ).to.be.revertedWith("Provenance not set");
                });
            });
        });
        describe("Release Process Value", () => {
            describe("Success", () => {
                it("Stores new process value", async () => {});
                it("Emits SetProcessValue event", async () => {});
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {});
                it("Reverts when provenance contract not set", async () => {});
                it("Reverts when no process value to release", async () => {});
                it("Reverts when provenance state not 'Completed'", async () => {});
            });
        });
    });


    describe("Inventory Management", () => {
        describe("Set Inventory Management", () => {
            describe("Success", () => {
                it("Stores new Inventory Management contract", async () => {});
                it("Emits SetInventoryManagement event", async () => {});
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {});
            });
        });
        describe("Update Stock", () => {
            describe("Success", () => {
                it("Updates stock on Inventory Management contract", async () => {});
                it("Emits UpdatedStock event", async () => {});
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {});
                it("Reverts when Inventory Management contract not set", async () => {});
            });
        });
    });
});

interface Provenance_ extends SignerWithAddress {};