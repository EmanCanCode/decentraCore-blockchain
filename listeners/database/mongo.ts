import { Db, MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import {
  FinanceDocument,
  FinanceType,
  InventoryManagementDocumentBase,
  ProvenanceDocumentBase,
  RealEstateDocument,
  SupplyChainDocument
} from './interfaces';
dotenv.config();

class Mongo {
  client: MongoClient;
  db: Db;

  constructor() {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not set");
    }
    this.client = new MongoClient(process.env.MONGO_URI!);
    this.db = this.client.db('DecentraCore');
  }

  async connect() {
    await this.client.connect();
  }

  async close() {
    await this.client.close();
  }

  async initialize() {
    try {
      const collections = await this.db.collections();
      const names = collections.map(c => c.collectionName);

      if (names.includes('finance')) await this.db.dropCollection('finance');
      if (names.includes('supplyChain')) await this.db.dropCollection('supplyChain');
      if (names.includes('realEstate')) await this.db.dropCollection('realEstate');

      await this.db.createCollection<FinanceDocument>('finance');
      console.log("Finance collection created");

      await this.db.createCollection<SupplyChainDocument>('supplyChain');
      await this.db.collection<SupplyChainDocument>('supplyChain').insertMany([
        { type: 'InventoryManagement', totalMovements: 0, totalOutbound: 0, totalReorders: 0 },
        { type: 'Provenance', totalRecords: 0, completedRecords: 0, totalValueProcessed: 0 }
      ]);
      console.log("SupplyChain collection created");

      await this.db.createCollection<RealEstateDocument>('realEstate');
      console.log("RealEstate collection created");
    } catch (error) {
      console.error("Error initializing database:", error);
    }
  }

  /**
   * Upsert finance document: increment counters using $inc
   */
  async updateFinance(
    type: FinanceType,
    volumeToAdd: number,
    feesToAdd: number,
    cancelledOrder?: boolean,
    filledOrder?: boolean
  ) {
    // validate input
    if (type === 'OBMM') {
      if (!cancelledOrder && !filledOrder)
        throw new Error("OBMM type requires either cancelledOrder or filledOrder");
      if (cancelledOrder && filledOrder)
        throw new Error("OBMM type requires either cancelledOrder or filledOrder, not both");
      if (filledOrder && (volumeToAdd === 0 || feesToAdd === 0))
        throw new Error("OBMM type requires volumeToAdd and feesToAdd to be set for filledOrder");
    }

    const coll = this.db.collection<FinanceDocument>('finance');
    const incOps: Record<string, number> = {};

    if (type === 'OBMM') {
      if (cancelledOrder) incOps.totalCancelled = 1;
      else if (filledOrder) {
        incOps.totalSwaps = 1;
        incOps.totalVolume = volumeToAdd;
        incOps.totalFees = feesToAdd;
      }
    } else {
      incOps.totalSwaps = 1;
      incOps.totalVolume = volumeToAdd;
      incOps.totalFees = feesToAdd;
    }

    try {
      await coll.updateOne(
        { type },
        { $inc: incOps },
        { upsert: true }
      );
      console.log(`Finance (${type}) upserted`, incOps);
    } catch (error) {
      console.error('Error upserting finance:', error);
    }
  }

  /**
   * Upsert supply chain document: increment counters using $inc
   */
  async updateSupplyChain(data: SupplyChainDocument) {
    const coll = this.db.collection<SupplyChainDocument>('supplyChain');
    const filter = { type: data.type };
    const incOps: Record<string, number> = {};

    if (data.type === 'Provenance') {
      if ((data as ProvenanceDocumentBase).totalRecords)
        incOps.totalRecords = 1;
      if ((data as ProvenanceDocumentBase).completedRecords)
        incOps.completedRecords = 1;
      if ((data as ProvenanceDocumentBase).totalValueProcessed)
        incOps.totalValueProcessed =
          (data as ProvenanceDocumentBase).totalValueProcessed;
    } else {
      if ((data as InventoryManagementDocumentBase).totalMovements)
        incOps.totalMovements = 1;
      if ((data as InventoryManagementDocumentBase).totalOutbound)
        incOps.totalOutbound = 1;
      if ((data as InventoryManagementDocumentBase).totalReorders)
        incOps.totalReorders = 1;
    }

    try {
      await coll.updateOne(
        filter,
        { $inc: incOps },
        { upsert: true }
      );
      console.log(`SupplyChain (${data.type}) upserted`, incOps);
    } catch (error) {
      console.error('Error upserting supplyChain:', error);
    }
  }

  /**
   * Upsert or delete real estate document
   */
  async updateRealEstate(
    data: Partial<RealEstateDocument>,
    toBeDeleted?: boolean
  ) {
    const coll = this.db.collection<RealEstateDocument>('realEstate');
    if (!data.buyer) throw new Error('RealEstate document requires a buyer');
    if (!data.escrowId && !toBeDeleted)
      throw new Error('RealEstate document requires an escrowId');

    const filter = { buyer: data.buyer!, escrowId: data.escrowId! };
    try {
      if (toBeDeleted) {
        await coll.deleteOne({ buyer: data.buyer! });
        console.log('RealEstate document deleted', data.buyer);
        return;
      }
      await coll.updateOne(
        filter,
        { $set: { buyer: data.buyer, escrowId: data.escrowId } },
        { upsert: true }
      );
      console.log('RealEstate upserted', filter);
    } catch (error) {
      console.error('Error upserting realEstate:', error);
    }
  }

  isProvenanceDocument(
    data: SupplyChainDocument
  ): data is ProvenanceDocumentBase {
    return data.type === 'Provenance';
  }

  isInventoryManagementDocument(
    data: SupplyChainDocument
  ): data is InventoryManagementDocumentBase {
    return data.type === 'InventoryManagement';
  }
}

const mongo = new Mongo();
export default mongo;
