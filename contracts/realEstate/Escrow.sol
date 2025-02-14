// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/// @author Emmanuel Douge - https://github.com/EmanCanCode/realEstate/blob/main/contracts/Escrow.sol
enum State {
    Created,
    Active,
    Completed,
    Cancelled
}

contract Escrow is IERC1155Receiver {
    bool private locked; // used for reentrancy guard
    address public immutable nft_address; // nft's address
    uint256 public immutable nft_id; // nft's id
    uint8 public fee = 1; // 1% fee
    uint8 public purchase_count; // number of nfts to be purchased, erc1155 nfts can have multiple copies (apartment units, etc)
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
    event Cancelled(address indexed _from);
    event ActivatedSale(address indexed _from);

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
        // ensure the seller has approved this contract for transferring the nft
        require(
            IERC1155(nft_address).isApprovedForAll(seller, address(this)),
            "Seller has not approved this contract"
        );
        // only buyer deposits earnest
        require(msg.sender == buyer, "Only buyer can deposit earnest");
        // buyer must deposit the earnest amount
        require(msg.value == earnest_amount, "Incorrect amount");
        require(deposit_balance[msg.sender] == 0, "Already deposited");
        // ensure that the NFT was transferred to the contract
        IERC1155(nft_address).safeTransferFrom(
            seller,
            address(this),
            nft_id,
            purchase_count,
            ""
        );
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
        require(msg.sender != buyer, "use depositEarnest() to deposit earnest");
        // approval status is updated
        approval[msg.sender] = true;

        emit Approval(msg.sender, true);
    }

    // cancel sale
    function cancelSale() public reentrancyGuard onlyAuthorized correctState(State.Created) {
        // set state to 'Cancelled'
        state = State.Cancelled;
        // refund buyer's earnest. no other party has deposited anything yet because the state is not 'Active' yet (required for depositing anything but earnest)
        if (deposit_balance[buyer] > 0) {
            // transfer buyer's earnest back to buyer from the contract
            buyer.transfer(deposit_balance[buyer]);
        }
        // send the nft back to the seller
        IERC1155(nft_address).safeTransferFrom(
            address(this),
            seller,
            nft_id,
            purchase_count,
            ""
        );

        emit Cancelled(msg.sender);
    }

    // activate sale
    function activeSale() public onlyAuthorized correctState(State.Created) {
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
            uint256 lenderRequired = purchase_price - earnest_amount;
            require(
                deposit_balance[lender] >= lenderRequired,
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
                purchase_count,
                ""
            );
        } else {
            // if not financed, transfer the nft to the buyer
            IERC1155(nft_address).safeTransferFrom(
                address(this),
                buyer,
                nft_id,
                purchase_count,
                ""
            );
        }


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

    // set lending contract
    function setLendingContract(
        address _finance_contract
    ) public {
        require(msg.sender == factory, "Only factory can set lending contract");
        finance_contract = _finance_contract;
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
