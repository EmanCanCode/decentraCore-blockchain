# DecentraCore

DecentraCore is a comprehensive blockchain portfolio project that demonstrates advanced decentralized application development across multiple sectors: Finance, Supply Chain, and Real Estate. The project includes a suite of smart contracts showcasing key concepts such as automated market making, order book trading, product provenance, inventory management, and multi-party escrow via NFTs.

---

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Modules](#modules)
  - [Finance](#finance)
  - [Supply Chain](#supply-chain)
  - [Real Estate](#real-estate)
- [Deployment & Testing](#deployment--testing)
- [Usage](#usage)
- [License](#license)

---

## Overview

DecentraCore brings together several decentralized applications (dApps) to serve as a robust portfolio of blockchain capabilities:

- **Finance:** 
  - **Constant Product Automated Market Maker (CPAMM, used by UniSwap, SushiSwap, PancakeSwap etc)**
  - **Constant Sum Automated Market Maker (CSAMM)**
  - **Order Book Market Maker**
  - *(Future: Lend/Borrow, Yield Farms)*

- **Supply Chain:**
  - **Product Provenance** tracking
  - **Inventory Management**
  - *(Future: Automated Process)*

- **Real Estate:**
  - **NFTs for Real Estate for sale (ERC1155)**
  - **Multi-party Escrow** for real estate transactions  
    - Escrow functions: deposit, earnest deposit, sale approval, cancellation, finalization

Each module is designed to be modular and reusable, reflecting production-ready practices while also demonstrating forward-thinking ideas.

---

## Requirements

- **Node.js:** v18.20.4  
- **npm:** v10.7.0

---

## Modules

### Finance

- **ConstantProduct.sol (CPAMM)**
  - Implements a constant product automated market maker with a 0.3% fee.
  - Facilitates liquidity provision, swapping, and fee collection.

- **ConstantSum.sol (CSAMM)**
  - Implements a constant sum AMM with a 0.3% fee.
  - Provides an alternative liquidity pool mechanism with a simpler invariant.

- **OrderBook.sol**
  - A decentralized order book allowing token deposits, withdrawals, order creation, cancellation, and execution.
  - Emits events for order lifecycle actions for off-chain indexing and transparency.

### Supply Chain

- **Provenance.sol**
  - Tracks the lifecycle of a product or batch using a unique product ID.
  - Records events (e.g., Created, InTransit, Completed) with details such as product name, variety, product type, timestamp, location, and additional information.
  - Provides an immutable audit trail of product history.

- **InventoryManagement.sol**
  - Manages inventory for registered items.
  - Allows the owner to register new items, update stock (inbound, outbound, adjustments), record transfers between locations, and update reorder thresholds.
  - Maintains a transaction history for each item and provides functions to check if stock is below the reorder threshold.

### Real Estate

- **RealEstate.sol (ERC1155 NFT)**
  - Represents real estate assets as NFTs.
  - Enables minting of property NFTs with associated metadata via URIs.

- **Escrow.sol**
  - Multi-party escrow contract for real estate transactions.
  - Supports deposit, earnest deposit, sale approval, sale cancellation, and sale finalization.

- **EscrowFactory.sol**
  - Factory contract for deploying new Escrow contracts.
  - Implements signature verification and nonce-based replay protection.
  - Handles NFT transfers to newly deployed escrow contracts and tracks each escrow with a unique identifier.

---

## Deployment & Testing

Each module is designed to be deployed independently. The contracts have been developed using Solidity 0.8.24 and tested with Hardhat. The project follows industry best practices for security and modular design.

**Deployment Steps:**

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Compile contracts with `npx hardhat compile`.
4. Deploy to your local network with:
   ```bash
   npx hardhat run scripts/deploy.js --network local
   ```

**Testing Steps:**

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Compile contracts with `npx hardhat compile`.
4. Run test with:
    ```bash
    npx hardhat test
    ```

## Usage

### Finance Modules:
Interact with the AMM and order book contracts via Web3 interfaces (e.g., using Ethers.js or Web3.js) to provide liquidity, execute trades, and monitor fee distributions.

### Supply Chain Modules:
- Use the Provenance contract to create and update product lifecycle events, establishing an immutable audit trail for products or batches.
- Manage inventory through the Inventory Management contract to register items, update stock levels, record transfers, and trigger reorder alerts based on threshold conditions.

### Real Estate Modules:
Mint and manage property NFTs using the RealEstate contract, and process real estate transactions via the Escrow and EscrowFactory contracts. The escrow system ensures that all parties (buyer, seller, inspector, appraiser, and lender if applicable) are involved before finalizing a sale.

## License

This project is licensed under the MIT License. 
