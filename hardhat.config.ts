import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // viaIR: true,
    },
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545'
    }
  },
};

export default config;
