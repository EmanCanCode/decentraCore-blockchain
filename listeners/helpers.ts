import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

export function toReadableAmount(value: BigNumber) {
    return Math.floor(Number(ethers.utils.formatEther(value)));
}