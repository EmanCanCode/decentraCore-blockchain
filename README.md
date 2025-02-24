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
  - [Listeners](#listeners)
  - [Metadata](#metadata)
- [Deployment & Seeding](#deployment--seeding)
- [Testing](#testing)
- [Usage](#usage)
- [License](#license)

---

## Overview

DecentraCore brings together several decentralized applications (dApps) to serve as a robust portfolio of blockchain capabilities:

- **Finance:**

  - **Constant Product Automated Market Maker (CPAMM, used by UniSwap, SushiSwap, PancakeSwap etc)**
  - **Constant Sum Automated Market Maker (CSAMM)**
  - **Order Book Market Maker**
  - _(Future: Lend/Borrow, Yield Farms)_

- **Supply Chain:**

  - **Product Provenance** tracking
  - **Inventory Management**
  - _(Future: Automated Process)_

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

### Listeners
- **Finance Listeners**: Capture swap events (CPAMM, CSAMM) and order events (OBMM), updating MongoDB with trade volume, fees, and order lifecycle.
- **Supply Chain Listeners**: Track product record events (Provenance) and inventory changes (InventoryManagement).
- **Real Estate Listeners**: Optional, capturing escrow creations and completions.

### Metadata
- Manages JSON metadata for Real Estate NFTs (ERC-1155) and references for Supply Chain items.
- Hosted via a simple server (or IPFS in the future), linking URIs to the tokens’ metadata on-chain.

**Metadata Steps:**
1. Create .env file in project rool and add the following variables:
    ```bash
      METADATA_PORT=3001 #example
      METADATA_URL=http://127.0.0.1:3001 # url and port number, needs to match the port above
    ```
2. Run metadata with:
    ```bash
      npm run metadata
    ```

## Deployment & Seeding

Each module is designed to be deployed independently. The contracts have been developed using Solidity 0.8.24 and tested with Hardhat. The project follows industry best practices for security and modular design.

**Deployment Steps:**

1. Clone the repository.
2. Install dependencies with:
   ```bash
     npm install
   ```
3. Create .env file in project rool with the following variables:
    ```bash
        PROVIDER_URL=http://127.0.0.1:8545 # this would be if its local
        DEPLOYER_PRIVATE_KEY=0xabc123...   # private key of deployer
    ```
4. Deploy to your local network with:
   ```bash
    npx hardhat node
   ```
5. Open a new tab to project path in terminal and run:
   ```bash
    npm run deploy
   ```

**Seeding Steps:**
1. Follow all steps in [Deployment & Seeding](#deployment--seeding).
2. Open a new tab to project path in terminal and run:
    ```bash
      npm run seed
    ```

## Testing

**Testing Steps:**

1. Clone the repository.
2. Install dependencies with:
    ```bash
      npm install
    ```
3. Compile contracts with:
    ```
      npx hardhat compile
    ```
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
