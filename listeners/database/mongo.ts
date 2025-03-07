import { Db, MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { FinanceDocument, FinanceType, InventoryManagementDocumentBase, ProvenanceDocumentBase, RealEstateDocument, SupplyChainDocument, SupplyChainType } from './interfaces';
dotenv.config();


class Mongo {
    client: MongoClient;
    db: Db;

    constructor() {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is not set");
        }

        this.client = new MongoClient(process.env.MONGO_URI);
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
            // check if collection exists, if so delete it so we can reinitialize
            const collections = await this.db.collections();
            if (collections.map(c => c.collectionName).includes('finance'))
                await this.db.dropCollection('finance');
            if (collections.map(c => c.collectionName).includes('supplyChain'))
                await this.db.dropCollection('supplyChain');
            if (collections.map(c => c.collectionName).includes('realEstate'))
                await this.db.dropCollection('realEstate');

            // create finance collection
            await this.db.createCollection<FinanceDocument>('finance');
            console.log("Finance collection created");

            // create supplyChain collection
            await this.db.createCollection<SupplyChainDocument>('supplyChain');
            // put two empty documents in the collection
            await this.db.collection<SupplyChainDocument>('supplyChain').insertMany([
               {
                type: "InventoryManagement",
                totalMovements: 0,
                totalOutbound: 0,
                totalReorders: 0
               },
               {
                type: "Provenance",
                totalRecords: 0,
                completedRecords: 0,
                totalValueProcessed: 0
               }
            ]);
            console.log("SupplyChain collection created");

            // create realEstate collection
            await this.db.createCollection<RealEstateDocument>('realEstate');
            console.log("RealEstate collection created");

        } catch (error) {
            console.error("Error initializing database:", error);
        } finally {
        }
    }

    async updateFinance(
        type: FinanceType,
        volumeToAdd: number,
        feesToAdd: number,
        cancelledOrder?: boolean, // if obmm order is cancelled. make ensure to have volumeToAdd and feesToAdd as 0
        filledOrder?: boolean // if obmm order is filled. ensure to have volumeToAdd and feesToAdd set
    ) {
        // validate input
        if (type == 'OBMM' && !cancelledOrder && !filledOrder) {
            throw new Error("OBMM type requires either cancelledOrder or filledOrder to be set");
        } else if (type == 'OBMM' && cancelledOrder && filledOrder) {
            throw new Error("OBMM type requires either cancelledOrder or filledOrder to be set, not both");
        } else if (type == 'OBMM' && filledOrder && (volumeToAdd == 0 || feesToAdd == 0)) {
            throw new Error("OBMM type requires volumeToAdd and feesToAdd to be set for filledOrder");
        }

        try {

            // determine if finance collection exists
            const collections = await this.db.collections();
            if (!collections.map(c => c.collectionName).includes('finance')) {
                console.error("Finance collection does not exist");
                return;
            }

            // find finance document
            const financeCollection = this.db.collection<FinanceDocument>('finance');
            let financeDocument = await financeCollection.findOne({ type }); // shorthanding this with the param
            // console.log("Finance document found:", financeDocument);

            // if doesnt exist, create it
            if (!financeDocument) {
                const newFinanceDocument: FinanceDocument = {
                    type,
                    totalSwaps: 1,
                    totalVolume: volumeToAdd,
                    totalFees: feesToAdd
                };
                await financeCollection.insertOne(newFinanceDocument);
                console.log("Finance document created");

                return;
            }

            // update finance document
            if (type == 'OBMM' && cancelledOrder) {
                if (!financeDocument.totalCancelled) financeDocument.totalCancelled = 1;
                else financeDocument.totalCancelled++;
            } else {
                financeDocument.totalSwaps++;
                financeDocument.totalVolume += volumeToAdd;
                financeDocument.totalFees += feesToAdd;
            }
            
            await financeCollection.findOneAndUpdate(
                { type },
                { $set: financeDocument }
            );

            console.log("Finance document updated:", financeDocument._id.toString());

        } catch (error) {
            console.error("Error updating finance:", error);
        } finally {
        }
    }

    async updateSupplyChain(data: SupplyChainDocument) {
        try {   
            // get the collection
            const collection = this.db.collection<SupplyChainDocument>('supplyChain');
            // find the document
            let document = await collection.findOne({ type: data.type });
            if (!document) {
                console.error("updateSupplyChain() Document not found");
                return;
            }
            // update the document
            if (
                this.isProvenanceDocument(document) &&
                this.isProvenanceDocument(data) // i do this so we can access the properties of the document without TS complaining
            ) { // if the document is a ProvenanceDocumentBase
                // update the document
                // you will have to pass all the data to update the document. put 0 if the data property is not applicable
                if (data.completedRecords) document.completedRecords++;  
                if (data.totalRecords) document.totalRecords++;
                if (data.totalValueProcessed) document.totalValueProcessed += data.totalValueProcessed;
            } else if (
                this.isInventoryManagementDocument(document) &&
                this.isInventoryManagementDocument(data)
            ) { // if the document is an InventoryManagementDocumentBase
                // update the document
                // you will have to pass all the data to update the document. put 0 if the data property is not applicable
                if (data.totalMovements) document.totalMovements++;
                if (data.totalOutbound) document.totalOutbound++;
                if (data.totalReorders) document.totalReorders++;
            }

            // set the document in the collection
            await collection.findOneAndUpdate(
                { type: data.type },
                { $set: document }
            );

            console.log("SupplyChain document updated:", document._id.toString());

        } catch (error) {
            console.error("Error updating supplyChain:", error);
        } finally {
        }
    }


    async updateRealEstate(data: Partial<RealEstateDocument>, toBeDeleted?: boolean) {
        if (!data.buyer) { // either case we need the buyer - to add or delete
            throw new Error("RealEstate document requires a buyer");
        } if (!data.escrowId && !toBeDeleted) { // if toBeDeleted is false, then we need the escrowId to add the document
            throw new Error("RealEstate document requires an escrowId");
        }
        
        try {
            // determine if realEstate collection exists
            const collections = await this.db.collections();
            if (!collections.map(c => c.collectionName).includes('realEstate')) {
                console.error("RealEstate collection does not exist");
                return;
            }

            // if real estate document exists, throw error
            const realEstateCollection = this.db.collection<RealEstateDocument>('realEstate');
            let realEstateDocument = await realEstateCollection.findOne({ buyer: data.buyer });
            if (realEstateDocument && !toBeDeleted) { // if document exists and we are not deleting
                throw new Error("RealEstate document already exists");
            } else if (!realEstateDocument && toBeDeleted) {  // if there is no document and we are to delete it
                throw new Error("RealEstate document does not exist");
            }

            // if deleting, delete the document
            if (toBeDeleted) {
                await realEstateCollection.deleteOne({ buyer: data.buyer });
                console.log("RealEstate document deleted");
                return;
            }

            // create realEstate document
            await realEstateCollection.insertOne(
                data as RealEstateDocument // i couldve type guarded this like the bottom functions buttttttt
            );
            console.log("RealEstate document created");

        } catch (error) {
            console.error("Error updating realEstate:", error);
        } finally {
        }
    }


    isProvenanceDocument(data: SupplyChainDocument): data is ProvenanceDocumentBase {
        return data.type == 'Provenance';
    }

    isInventoryManagementDocument(data: SupplyChainDocument): data is InventoryManagementDocumentBase {
        return data.type == 'InventoryManagement';
    }

}

const mongo = new Mongo();
export default mongo;
