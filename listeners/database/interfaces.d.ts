import { ObjectId }  from 'mongodb';

export type FinanceType = 'CPAMM' | 'CSAMM' | 'OBMM';
export interface FinanceDocument {  // CPAMM, CSAMM AND OBMM will have this interface
    _id?: ObjectId;
    type: FinanceType;
    totalSwaps: number;
    totalVolume: number;
    totalFees: number;
    totalCancelled?: number; // for obmm
}    


export type SupplyChainType = 'Provenance' | 'InventoryManagement';
export interface ProvenanceDocumentBase {
    _id?: ObjectId;
    type: SupplyChainType;
    totalRecords: number;
    completedRecords: number;
    totalValueProcessed: number;
}
export interface InventoryManagementDocumentBase {
    _id?: ObjectId;
    type: SupplyChainType;
    totalMovements: number;
    totalOutbound: number;
    totalReorders: number;
}


export interface SupplyChainDocument extends 
    Partial<ProvenanceDocumentBase>, Partial<InventoryManagementDocumentBase> {
    type: SupplyChainType;
}


// we are only storing the buyer and the escrow address
export interface RealEstateDocument {
    _id?: ObjectId;
    buyer: string; // address of the buyer
    escrowId: string; // id of the escrow
}