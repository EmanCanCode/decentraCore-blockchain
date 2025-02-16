import { BigNumber, ContractReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Escrow, EscrowFactory } from '../../typechain-types';

describe('EscrowFactory', () => {
    let owner: SignerWithAddress;
    let escrowFactory: EscrowFactory;
    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        const EscrowFactory = await ethers.getContractFactory('EscrowFactory', owner);
        escrowFactory = await EscrowFactory.deploy();
        await escrowFactory.deployed();
    });

    describe("Deployment", () => {
        it("Should set the right owner", async () => {
            expect(await escrowFactory.owner()).to.equal(owner.address);
        }); 
    });

    describe("Verify Escrow Data", () => {
        const nft_id = 1;
        const nft_count = 1;
        const purchase_price = ethers.utils.parseEther("500");
        const earnest_amount = purchase_price.div(100); // 1%
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let inspector: SignerWithAddress;
        let lender: SignerWithAddress;
        let appraiser: SignerWithAddress;
        let escrowParams: EscrowParams;
        let signatures: {
            seller: string;
            buyer: string;
            lender: string;
        };
        beforeEach(async () => {
            [owner, seller, buyer, inspector, lender, appraiser] = await ethers.getSigners();
            // deploy real estate NFT, mints in constructor
            const RealEstate = await ethers.getContractFactory('RealEstate', seller);
            const realEstate = await RealEstate.deploy();
            await realEstate.deployed();
            // create function params
            escrowParams = {
                nft_address: realEstate.address,
                nft_id,
                nft_count,
                purchase_price,
                earnest_amount,
                seller: seller.address,
                buyer: buyer.address,
                inspector: inspector.address,
                lender: lender.address,
                appraiser: appraiser.address,
            };
            // create signed message
            let messageHash = ethers.utils.solidityPack(
                [
                    'address', 
                    'uint256', 
                    'uint8', 
                    'uint256', 
                    'uint256', 
                    'address', 
                    'address', 
                    'address', 
                    'address', 
                    'address',
                    'uint256'  // nonce
                ],
                [
                    escrowParams.nft_address,
                    escrowParams.nft_id,
                    escrowParams.nft_count,
                    escrowParams.purchase_price,
                    escrowParams.earnest_amount,
                    escrowParams.seller,
                    escrowParams.buyer,
                    escrowParams.inspector,
                    escrowParams.lender,
                    escrowParams.appraiser,
                    1  // nonce
                ]
            );
            messageHash = ethers.utils.solidityKeccak256(['bytes'], [messageHash]);
            // seller signs message
            // buyer signs message
            // lender signs message
            signatures = {
                seller: await seller.signMessage(ethers.utils.arrayify(messageHash)),
                buyer: await buyer.signMessage(ethers.utils.arrayify(messageHash)),
                lender: await lender.signMessage(ethers.utils.arrayify(messageHash)),
            }
            
        });
        describe("Success", () => {
            let receipt: ContractReceipt;
            beforeEach(async () => {
                const tx = await escrowFactory.verifyEscrowData(
                    escrowParams,
                    signatures.seller,
                    signatures.buyer,
                    signatures.lender
                );
                receipt = await tx.wait();
            });
            it("Stores verified escrow id", async () => {
                const escrowId = (() => {
                    const escrowId = receipt.events?.find(e => e.event === "EscrowVerified")?.args?.escrowId;
                    if (!escrowId) throw new Error("EscrowVerified event not emitted");
                    return escrowId;
                })();
                const verifiedEscrowId = await escrowFactory.verifiedEscrowIds(escrowId);
                expect(verifiedEscrowId).to.be.true;
            });
            it("Emits EscrowVerified event", async () => {
                const event = receipt.events?.find(e => e.event === "EscrowVerified")!;
                expect(event.event!).to.equal("EscrowVerified");
                const args = event.args!;
                expect(args.escrowId).to.not.be.undefined;
                expect(args.escrowId).to.not.equal(ethers.constants.HashZero);
                expect(args.buyer).to.equal(buyer.address); 
                expect(args.seller).to.equal(seller.address);
                expect(args.nonce).to.equal(1);
            });
        });
        describe("Failure", () => {
            it("Reverts when parameters already verified", async () => {
                // verify escrow data
                await escrowFactory.connect(seller).verifyEscrowData(
                    escrowParams,
                    signatures.seller,
                    signatures.buyer,
                    signatures.lender
                );
                // verify same escrow data again, should fail
                await expect(escrowFactory.connect(seller).verifyEscrowData(
                    escrowParams,
                    signatures.seller,
                    signatures.buyer,
                    signatures.lender
                )).to.be.revertedWith("Escrow parameters already verified");
            }); 
            it("Reverts when invalid seller signature", async () => {
                await expect(escrowFactory.verifyEscrowData(
                    escrowParams,
                    signatures.buyer,  // should be seller. should fail
                    signatures.buyer,
                    signatures.lender
                )).to.be.revertedWith("Invalid seller signature");
            });
            it("Reverts when invalid buyer signature", async () => {
                await expect(escrowFactory.verifyEscrowData(
                    escrowParams,
                    signatures.seller,
                    signatures.seller,  // should be buyer. should fail
                    signatures.lender
                )).to.be.revertedWith("Invalid buyer signature");
            });
            it("Reverts when invalid lender signature, if financed", async () => {
                await expect(escrowFactory.verifyEscrowData(
                    escrowParams,
                    signatures.seller,
                    signatures.buyer,
                    signatures.buyer  // should be lender. should fail
                )).to.be.revertedWith("Invalid lender signature");

            });
            it("Reverts when lender signature not empty, if not financed", async () => {
                // recreate signed data
                escrowParams.lender = ethers.constants.AddressZero;  // no lender, not financed
                // create signed message
                let messageHash = ethers.utils.solidityPack(
                    [
                        'address', 
                        'uint256', 
                        'uint8', 
                        'uint256', 
                        'uint256', 
                        'address', 
                        'address', 
                        'address', 
                        'address', 
                        'address',
                        'uint256'  // nonce
                    ],
                    [
                        escrowParams.nft_address,
                        escrowParams.nft_id,
                        escrowParams.nft_count,
                        escrowParams.purchase_price,
                        escrowParams.earnest_amount,
                        escrowParams.seller,
                        escrowParams.buyer,
                        escrowParams.inspector,
                        escrowParams.lender,
                        escrowParams.appraiser,
                        1  // nonce
                    ]
                );
                messageHash = ethers.utils.solidityKeccak256(['bytes'], [messageHash]);
                // seller signs message
                signatures.seller = await seller.signMessage(ethers.utils.arrayify(messageHash));
                // buyer signs message
                signatures.buyer = await buyer.signMessage(ethers.utils.arrayify(messageHash));
                await expect(escrowFactory.connect(seller).verifyEscrowData(
                    escrowParams,  // has address zero for lender
                    signatures.seller,
                    signatures.buyer,
                    signatures.buyer  // non-empty lender signature. should fail
                )).to.be.revertedWith("Lender signature should be empty");
            });
        });
    });

    describe("Withdraw", () => {
        describe("Success", () => {
            it("Withdraws contract's ether balance to owner", async () => {
                // get owner's initial balance
                const ownerInitialBalance = await owner.getBalance();
                // send some ether to contract
                const actor = (await ethers.getSigners())[1];
                await actor.sendTransaction({ to: escrowFactory.address, value: ethers.utils.parseEther("1") });
                // withdraw ether to owner
                await escrowFactory.connect(owner).withdraw();
                // get owner's final balance
                const ownerFinalBalance = await owner.getBalance();
                // check owner's balance increased. (owner loses gas fees)
                expect(ownerFinalBalance).to.be.gt(ownerInitialBalance);
            });
        });
        describe("Failure", () => {
            it("Reverts when non-owner actor calls", async () => {
                const nonOwner = (await ethers.getSigners())[1];
                await expect(escrowFactory.connect(nonOwner).withdraw()).to.be.revertedWith("Only owner can withdraw");
            });
        });
    });

    describe("Create Escrow From Verified", () => {
        const nft_id = 1;
        const nft_count = 1;
        const purchase_price = ethers.utils.parseEther("500");
        const earnest_amount = purchase_price.div(100); // 1%
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let inspector: SignerWithAddress;
        let lender: SignerWithAddress;
        let appraiser: SignerWithAddress;
        let escrowParams: EscrowParams;
        let signatures: {
            seller: string;
            buyer: string;
            lender: string;
        };
        let escrowId: string;
        // verify escrow
        beforeEach(async () => {
            [owner, seller, buyer, inspector, lender, appraiser] = await ethers.getSigners();
            // deploy real estate NFT, mints in constructor
            const RealEstate = await ethers.getContractFactory('RealEstate', seller);
            const realEstate = await RealEstate.deploy();
            await realEstate.deployed();
            // approve escrow factory to transfer real estate NFT
            await realEstate.connect(seller).setApprovalForAll(escrowFactory.address, true);
            // create function params
            escrowParams = {
                nft_address: realEstate.address,
                nft_id,
                nft_count,
                purchase_price,
                earnest_amount,
                seller: seller.address,
                buyer: buyer.address,
                inspector: inspector.address,
                lender: lender.address,
                appraiser: appraiser.address,
            };
            // create signed message
            let messageHash = ethers.utils.solidityPack(
                [
                    'address', 
                    'uint256', 
                    'uint8', 
                    'uint256', 
                    'uint256', 
                    'address', 
                    'address', 
                    'address', 
                    'address', 
                    'address',
                    'uint256'  // nonce
                ],
                [
                    escrowParams.nft_address,
                    escrowParams.nft_id,
                    escrowParams.nft_count,
                    escrowParams.purchase_price,
                    escrowParams.earnest_amount,
                    escrowParams.seller,
                    escrowParams.buyer,
                    escrowParams.inspector,
                    escrowParams.lender,
                    escrowParams.appraiser,
                    1  // nonce
                ]
            );
            messageHash = ethers.utils.solidityKeccak256(['bytes'], [messageHash]);
            // seller signs message
            // buyer signs message
            // lender signs message
            signatures = {
                seller: await seller.signMessage(ethers.utils.arrayify(messageHash)),
                buyer: await buyer.signMessage(ethers.utils.arrayify(messageHash)),
                lender: await lender.signMessage(ethers.utils.arrayify(messageHash)),
            }
            // verify escrow data
            const tx = await escrowFactory.connect(seller).verifyEscrowData(
                escrowParams,
                signatures.seller,
                signatures.buyer,
                signatures.lender
            );
            // get escrow id from event
            const receipt = await tx.wait();
            escrowId = receipt.events?.find(e => e.event === "EscrowVerified")?.args?.escrowId;
            // assert escrow data verified
            expect(await escrowFactory.verifiedEscrowIds(escrowId)).to.be.true;
            // assert no escrow created yet by escrow id
            expect(await escrowFactory.escrows(escrowId)).to.equal(ethers.constants.AddressZero);
        });
        describe("Success", () => {
            let receipt: ContractReceipt;
            let escrow: Escrow;
            // create escrow
            beforeEach(async () => {
                const tx = await escrowFactory.connect(seller).createEscrowFromVerified(
                    escrowParams,
                    escrowId
                );
                receipt = await tx.wait();
                // get events where event is called EscrowCreated
                const event = receipt.events?.find(e => e.event === "EscrowCreated")!;
                // the event arg is called escrow
                const escrowAddress = event.args?.escrow;
                // get the escrow contract
                escrow = await ethers.getContractAt("Escrow", escrowAddress);
            });
            it("Updates nonce", async () => {
                expect(await escrowFactory.nonce(escrowParams.buyer, escrowParams.seller)).to.equal(1);
            });
            it("Clears verification flag (makes contract lighter, use events to track history off-chain)", async () => {
                expect(await escrowFactory.verifiedEscrowIds(escrowId)).to.be.false;
            });
            it("Deploys escrow contract", async () => {
                expect(escrow.address).to.not.be.undefined;
                expect(await escrow.factory()).to.equal(escrowFactory.address);
                expect(await escrow.nft_address()).to.equal(escrowParams.nft_address);
                expect(await escrow.nft_id()).to.equal(escrowParams.nft_id);
                expect(await escrow.nft_count()).to.equal(escrowParams.nft_count);
                expect(await escrow.purchase_price()).to.equal(escrowParams.purchase_price);
                expect(await escrow.earnest_amount()).to.equal(escrowParams.earnest_amount);
                expect(await escrow.seller()).to.equal(escrowParams.seller);
                expect(await escrow.buyer()).to.equal(escrowParams.buyer);
                expect(await escrow.inspector()).to.equal(escrowParams.inspector);
                expect(await escrow.lender()).to.equal(escrowParams.lender);
                expect(await escrow.appraiser()).to.equal(escrowParams.appraiser);
                expect(await escrow.state()).to.equal(0);  // EscrowState.Created
            });
            it("Stores escrow address by escrow ID", async () => {
                expect(await escrowFactory.escrows(escrowId)).to.equal(escrow.address);
            });
            it("Emits Escrow Created event", async () => {
                const event = receipt.events?.find(e => e.event === "EscrowCreated")!;
                expect(event.event!).to.equal("EscrowCreated");
                const args = event.args!;
                expect(args.escrowId).to.equal(escrowId);
                expect(args.buyer).to.equal(buyer.address);
                expect(args.seller).to.equal(seller.address);
                expect(args.nonce).to.equal(1);
            });
        });
        describe("Failure", () => {
            it("Reverts when escrow parameters are not verified", async () => {
                await expect(
                    escrowFactory.connect(seller).createEscrowFromVerified(
                        escrowParams,
                        ethers.constants.HashZero
                    )
                ).to.be.revertedWith("Escrow parameters not verified");
            });
            it("Reverts when given and calculated escrow ID mismatch", async () => {
                // deep copy
                const params = JSON.parse(JSON.stringify(escrowParams)) as EscrowParams;
                params.seller = ethers.constants.AddressZero;  // change one param to make escrow ID different from calculated hash
                await expect(escrowFactory.connect(seller).createEscrowFromVerified(
                    params,
                    escrowId
                )).to.be.revertedWith("Escrow ID mismatch");
            });
        });
    });
});

interface EscrowParams {
    nft_address: string;
    nft_id: number;
    nft_count: number;
    purchase_price: BigNumber;
    earnest_amount: BigNumber;
    seller: string; // address
    buyer: string; // address
    inspector: string; // address
    lender: string; // address
    appraiser: string; // address
}