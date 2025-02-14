// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/// @author Emmanuel Douge - https://github.com/EmanCanCode/realEstate/blob/main/contracts/Escrow.sol
enum State { Created, Active, Completed, Cancelled }
contract Escrow is IERC1155Receiver {
    address public immutable nft_address; // nft's address
    uint256 public immutable nft_id; // nft's id
    uint8 public fee = 1;
    uint256 public purchase_price; // purchase price for the house
    uint256 public immutable earnest_amount; // earnest amount
    address payable public immutable seller; // seller's address
    address payable public buyer; // buyer's address
    address public appraiser; // appraiser's address
    address public inspector; // inspector of the nft
    address public lender; // lending institution's address. if buyer is buying outright, this will be address(0)
    address public finance_contract; // address of the finance contract. nft is sent here if the buyer is financed by a lender. it will act as the escrow contract for the nft after the sale is finalized and the buyer is financed. (between buyer and lender)
    State public state; // current state of the contract
    address public immutable factory; // factory address
    mapping(address => uint256) public deposit_balance; // tracks user deposit balances. give it an address, get that address's deposit balance
    mapping(address => bool) public approval; // tracks approval status of each party. give it an address, get that address's approval status

    constructor(
        address _nft_address,
        uint256 _nft_id,
        uint256 _purchase_price,
        uint256 _earnest_amount,
        address payable _seller,
        address payable _buyer,
        address _inspector,
        address _lender,
        address _appraiser
    ) {
        factory = msg.sender;
        nft_address = _nft_address;
        nft_id = _nft_id;
        purchase_price = _purchase_price;
        earnest_amount = _earnest_amount;
        seller = _seller;
        buyer = _buyer;
        inspector = _inspector;
        lender = _lender;
        appraiser = _appraiser;
        state = State.Created;
    }

    event Deposit(address indexed _from, uint256 _value);
    event Approval(address indexed _from, bool _value);

    modifier correctState(State _state) {
        require(state == _state, "Incorrect state");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == seller ||
            msg.sender == buyer ||
            msg.sender == appraiser ||
            msg.sender == inspector ||
            msg.sender == lender,
            "Unauthorized"
        );
        _;
    }

    // Fallback: reverts if Ether is sent to this smart contract by mistake
    fallback() external {
        revert("Fallback function: Reverting");
    }

    // Optionally, if you want to reject plain Ether transfers:
    receive() external payable {
        revert("Direct deposits not allowed");
    }

    // buyer deposits earnest - before any other party can approve the sale
    function depositEarnest() public payable correctState(State.Created) {
        // buyer deposits earnest
        require(msg.sender == buyer, "Only buyer can deposit earnest");
        // buyer must deposit the earnest amount
        require(msg.value == earnest_amount, "Incorrect amount");
        // buyer's deposit balance is updated
        deposit_balance[msg.sender] += msg.value;
        // buyer's approval status is updated
        approval[msg.sender] = true;

        emit Deposit(msg.sender, msg.value);
    }

    function deposit() public payable correctState(State.Active) {
        // only buyer or lender can deposit
        if (msg.sender != buyer) {
            require(msg.sender == lender, "Only lender or buyer can deposit");
        }
        deposit_balance[msg.sender] += msg.value;

        emit Deposit(msg.sender, msg.value);
    }

    // approve sale
    function approveSale() public onlyAuthorized correctState(State.Created) {
        require(msg.sender != buyer, "use depositEarnest() to deposit earnest");
        // approval status is updated
        approval[msg.sender] = true;
    }

    // cancel sale
    function cancelSale() public {}

    // finalize sale

    // todo
    // set lending contract
    function setLendingContract() public {}
}

