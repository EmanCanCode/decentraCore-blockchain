import { Mongo } from "./database/mongo";
import { CpammListener } from "./finance/cpamm";
import { CsammListener } from "./finance/csamm";
import { ObmmListener } from "./finance/obmm";
import { InventoryManagementListener } from "./supplyChain/inventoryManagement";
import { ProvenanceListener } from "./supplyChain/provenance";
import { EscrowFactoryListener } from "./realEstate/escrowFactory";

export class ListenerManager {
    financeListeners = {
        cpamm: new CpammListener(),
        csamm: new CsammListener(),
        obmm: new ObmmListener()
    }

    supplyChainListeners = {
        provenance: new ProvenanceListener(),
        inventoryManager: new InventoryManagementListener()
    }

    realEstateListeners = {
        escrowFactory: new EscrowFactoryListener()
    }

    async initialize(
        cpammAddress: string, // CPAMM contract address
        csammAddress: string, // CSAMM contract address
        obmmAddress: string, // OBMM contract address
        provenanceAddress: string, // Provenance contract address
        inventoryManagerAddress: string, // InventoryManagement contract address
        escrowFactoryAddress: string, // EscrowFactory contract address
    ) {
        await this.financeListeners.cpamm.setCpamm(cpammAddress);
        await this.financeListeners.csamm.setCsamm(csammAddress);
        await this.financeListeners.obmm.setObmm(obmmAddress);
        await this.supplyChainListeners.provenance.setProvenance(provenanceAddress);
        await this.supplyChainListeners.inventoryManager.setInventoryManagement(inventoryManagerAddress);
        await this.realEstateListeners.escrowFactory.setEscrowFactory(escrowFactoryAddress);
    }

    listen() {
        // finance
        this.financeListeners.csamm.listen(); // csamm swaps
        this.financeListeners.cpamm.listen(); // cpamm swaps
        this.financeListeners.obmm.listenForCancelledOrders(); // obmm cancelled orders
        this.financeListeners.obmm.listenForFilledOrders(); // obmm filled orders
        // supply chain
        this.supplyChainListeners.provenance.listenForCreatedRecord(); // provenance created record
        this.supplyChainListeners.provenance.listenForUpdatedRecord(); // provenance updated record
        this.supplyChainListeners.inventoryManager.listenForStockUpdated(); // inventory management stock updated
        this.supplyChainListeners.inventoryManager.listenForItemTransferred(); // inventory management item transferred
        // real estate
        this.realEstateListeners.escrowFactory.listenForEscrowCreated(); // escrow factory escrow created
    }
}

const manager = new ListenerManager();
manager.initialize(
    '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // CPAMM contract address
    '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9', // CSAMM contract address
    '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9', // OBMM contract address
    '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853', // Provenance contract address
    '0x0165878A594ca255338adfa4d48449f69242Eb8F', // InventoryManagement contract address
    '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1', // EscrowFactory contract address
).then(async () => {
    const mongo = new Mongo();
    // initialize database
    await mongo.initialize();
    // start
    manager.listen();
    console.log("Listeners initialized and listening...");
}).catch(err => {
    console.error("Error initializing listeners:", err);
});