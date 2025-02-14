// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract FungibleToken is ERC20 {
    address public owner;
    constructor(
        string memory _name, 
        string memory _symbol,
        uint _initialSupply
        ) ERC20(_name, _symbol) {
        owner = msg.sender;
        _mint(msg.sender, _initialSupply);
    }

    function mint(address _to, uint _amount) external {
        require(msg.sender == owner, "Only the owner can mint tokens");
        _mint(_to, _amount);
    }
}