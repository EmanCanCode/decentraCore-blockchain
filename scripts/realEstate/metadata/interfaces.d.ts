export interface RealEstateMetadata {
    name: string;              // e.g. "293 Lafayette St PENTHOUSE 1, New York, NY 10012"
    description: string;       // e.g. "Luxury NYC Penthouse"
    image: string;             // e.g. "https://ipfs.io/ipfs/QmUsuRJyRUmeHzZxes5FRMkc4mjx35HbaTzHzzWoiRdT5G"
    otherImages: string[];    // e.g. ["https://ipfs.io/ipfs/QmUsuRJyRUmeHzZxes5FRMkc4mjx35HbaTzHzzWoiRdT5G"]
    attributes: RealEstateAttribute;
}

export interface RealEstateAttribute {
    // e.g. trait_type is "Bedrooms" and value is 3
    // e.g. trait_type is "Bathrooms" and value is 2
    [trait_type: string]: string | number;        
}

export type RealEstateType = "singleFamily" | "multiFamily" | "Luxury";