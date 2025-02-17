import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { AutomatedProcess } from "../../typechain-types";


describe("Automated Process", () => {
    let owner: SignerWithAddress;
    let automatedProcess: AutomatedProcess;
    // todo, add other supply chain contracts for testing...
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
            describe("Success", () => {
                it("Stores new provenance contract", async () => {});
                it("Emits SetProvenance event", async () => {});
            });
            describe("Failure", () => {
                it("Reverts when other than owner calls", async () => {});
            });
        });
        describe("Set Process Value", () => {
            describe("Success", () => {
                it("Stores new process value", async () => {});
                it("Emits SetProcessValue event", async () => {});
            });
            describe("Failure", () => {
                it("Reverts when other than provenance calls", async () => {});
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