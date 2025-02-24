import mongo from "./database/mongo";
import { CpammListener } from "./finance/cpamm";
import { CsammListener } from "./finance/csamm";
import { ObmmListener } from "./finance/obmm";
import { InventoryManagementListener } from "./supplyChain/inventoryManagement";
import { ProvenanceListener } from "./supplyChain/provenance";
import { EscrowFactoryListener } from "./realEstate/escrowFactory";
import * as financeContracts from '../logs/finance/deploy.json';
import * as supplyChainContracts from '../logs/supplyChain/deploy.json';
import * as realEstateContracts from '../logs/realEstate/deploy.json';

class ListenerManager {
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
export default manager;

const financeContractAddresses = financeContracts['contracts'];
const supplyChainContractAddresses = supplyChainContracts['contracts'];
const realEstateContractAddresses = realEstateContracts['contracts'];

manager.initialize(
    financeContractAddresses.CPAMM, // CPAMM contract address
    financeContractAddresses.CSAMM, // CSAMM contract address
    financeContractAddresses.OBMM, // OBMM contract address
    supplyChainContractAddresses.provenance, // Provenance contract address
    supplyChainContractAddresses.inventoryManagement, // InventoryManagement contract address
    realEstateContractAddresses.escrowFactory, // EscrowFactory contract address
).then(async () => {
    await mongo.connect();
    // start
    manager.listen();
    console.log("Listeners initialized and listening...");
}).catch(err => {
    console.error("Error initializing listeners:", err);
});