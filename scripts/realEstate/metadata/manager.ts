import fs from "fs";
import path from "path";
import express from "express";
import cors from 'cors';
import { RealEstateMetadata } from "./interfaces";
import dotenv from "dotenv";
import mongo from '../../../listeners/database/mongo';
dotenv.config();

class Manager {
  app: express.Application;
  port: number;
  portUrl: string;

  constructor() {
    if (!process.env.METADATA_PORT) {
      throw new Error("METADATA_PORT must be provided");
    }

    if (!process.env.METADATA_URL) {
      throw new Error("METADATA_URL must be provided");
    }

    this.port = process.env.METADATA_PORT as unknown as number;
    this.portUrl = process.env.METADATA_URL as string;

    this.app = express();
    this.app.use(cors({
      origin: '*',            // allow any origin (http, https, chrome-extension, etc)
      methods: ['GET'],       // only permit HTTP GET
    }));

    // Define the public directory path (assumes public is in the root of DecentralCore)
    const publicDir = path.resolve(__dirname, "../../../public");
    // Setup Express to serve static files from the public directory
    this.app.use(express.static(publicDir));
  }

  // Start the Express server
  startServer(): void {
    this.app.get("/", (req, res) => {
      const url = `${this.portUrl}/realEstate/singleFamily/mainImage/image1.webp`;
      res
        .status(200)
        .set("Content-Type", "text/html")
        .send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Image Server</title></head>
      <body>
        <p>
          Welcome to the image server. You can view an example image here:
          <a href="${url}" target="_blank">${url}</a>
        </p>
      </body>
      </html>
    `);
    });

    this.app.listen(this.port, () => {
      console.log(`Server is running at: ${this.portUrl}`);
    });
  }

  updateSingleFamilyMetadata(): void {
    // define the directory path where the metadata files reside.
    const dirPath = path.resolve(__dirname, "../../../public/realEstate/singleFamily");

    // define the main images for each type and the common other images.
    const mainImages = [
      `${this.portUrl}/realEstate/singleFamily/mainImage/image1.webp`,
      `${this.portUrl}/realEstate/singleFamily/mainImage/image2.webp`,
      `${this.portUrl}/realEstate/singleFamily/mainImage/image3.webp`
    ];

    const allOtherImages = [
      `${this.portUrl}/realEstate/singleFamily/otherImages/image1.webp`,
      `${this.portUrl}/realEstate/singleFamily/otherImages/image2.webp`,
      `${this.portUrl}/realEstate/singleFamily/otherImages/image3.webp`,
      `${this.portUrl}/realEstate/singleFamily/otherImages/image4.webp`
    ];

    // update type1.json, type2.json, and type3.json.
    const fileNames = ["type1.json", "type2.json", "type3.json"];

    fileNames.forEach((fileName, index) => {
      // construct the full file path.
      const filePath = path.join(dirPath, fileName);

      // read and parse the JSON metadata.
      const rawData = fs.readFileSync(filePath, "utf8");
      const metadata: RealEstateMetadata = JSON.parse(rawData);

      // update the main image for this file using the corresponding image from mainImages array.
      metadata.image = mainImages[index];

      // update the otherImages array with all the other images.
      metadata.otherImages = allOtherImages;

      // write the updated metadata back to the file.
      fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
      console.log(`Updated metadata for ${fileName} with main image ${mainImages[index]}`);
    });
  }

  updateMultiFamilyMetadata(): void {
    // define the directory path where the metadata files reside.
    const dirPath = path.resolve(__dirname, "../../../public/realEstate/multiFamily");

    // define the main images for each type and the common other images.
    const mainImages = [
      `${this.portUrl}/realEstate/multiFamily/mainImage/image1.webp`,
      `${this.portUrl}/realEstate/multiFamily/mainImage/image2.webp`,
      `${this.portUrl}/realEstate/multiFamily/mainImage/image3.webp`
    ];

    const allOtherImages = [
      `${this.portUrl}/realEstate/multiFamily/otherImages/image1.webp`,
      `${this.portUrl}/realEstate/multiFamily/otherImages/image2.webp`,
      `${this.portUrl}/realEstate/multiFamily/otherImages/image3.webp`,
      `${this.portUrl}/realEstate/multiFamily/otherImages/image4.webp`
    ];

    // update type1.json, type2.json, and type3.json.
    const fileNames = ["type1.json", "type2.json", "type3.json"];

    fileNames.forEach((fileName, index) => {
      // construct the full file path.
      const filePath = path.join(dirPath, fileName);

      // read and parse the JSON metadata.
      const rawData = fs.readFileSync(filePath, "utf8");
      const metadata: RealEstateMetadata = JSON.parse(rawData);

      // update the main image for this file using the corresponding image from mainImages array.
      metadata.image = mainImages[index];

      // update the otherImages array with all the other images.
      metadata.otherImages = allOtherImages;

      // write the updated metadata back to the file.
      fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
      console.log(`Updated metadata for ${fileName} with main image ${mainImages[index]}`);
    });
  }

  updateLuxuryMetadata(): void {
    // define the directory path where the metadata files reside.
    const dirPath = path.resolve(__dirname, "../../../public/realEstate/luxury");

    // define the main images for each type and the common other images.
    const mainImages = [
      `${this.portUrl}/realEstate/luxury/mainImage/image1.webp`,
      `${this.portUrl}/realEstate/luxury/mainImage/image2.webp`,
      `${this.portUrl}/realEstate/luxury/mainImage/image3.webp`
    ];

    const allOtherImages = [
      `${this.portUrl}/realEstate/luxury/otherImages/image1.webp`,
      `${this.portUrl}/realEstate/luxury/otherImages/image2.webp`,
      `${this.portUrl}/realEstate/luxury/otherImages/image3.webp`,
      `${this.portUrl}/realEstate/luxury/otherImages/image4.webp`
    ];

    // update type1.json, type2.json, and type3.json.
    const fileNames = ["type1.json", "type2.json", "type3.json"];

    fileNames.forEach((fileName, index) => {
      // construct the full file path.
      const filePath = path.join(dirPath, fileName);

      // read and parse the JSON metadata.
      const rawData = fs.readFileSync(filePath, "utf8");
      const metadata: RealEstateMetadata = JSON.parse(rawData);

      // update the main image for this file using the corresponding image from mainImages array.
      metadata.image = mainImages[index];

      // update the otherImages array with all the other images.
      metadata.otherImages = allOtherImages;

      // write the updated metadata back to the file.
      fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
      console.log(`Updated metadata for ${fileName} with main image ${mainImages[index]}`);
    });
  }
}

// connect to the database
mongo.connect().then(() => {
  console.log("Connected to the database successfully.");
  // Start the server
  const manager = new Manager();
  // manager.updateSingleFamilyMetadata();
  // manager.updateMultiFamilyMetadata();
  // manager.updateLuxuryMetadata();
  manager.startServer();
}).catch((error) => {
  console.error("Failed to connect to the database:", error);
});

