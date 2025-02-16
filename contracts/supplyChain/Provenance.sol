// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import { IAutomatedProcess } from "./Interfaces.sol";


contract Provenance {
    address public owner;
    address public automatedProcess; // automatedProcess contract address
    mapping(address => uint) public nonce;
    bool public reentrancyGuard = false;
    // mapping from a product ID (could be a unique identifier for the product or batch)
    // to an array of provenance events.
    mapping(bytes => ProductRecord[]) public productHistory; //abi.encodePacked(recordCreatorAddr, nonce) 

    constructor() {
        owner = msg.sender;
    }

    enum State { Created, InTransit, Completed } // could have lots more like "Quality Check Passed", "Rejected", "In Storage", etc.
    // this struct represents an event in the product's lifecycle.
    struct ProductRecord {  // structs like bytes more than they like strings. convert to bytes from string
        string productName;      // e.g., "Cabernet Sauvignon" or "Arabica Beans"
        string variety;          // (e.g., "Merlot", "Robusta")
        string productType;      // (e.g., "Red", "White" for wine or "Light Roast", "Dark Roast" for coffee)
        uint256 timestamp;       // when this event was recorded
        bytes location;         // location where the event occurred
        State state;           // the state of the product at this event
        bytes additionalInfo;   // any extra data (e.g., "Quality Check Passed", "In Transit", etc.)
    }
    
    event CreatedRecord(
        string productName,
        string variety,
        string productType,
        uint256 timestamp,
        string location,
        State state,
        string additionalInfo,
        address recordCreator,
        uint256 value
    );

    event UpdatedRecord(
        bytes productId,
        uint256 timestamp,
        string location,
        State state,
        string additionalInfo,
        address recordUpdater
    );

    modifier ReetranyGuard() {
        require(!reentrancyGuard, "ReentrancyGuard: reentrant call");
        reentrancyGuard = true;
        _;
        reentrancyGuard = false;
    }

    event SetAutomatedProcess(address automatedProcess);

    function createRecord(
        string memory _productName,
        string memory _variety,
        string memory _productType,
        uint256 _timestamp,
        string memory _location,
        State _state,
        string memory _additionalInfo
    ) public payable {
        require(automatedProcess != address(0), "Automated process not set");
        // create a new ProductRecord object
        ProductRecord memory newRecord = ProductRecord({
            productName: _productName,
            variety: _variety,
            productType: _productType,
            timestamp: _timestamp,
            location: bytes(_location),
            state: _state,
            additionalInfo: bytes(_additionalInfo)
        });
        // get the product ID
        nonce[msg.sender]++;
        bytes memory productId = abi.encodePacked(msg.sender, nonce[msg.sender]);
        // add the new record to the product's history
        productHistory[productId].push(newRecord);
        if (msg.value > 0) {
            // send the value to the automated process
            require(
                IAutomatedProcess(
                    automatedProcess
                ).setProcessValue{value: msg.value}(
                    nonce[msg.sender], msg.sender
                ), 
                "Failed to set process value"
            );
        }
        emit CreatedRecord(
            _productName,
            _variety,
            _productType,
            _timestamp,
            _location,
            _state,
            _additionalInfo,
            msg.sender,
            msg.value
        );
    }
    
    function updateRecord(
        bytes memory _productId,
        uint256 _timestamp,
        string memory _location,
        State _state,
        string memory _additionalInfo
    ) public {
        // ensure the record exists
        ProductRecord[] storage records = productHistory[_productId];
        require(records.length > 0, "No record found for this product ID");
        // i dont need the creator in the ProductRecord struct, i can just get it from the productId
        (address creator, ) = abi.decode(_productId, (address, uint));
        // here we could implement different checks on who can call this function...
        // ... for now only owner or creator of the record can update it.
        require(
            msg.sender == owner || msg.sender == creator, 
            "Only the owner or the creator of the record can update it"
        );

        // ensure last record is not 'Completed'
        require(
            !isCompleted(_productId),
            "Cannot update a record that is in the 'Completed' state"
        );


        // create a new ProductRecord object
        // add the updated record to the product's history
        productHistory[_productId].push(ProductRecord({
            productName: records[records.length - 1].productName,
            variety: records[records.length - 1].variety,
            productType: records[records.length - 1].productType,
            timestamp: _timestamp,
            location: bytes(_location),
            state: _state,
            additionalInfo: bytes(_additionalInfo)
        }));

        emit UpdatedRecord(
            _productId,
            _timestamp,
            _location,
            _state,
            _additionalInfo,
            msg.sender
        );
    }
    

    function getHistory(bytes memory _productId)
        public
        view
        returns (ProductRecord[] memory)
    {
        return productHistory[_productId];
    }

    function isCompleted(bytes memory _productId) public view returns (bool) {
        ProductRecord[] memory records = productHistory[_productId];
        return records.length > 0 && records[records.length - 1].state == State.Completed;
    }

    function setAutomatedProcess(address _automatedProcess) public {
        require(msg.sender == owner, "Only the owner can set the automated process");
        automatedProcess = _automatedProcess;

        emit SetAutomatedProcess(_automatedProcess);
    }
}
