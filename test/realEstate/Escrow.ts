import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Escrow } from "../../typechain-types";
import { RealEstate } from '../../typechain-types/contracts/realEstate/RealEstate';
import { BigNumber, ContractReceipt } from "ethers";

// this is gonna be a long test file... but it's important to test all the edge cases

describe("Escrow", () => {
    let factory: SignerWithAddress;
    let buyer: SignerWithAddress;
    let seller: SignerWithAddress;
    let inspector: SignerWithAddress;
    let lender: SignerWithAddress;
    let appraiser: SignerWithAddress;
    let escrow: Escrow;
    let realEstate: RealEstate;
    let purchasePrice = ethers.utils.parseEther("500");
    let earnestAmount = purchasePrice.mul(1).div(100);  // 1% of purchase price
    beforeEach(async () => {
        // Get the signers
        [
            factory,
            buyer,
            seller,
            inspector,
        ] = await ethers.getSigners();
        // all the same since they just approve the sale. no further contract interaction from them
        lender = appraiser = inspector;
        // seller to deploy real estate (nft erc1155) contract 
        const RealEstate = await ethers.getContractFactory("RealEstate");
        realEstate = await RealEstate.connect(seller).deploy();
        await realEstate.deployed();
        // deploy escrow contract
        const Escrow = await ethers.getContractFactory("Escrow");
        // have factory deploy the escrow contract
        escrow = await Escrow.deploy(
            realEstate.address, // nft address
            1, // nft id
            1, // nft count
            purchasePrice, // purchase price
            earnestAmount, // earnest amount (1%)
            seller.address, // seller
            buyer.address, // buyer
            inspector.address, // inspector
            lender.address, // lender
            appraiser.address, // appraiser
        );
        await escrow.deployed();
        // send the nft to the escrow contract
        await realEstate.connect(seller).safeTransferFrom(seller.address, escrow.address, 1, 1, "0x00");
        // assert that the nft is in the escrow contract
        expect(await realEstate.balanceOf(escrow.address, 1)).to.equal(1);
    });

    describe("Deployment", () => {
        it("Sets state variables", async () => {
            expect(await escrow.factory()).to.equal(factory.address);
            expect(await escrow.nft_address()).to.equal(realEstate.address);
            expect(await escrow.nft_id()).to.equal(1);
            expect(await escrow.nft_count()).to.equal(1);
            expect(await escrow.purchase_price()).to.equal(purchasePrice);
            expect(await escrow.earnest_amount()).to.equal(earnestAmount);
            expect(await escrow.seller()).to.equal(seller.address);
            expect(await escrow.buyer()).to.equal(buyer.address);
            expect(await escrow.inspector()).to.equal(inspector.address);
            expect(await escrow.lender()).to.equal(lender.address);
            expect(await escrow.appraiser()).to.equal(appraiser.address);
            expect(await escrow.state()).to.equal(0);
            expect(inspector.address).to.equal(lender.address); // make sure they are the same
        });
    });

    describe("Deposit Earnest", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // assert that buyer has no balance in escrow
                expect(await escrow.deposit_balance(buyer.address)).to.equal(0);
                // buyer deposits earnest
                const tx = await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                receipt = await tx.wait();
            });
            it("Stores deposit, makes approval implicit", async () => {
                expect(await escrow.deposit_balance(buyer.address)).to.equal(earnestAmount);
            });
            it("Emits Deposit event", async () => {
                const event = receipt.events!.filter((x) => x.event === "Deposit")[0];
                expect(event.event!).to.equal("Deposit");
                const args = event.args!;
                expect(args._from).to.equal(buyer.address);
                expect(args._value).to.equal(earnestAmount);
            });
        });
        describe("Failure", () => {
            it("Reverts when not the correct state when called", async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();

                await expect(escrow.connect(buyer).depositEarnest({ value: earnestAmount })).to.be.revertedWith("Incorrect state");
            });
            it("Reverts when other than buyer deposits earnest", async () => {
                await expect(escrow.connect(seller).depositEarnest({ value: earnestAmount })).to.be.revertedWith("Only buyer can deposit earnest");
            });
            it("Reverts when incorrect amount deposited for earnest", async () => {
                await expect(escrow.connect(buyer).depositEarnest({ value: earnestAmount.div(2) })).to.be.revertedWith("Incorrect earnest amount");
            });
            it("Reverts when earnest already deposited", async () => {
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                await expect(escrow.connect(buyer).depositEarnest({ value: earnestAmount })).to.be.revertedWith("Already deposited");
            });
        });
    });

    describe("Deposit", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            const depositValue = purchasePrice.sub(earnestAmount);
            beforeEach(async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();
                // assert lender has not deposited yet
                expect(await escrow.deposit_balance(lender.address)).to.equal(0);
                // lender deposits
                const tx = await escrow.connect(lender).deposit({ value: depositValue });
                receipt = await tx.wait();
            });
            it("Stores deposit", async () => {
                expect(await escrow.deposit_balance(lender.address)).to.equal(depositValue);
            });
            it("Emits Deposit Event", async () => {
                const event = receipt.events!.filter((x) => x.event === "Deposit")[0];
                expect(event.event!).to.equal("Deposit");
                const args = event.args!;
                expect(args._from).to.equal(lender.address);
                expect(args._value).to.equal(depositValue);
            });
        });
        describe("Failure", () => {
            it("Reverts when not the correct state when called", async () => {
                await expect(escrow.connect(lender).deposit({ value: earnestAmount })).to.be.revertedWith("Incorrect state");
            });
            it("Reverts when not lender or buyer calls", async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();
                // assert lender has not deposited yet
                expect(await escrow.deposit_balance(lender.address)).to.equal(0);
                // other than lender deposits
                await expect(escrow.connect(factory).deposit({ value: earnestAmount })).to.be.revertedWith("Only lender or buyer can deposit");
            });
        });
    });

    describe("Approve Sale", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // assert that seller has not approved sale yet
                expect(await escrow.approval(seller.address)).to.equal(false);
                // seller approves sale
                const tx = await escrow.connect(seller).approveSale();
                receipt = await tx.wait();
            });
            it("Stores approval", async () => {
                expect(await escrow.approval(seller.address)).to.equal(true);
            });
            it("Emits Approval event", async () => {
                const event = receipt.events!.filter((x) => x.event === "Approval")[0];
                expect(event.event!).to.equal("Approval");
                const args = event.args!;
                expect(args._from).to.equal(seller.address);
            });
        });
        describe("Failure", () => {
            it("Reverts when unauthorized actors call", async () => {
                await expect(escrow.connect(factory).approveSale()).to.be.revertedWith("Unauthorized");
            });
            it("Reverts when not the correct state when called", async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();

                await expect(escrow.connect(seller).approveSale()).to.be.revertedWith("Incorrect state");
            });
            it("Reverts when actor is buyer", async () => {
                await expect(escrow.connect(buyer).approveSale()).to.be.revertedWith("use depositEarnest() to approve sale");
            });
        });
    });

    describe("Activate Sale", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                const tx = await escrow.connect(seller).activateSale();
                receipt = await tx.wait();
            });
            it("Stores active state", async () => {
                expect(await escrow.state()).to.equal(1);
            });
            it("Emits ActivatedSale event", async () => {
                const event = receipt.events!.filter((x) => x.event === "ActivatedSale")[0];
                expect(event.event!).to.equal("ActivatedSale");
                expect(event.args!._from).to.equal(seller.address);
            });
        });
        describe("Failure", () => {
            it("Reverts when unauthorized actors call", async () => {
                await expect(escrow.connect(factory).activateSale()).to.be.revertedWith("Unauthorized");
            });
            it("Reverts when not the correct state when called", async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();
                await expect(escrow.connect(seller).activateSale()).to.be.revertedWith("Incorrect state");
            });
            it("Reverts when not all parties approve", async () => {
                await expect(escrow.connect(seller).activateSale()).to.be.revertedWith("Not all parties approved");
            });
        });
    });

    describe("Cancel Sale", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            let userBalanceBefore: BigNumber;
            beforeEach(async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // assert seller does not have the real estate
                expect(await realEstate.balanceOf(seller.address, 1)).to.equal(0);
                // track user balance before
                userBalanceBefore = await buyer.getBalance();
                // cancel sale
                const tx = await escrow.connect(seller).cancelSale();
                receipt = await tx.wait();
            });
            it("Stores cancelled state", async () => {
                expect(await escrow.state()).to.equal(3);
            });
            it("Refunds buyer's earnest", async () => {
                expect(await escrow.deposit_balance(buyer.address)).to.equal(0);
                expect(await buyer.getBalance()).to.equal(userBalanceBefore.add(earnestAmount));
            });
            it("Transfers real estate back to seller", async () => {
                expect(await realEstate.balanceOf(seller.address, 1)).to.equal(1);
            });
            it("Emits Cancelled event", async () => {
                const event = receipt.events!.filter((x) => x.event === "Cancelled")[0];
                expect(event.event!).to.equal("Cancelled");
                expect(event.args!._from).to.equal(seller.address);
            });
        });
        describe("Failure", () => {
            it("Reverts when unauthorized actors call", async () => {
                await expect(escrow.connect(factory).cancelSale()).to.be.revertedWith("Unauthorized");
            });
            it("Reverts when not the correct state when called", async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();
                await expect(escrow.connect(seller).cancelSale()).to.be.revertedWith("Incorrect state");
            });
        });
    });


    describe("Finalize Sale", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            let factoryBalanceBeforeFees: BigNumber;
            let sellerBalanceBeforeSale: BigNumber;
            beforeEach(async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();
                // lender deposits
                await escrow.connect(lender).deposit({ value: purchasePrice.sub(earnestAmount) });
                // set finance contract
                await escrow.connect(lender).setFinanceContract(factory.address); // factory is the finance contract... for testing purposes
                factoryBalanceBeforeFees = await factory.getBalance();
                // get seller balance before sale
                sellerBalanceBeforeSale = await seller.getBalance();
                // assert state is 'Active'
                expect(await escrow.state()).to.equal(1);
                // finalize sale
                const tx = await escrow.connect(buyer).finalizeSale();  // buyer is doing it because gas 
                receipt = await tx.wait();
            });
            it("Updates Completed State", async () => {
                expect(await escrow.state()).to.equal(2);
            });
            it("Sends factory fee", async () => {
                // fee amount was 1% of purchase price
                const feeAmount = purchasePrice.mul(1).div(100);
                expect(await factory.getBalance()).to.equal(factoryBalanceBeforeFees.add(feeAmount));
            });
            it("Sends seller proceeds", async () => {
                // seller proceeds is purchase price minus fee
                const sellerProceeds = purchasePrice.sub(purchasePrice.mul(1).div(100));
                expect(await seller.getBalance()).to.equal(sellerBalanceBeforeSale.add(sellerProceeds));
            });
            it("Transfers real estate to buyer, if not financed", async () => {
                // mint new nft
                await realEstate.connect(seller).mint(seller.address, 2, 1, "" , "0x00");
                // deploy new escrow without lender
                const Escrow = await ethers.getContractFactory("Escrow");
                const escrow = await Escrow.deploy(
                    realEstate.address, // nft address
                    2, // nft id
                    1, // nft count
                    purchasePrice, // purchase price
                    earnestAmount, // earnest amount (1%)
                    seller.address, // seller
                    buyer.address, // buyer
                    inspector.address, // inspector
                    ethers.constants.AddressZero, // NO LENDER
                    appraiser.address, // appraiser
                );
                // send the nft to the escrow contract
                await realEstate.connect(seller).safeTransferFrom(seller.address, escrow.address, 2, 1, "0x00");
                // assert 
                expect(await realEstate.balanceOf(escrow.address, 2)).to.equal(1);
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                // activate sale
                await escrow.connect(seller).activateSale();
                // buyer deposits
                await escrow.connect(buyer).deposit({ value: purchasePrice.sub(earnestAmount) });
                // finalize sale
                await escrow.connect(buyer).finalizeSale();
                // assert buyer has the nft not the escrow contract
                expect(await realEstate.balanceOf(buyer.address, 2)).to.equal(1);
                expect(await realEstate.balanceOf(escrow.address, 2)).to.equal(0);
                // ensure the nft is not in seller or finance contract
                expect(await realEstate.balanceOf(seller.address, 2)).to.equal(0);
                expect(await realEstate.balanceOf(factory.address, 2)).to.equal(0);
            }); 
            it("Transfers real estate to finance contract, if financed", async () => {
                expect(await realEstate.balanceOf(factory.address, 1)).to.equal(1);
                expect(await realEstate.balanceOf(escrow.address, 1)).to.equal(0);
                // assert the buyer does not have the nft
                expect(await realEstate.balanceOf(buyer.address, 1)).to.equal(0);
            });
            it("Emits Completed event", async () => {
                const event = receipt.events!.filter((x) => x.event === "Completed")[0];
                expect(event.event!).to.equal("Completed");
                const args = event.args!;
                expect(args!._from).to.equal(buyer.address);
                expect(args._new_nft_owner).to.equal(factory.address);
            });
        });
        describe("Failure", () => {
            it("Reverts when unauthorized actors call", async () => {
                await expect(escrow.connect(factory).finalizeSale()).to.be.revertedWith("Unauthorized");
            });
            it("Reverts when not the correct state when called", async () => {
                await expect(escrow.connect(seller).finalizeSale()).to.be.revertedWith("Incorrect state");
            });
            it("Reverts when lender's total deposit, if financed, is insufficient", async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();
                // lender deposits
                await escrow.connect(lender).deposit({ value: earnestAmount });
                // finalize sale
                await expect(escrow.connect(seller).finalizeSale()).to.be.revertedWith("Lender deposit insufficient");
            });
            it("Reverts when buyer's total deposit, if not financed, is insufficient", async () => {
                // mint new nft
                await realEstate.connect(seller).mint(seller.address, 2, 1, "" , "0x00");
                // deploy new escrow without lender
                const Escrow = await ethers.getContractFactory("Escrow");
                const escrow = await Escrow.deploy(
                    realEstate.address, // nft address
                    2, // nft id
                    1, // nft count
                    purchasePrice, // purchase price
                    earnestAmount, // earnest amount (1%)
                    seller.address, // seller
                    buyer.address, // buyer
                    inspector.address, // inspector
                    ethers.constants.AddressZero, // NO LENDER
                    appraiser.address, // appraiser
                );
                // send the nft to the escrow contract
                await realEstate.connect(seller).safeTransferFrom(seller.address, escrow.address, 2, 1, "0x00");
                // assert 
                expect(await realEstate.balanceOf(escrow.address, 2)).to.equal(1);
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                // activate sale
                await escrow.connect(seller).activateSale();
                // cause buyer's deposit to be insufficient by not depositing enough
                await expect(escrow.connect(buyer).finalizeSale()).to.be.revertedWith("Buyer deposit insufficient");
            }); 
            it("Reverts when finance contract is not set, if financed", async () => {
                // deposit earnest
                await escrow.connect(buyer).depositEarnest({ value: earnestAmount });
                // everyone approve sale
                await escrow.connect(seller).approveSale();
                await escrow.connect(inspector).approveSale();
                await escrow.connect(appraiser).approveSale();
                await escrow.connect(lender).approveSale();
                // assert 'Created' state
                expect(await escrow.state()).to.equal(0);
                // activate sale. anyone authorized can call this function, but we're using seller for this test
                await escrow.connect(seller).activateSale();
                // lender deposits
                await escrow.connect(lender).deposit({ value: purchasePrice.sub(earnestAmount) });
                // finalize sale. should revert since finance contract is not set
                await expect(escrow.connect(seller).finalizeSale()).to.be.revertedWith("Finance contract not set");
            });
        });
    });

    describe("Set Finance Contract", () => {
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                // assert finance contract is not set
                expect(await escrow.finance_contract()).to.equal(ethers.constants.AddressZero);
                const tx = await escrow.connect(lender).setFinanceContract(factory.address);
                receipt = await tx.wait();
            });
            it("Sets finance contract", async () => {
                expect(await escrow.finance_contract()).to.equal(factory.address);
            });
            it("Emits SetFinanceContract event", async () => {
                const event = receipt.events!.filter((x) => x.event === "SetFinanceContract")[0];
                expect(event.event!).to.equal("SetFinanceContract");
                expect(event.args!.finance_contract).to.equal(factory.address);
            });
        });
        describe("Failure", () => {
            it("Reverts when non-lender actor calls", async () => {
                await expect(escrow.connect(factory).setFinanceContract(factory.address)).to.be.revertedWith("Only lender can set finance contract");
            });
        });
    });
});