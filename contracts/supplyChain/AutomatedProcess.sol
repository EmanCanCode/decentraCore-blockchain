// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import { IProvenance, IInventoryManagement } from "./Interfaces.sol";

contract AutomatedProcess {
    address public owner;
    address public provenance; // provenance contract address
    address public inventoryManagement; // inventoryManagement contract address
    mapping(address => mapping(uint256 => uint256)) public processValues;  // mapping(user, nonce) => value

    constructor() {
       owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");

        _;
    }

    //      ------     PROVENANCE     ------     //
    modifier onlyProvenance() {
        require(provenance != address(0), "Provenance not set");
        require(msg.sender == provenance, "Not authorized");
        _;
    }

    event SetProvenance(address provenance);
    event SetProcessValue(address process, uint256 processId, uint256 value);  

    function setProvenance(address _provenance) public onlyOwner {
        provenance = _provenance;
        emit SetProvenance(_provenance);
    }

    function setProcessValue(
        uint256 _nonce, 
        address recipient
    ) public payable onlyProvenance returns(bool) { // msg.sender is the provenance contract so i need to pass the recipient address
        processValues[recipient][_nonce] = msg.value;
        emit SetProcessValue(recipient, _nonce, msg.value);
        return true;
    }

    function releaseProcessValue(uint256 _nonce, address recipient) public onlyOwner  {
        require(provenance != address(0), "Provenance not set");
        require(processValues[recipient][_nonce] > 0, "No value to release");
        // ensure the state is complete
        require(
            IProvenance(provenance).isCompleted(abi.encodePacked(recipient, _nonce)),
            "Provenance not completed"
        );
        // reset the value to 0
        uint value = processValues[recipient][_nonce];  // store the value
        processValues[recipient][_nonce] = 0;
        // release the value to the recipient
        payable(recipient).transfer(value);
    }

    //     ------     INVENTORY MANAGEMENT     ------     //

    event SetInventoryManagement(address inventoryManagement);
    function setInventoryManagement(address _inventoryManagement) public onlyOwner {
        inventoryManagement = _inventoryManagement;
        emit SetInventoryManagement(_inventoryManagement);
    }

    event UpdatedStock(uint256 itemId, uint256 quantity);
    function updateStock(
        uint _itemId,
        uint _quantity,
        IInventoryManagement.MovementType _movementType,
        string memory _location,
        string memory _note
    ) public onlyOwner {
        require(inventoryManagement != address(0), "Inventory management not set");
        IInventoryManagement(inventoryManagement).updateStock(_itemId, _quantity, _movementType, _location, _note);
        emit UpdatedStock(_itemId, _quantity);
    }
}
