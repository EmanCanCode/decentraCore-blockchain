// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";


// nft transferred to this contract from the factory.createEscrow()
/// @author Emmanuel Douge - https://github.com/EmanCanCode/realEstate/blob/main/contracts/Escrow.sol
contract Escrow is IERC1155Receiver {
    bool private locked; // used for reentrancy guard
    address public immutable nft_address; // nft's address
    uint256 public immutable nft_id; // nft's id
    uint8 public fee = 1; // 1% fee
    uint8 public nft_count; // number of nfts to be purchased, erc1155 nfts can have multiple copies (apartment units, etc)
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
        uint8 _nft_count,
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
        nft_count = _nft_count;
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
    event Approval(address indexed _from);
    event Cancelled(address indexed _from);
    event ActivatedSale(address indexed _from);
    event Completed(address indexed _from, address indexed _new_nft_owner);
    event SetFinanceContract(address indexed finance_contract);

    modifier reentrancyGuard() {
        require(!locked, "Reentrancy guard");
        locked = true;
        _;
        locked = false;
    }

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
    // buyer's 'approval' is implicit, as the deposit_balance is updated only when the buyer deposits earnest
    function depositEarnest() public payable correctState(State.Created) {
        // only buyer deposits earnest
        require(msg.sender == buyer, "Only buyer can deposit earnest");
        // buyer must deposit the earnest amount
        require(msg.value == earnest_amount, "Incorrect earnest amount");
        require(deposit_balance[msg.sender] == 0, "Already deposited");
        // buyer's deposit balance is updated
        deposit_balance[msg.sender] += msg.value;

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
        require(msg.sender != buyer, "use depositEarnest() to approve sale");
        // approval status is updated
        approval[msg.sender] = true;

        emit Approval(msg.sender);
    }

    // cancel sale
    function cancelSale() public reentrancyGuard onlyAuthorized correctState(State.Created) {
        // set state to 'Cancelled'
        state = State.Cancelled;
        // refund buyer's earnest. no other party has deposited anything yet because the state is not 'Active' yet (required for depositing anything but earnest)
        if (deposit_balance[buyer] > 0) {
            // transfer buyer's earnest back to buyer from the contract
            buyer.transfer(deposit_balance[buyer]);
            deposit_balance[buyer] = 0;
        }
        // send the nft back to the seller
        IERC1155(nft_address).safeTransferFrom(
            address(this),
            seller,
            nft_id,
            nft_count,
            ""
        );

        emit Cancelled(msg.sender);
    }

    // activate sale
    function activateSale() public onlyAuthorized correctState(State.Created) {
        // ensure that all parties approved
        require(_checkApprovals(), "Not all parties approved");
        // set state to 'Active'
        state = State.Active;

        // emit event
        emit ActivatedSale(msg.sender);
    }

    // finalize sale
    // if state is active then all parties have approved and earnest is deposited
    function finalizeSale() public reentrancyGuard onlyAuthorized correctState(State.Active) {
        // if financed, ensure the lender has deposited the purchase price minus earnest
        if (lender != address(0)) {
            require(
                deposit_balance[lender] >= purchase_price - earnest_amount,
                "Lender deposit insufficient"
            );
        } else {
            // if not financed, ensure buyer has deposited a total of the purchase price
            require(
                deposit_balance[buyer] >= purchase_price,
                "Buyer deposit insufficient"
            );
        }

        // calculate fee and seller proceeds
        uint256 feeAmount = (purchase_price * fee) / 100;
        uint256 sellerProceeds = purchase_price - feeAmount;

        // update state to Completed
        state = State.Completed;

        // send the fee to the factory & seller proceeds to the seller
        payable(factory).transfer(feeAmount);
        payable(seller).transfer(sellerProceeds);

        // if financed, transfer the nft to the finance contract
        if (lender != address(0)) {
            require(finance_contract != address(0), "Finance contract not set");
            IERC1155(nft_address).safeTransferFrom(
                address(this),
                finance_contract,
                nft_id,
                nft_count,
                ""
            );
        } else {
            // if not financed, transfer the nft to the buyer
            IERC1155(nft_address).safeTransferFrom(
                address(this),
                buyer,
                nft_id,
                nft_count,
                ""
            );
        }

        emit Completed(msg.sender, lender == address(0) ? buyer : finance_contract);
    }

    // internal

    // check if all parties approved. checks if buyer's earnest is deposited. returns true if all parties approved & earnest deposited
    function _checkApprovals() internal view returns (bool) {
        return (deposit_balance[buyer] >= earnest_amount &&
            approval[seller] &&
            approval[inspector] &&
            approval[appraiser] &&
            (lender == address(0) || approval[lender]));
    }

    // set finance contract
    function setFinanceContract(
        address _finance_contract
    ) public {
        require(msg.sender == lender, "Only lender can set finance contract");
        finance_contract = _finance_contract;
        emit SetFinanceContract(_finance_contract);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        // You can add any custom logic here if needed
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        // You can add any custom logic here if needed
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}

enum State {
    Created,
    Active,
    Completed,
    Cancelled
}
