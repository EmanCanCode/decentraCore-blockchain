// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract InventoryManagement {
    address public owner;
    uint256 public nextItemId;
    address public automatedProcess; // automatedProcess contract address
    // mapping from itemId to Item details.
    mapping(uint256 => Item) public items;
    // mapping from itemId to an array of inventory transactions.
    mapping(uint256 => InventoryTransaction[]) public transactions;
    // represents an inventory item.
    struct Item {
        string name;
        string description;
        uint256 quantity;
        uint256 reorderThreshold;
    }
    
    // types of inventory movements.
    enum MovementType { Inbound, Outbound, Transfer, Adjustment }
    
    // represents an inventory transaction.
    struct InventoryTransaction {
        uint256 quantity; // for inbound: added; for outbound: removed; for adjustment: new absolute quantity.
        MovementType movementType;
        uint256 timestamp;
        string location;   // e.g., "Warehouse A", "In Transit", "Store B"
        string note;       // additional details (e.g., "Received", "Damaged", etc.)
        address user;      // the address that performed the action.
    }
    
    
    
    event ItemRegistered(uint256 indexed itemId, string name, string description, uint256 reorderThreshold);
    event StockUpdated(uint256 indexed itemId, uint256 newQuantity, MovementType movementType, uint256 timestamp, string note);
    event ItemTransferred(uint256 indexed itemId, uint256 quantity, string fromLocation, string toLocation, uint256 timestamp, string note);
    event ItemDeleted(uint256 indexed itemId);
    event SetAutomatedProcess(address automatedProcess);
    event SetReorderThreshold(uint256 indexed itemId, uint256 threshold);


    modifier onlyOwner() {
        require(msg.sender == owner, "Not Authorized");
        _;
    }

    modifier onlyRegisteredItem(uint256 _itemId) {
        require(bytes(items[_itemId].name).length > 0, "Item does not exist");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        nextItemId = 1;
    }

    function setAutomatedProcess(address _automatedProcess) public onlyOwner {
        automatedProcess = _automatedProcess;
        emit SetAutomatedProcess(_automatedProcess);
    }
    
    // register 
    function registerItem(
        string memory _name,
        string memory _description,
        uint256 _reorderThreshold
    ) public onlyOwner returns (uint256) {
        uint256 _itemId = nextItemId;
        items[_itemId] = Item({
            name: _name,
            description: _description,
            quantity: 0,
            reorderThreshold: _reorderThreshold
        });
        nextItemId++;
        emit ItemRegistered(_itemId, _name, _description, _reorderThreshold);
        return _itemId;
    }
    
    function updateStock(
        uint256 _itemId,
        uint256 _quantity,
        MovementType _movementType,
        string memory _location,
        string memory _note
    ) public onlyRegisteredItem(_itemId) { 
        if (msg.sender != owner) {  // if not owner, then only automated process can call this function
            require(automatedProcess != address(0), "Automated Process not set");
            require(
                msg.sender == automatedProcess,
                "Only the Automated Process can call this function"
            );
        }
          
        if (_movementType == MovementType.Inbound) {
            items[_itemId].quantity += _quantity;
        } else if (_movementType == MovementType.Outbound) {
            require(items[_itemId].quantity >= _quantity, "Insufficient stock");
            items[_itemId].quantity -= _quantity;
        } else if (_movementType == MovementType.Adjustment) {
            items[_itemId].quantity = _quantity;
        }
        
        transactions[_itemId].push(InventoryTransaction({
            quantity: _quantity,
            movementType: _movementType,
            timestamp: block.timestamp,
            location: _location,
            note: _note,
            user: msg.sender
        }));
        
        emit StockUpdated(_itemId, items[_itemId].quantity, _movementType, block.timestamp, _note);
    }
    
    // transfer 
    function transferItem(
        uint256 _itemId,
        uint256 _quantity,
        string memory _fromLocation,
        string memory _toLocation,
        string memory _note
    ) public onlyOwner onlyRegisteredItem(_itemId) {
        require(items[_itemId].quantity >= _quantity, "Insufficient stock");
        // this is where you can make this contract a controller of the inventory (maybe stores are its own contracts)... next level for sure
        transactions[_itemId].push(InventoryTransaction({
            quantity: _quantity,
            movementType: MovementType.Transfer,
            timestamp: block.timestamp,
            location: _toLocation,
            note: _note,
            user: msg.sender
        }));
        
        emit ItemTransferred(_itemId, _quantity, _fromLocation, _toLocation, block.timestamp, _note);
    }
    
    // update reorder threshold
    function setReorderThreshold(uint256 _itemId, uint256 _threshold) public onlyOwner onlyRegisteredItem(_itemId) {
        items[_itemId].reorderThreshold = _threshold;
        emit SetReorderThreshold(_itemId, _threshold);
    }

    // delete item
    function deleteItem(uint256 _itemId) public onlyOwner onlyRegisteredItem(_itemId) {
        delete items[_itemId];
        emit ItemDeleted(_itemId);
    }
    
    function getTransactionHistory(uint256 _itemId) public view returns (InventoryTransaction[] memory) {
        return transactions[_itemId];
    }

    function isBelowThreshold(uint256 _itemId) public view onlyRegisteredItem(_itemId) returns (bool) {
        return items[_itemId].quantity < items[_itemId].reorderThreshold;
    }

}
