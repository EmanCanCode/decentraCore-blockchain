import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Escrow } from "../../typechain-types";
import { RealEstate } from '../../typechain-types/contracts/realEstate/RealEstate';
import { BigNumber } from "ethers";


describe("Escrow", () => {
    let owner: SignerWithAddress;
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
            owner,
            buyer,
            seller,
            inspector,
        ] = await ethers.getSigners();
        // all the same since they just approve the sale. no further contract interaction from them
        lender = appraiser = inspector; 
        // deploy real estate (nft erc1155) contract
        const RealEstate = await ethers.getContractFactory("RealEstate");
        realEstate = await RealEstate.deploy();
        await realEstate.deployed();
        // deploy escrow contract
        const Escrow = await ethers.getContractFactory("Escrow");
        // have owner deploy the escrow contract
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
    });

    describe("Deployment", () => {
        it("Sets state variables", async () => {
            expect(await escrow.factory()).to.equal(owner.address);
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
});