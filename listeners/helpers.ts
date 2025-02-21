import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

export function toReadableAmount(value: BigNumber) {
    return Number(Number(ethers.utils.formatEther(value)).toFixed(2));
}