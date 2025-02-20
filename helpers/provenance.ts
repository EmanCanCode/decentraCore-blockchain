import { ethers } from "hardhat";

export interface ProductRecord {
    productName: string;
    variety: string;
    productType: string;
    timestamp: number;  // unix
    location: string; // bytes
    state: State;
    additionalInfo: string; // bytes
}

export enum State {
    Created = 0,
    InTransit,
    Completed
};

export function decodeProductId(productId: string) {
    if (!productId.startsWith("0x")) {
        throw new Error("Invalid product ID, must start with 0x");
    }
    // (address, creator, nonce) = abi.decode(productId, (address, uint))
    const creator = ethers.utils.getAddress(productId.slice(0, 42));
    const nonce = ethers.BigNumber.from(productId.slice(42));
    return { creator, nonce };
}

export function encodeProductId(creator: string, nonce: number) {
    if (!creator.startsWith('0x')) {
        if (creator.length !== 40) {
            throw new Error("Invalid creator address");
        }
        creator = '0x' + creator;
    }
    // Convert nonce to hex and pad it to 8 characters (since uint32 is 4 bytes)
    const hexNonce = nonce.toString(16).padStart(8, '0');
    return creator + hexNonce;
}


export const productRecords: ProductRecord[] = [
    {
        productName: "Apple",
        variety: "Granny Smith",
        productType: "Fruit",
        timestamp: 1631779200,
        location: "0x000000",
        state: State.Created,
        additionalInfo: toEvenHex("First apple")
    },
    {
        productName: "Cherry",
        variety: "Bing",  
        productType: "Fruit",
        timestamp: 1631779204,
        location: "0x000000",
        state: State.Created,
        additionalInfo: toEvenHex("Cherry cherry")
    },
    {
        productName: "Banana",
        variety: "Cavendish",  
        productType: "Fruit",
        timestamp: 1631779207,
        location: "0x000000",
        state: State.Created,
        additionalInfo: toEvenHex("Sweet banana")
    },
];


export function toEvenHex(input: string): string {
    let hex = Buffer.from(input).toString("hex");
    // Ensure the hex string has an even number of characters
    if (hex.length % 2 !== 0) {
      hex = "0" + hex;
    }
    return "0x" + hex;
  }
  