// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAutomatedProcess {
    function setProcessValue(uint256 _nonce, address recipient) external payable returns(bool);
}

interface IProvenance {
    function isCompleted(bytes memory _productId) external view returns (bool);
}

interface IInventoryManagement {
    enum MovementType { Inbound, Outbound, Transfer, Adjustment }

    function updateStock(
        uint256 _itemId,
        uint256 _quantity,
        MovementType _movementType,
        string memory _location,
        string memory _note
    ) external;
}