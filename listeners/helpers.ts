import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

export function toReadableAmount(value: BigNumber) {
    // return the its wei value in ether, with a maximum of 2 decimal places
    let formattedValue = Number(ethers.utils.formatEther(value));
    formattedValue = Number(formattedValue.toFixed(2));
    return formattedValue;
}