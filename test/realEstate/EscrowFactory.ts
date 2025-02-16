import { BigNumber, ContractReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { EscrowFactory } from '../../typechain-types';

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
                expect(args.escrowId).to.equal('0xf8a73d23578aa519da7bd167f7733a86efbd40c05701a997d0c9b71472bd7a75');
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
        describe("Success", () => {
            it("Updates nonce", async () => {});
            it("Clears verification flag (makes contract lighter, use events to track history off-chain)", async () => {});
            it("Deploys escrow contract", async () => {});
            it("Stores escrow address by escrow ID", async () => {});
            it("Emits Escrow Created event", async () => {});
        });
        describe("Failure", () => {
            it("Reverts when escrow parameters are not verified", async () => {});
            it("Reverts when given and calculated escrow ID mismatch", async () => {});
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