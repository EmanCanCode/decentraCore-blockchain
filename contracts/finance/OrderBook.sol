// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// updated my old code from: https://github.com/EmanCanCode/Decentralized-Exchange/blob/main/src/contracts/Exchange.sol
contract OrderBook {
    // Variables
    address public feeAccount; // The account that recvs exchange fees
    uint256 public feePercent; // The fee percent
    address constant ETHER = address(0); // Stores Ether in tokens mapping with blank address

    // First mapping is for all token address, second is address of the user who deposited said tokens, then it will show the balance
    mapping(address => mapping(address => uint256)) public tokens;
    // A way to store the order
    mapping(uint256 => _Order) public orders;
    uint256 public orderCount;
    // Store cancelled orders
    mapping(uint256 => bool) public orderCancelled;
    // Store when orders are filled
    mapping(uint256 => bool) public orderFilled;

    // Events
    event Deposit(address token, address user, uint256 amount, uint256 balance);
    event Withdraw(
        address token,
        address user,
        uint256 amount,
        uint256 balance
    );
    event Order(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        uint256 timestamp
    );
    event Cancel(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        uint256 timestamp
    );
    event Trade(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        address userFill,
        uint256 timestamp
    );

    // Structs
    // a way to model the order
    struct _Order {
        uint256 id;
        address user; // Person who made order
        address tokenGet; // Address of token
        uint256 amountGet;
        address tokenGive; // Token given in trade
        uint256 amountGive;
        uint256 timestamp;
    }

    constructor(address _feeAccount, uint256 _feePercent) {
        feeAccount = _feeAccount;
        feePercent = _feePercent;
    }

    // Fallback: reverts if Ether is sent to this smart contract by mistake
    fallback() external {
        revert("Fallback function: Reverting");
    }

    // Optionally, if you want to reject plain Ether transfers:
    receive() external payable {
        revert("Direct deposits not allowed");
    }

    // I need that payable to make this work
    function depositEther() external payable {
        tokens[ETHER][msg.sender] += msg.value;
        emit Deposit(ETHER, msg.sender, msg.value, tokens[ETHER][msg.sender]);
    }

    // Keep in mind I have to APPROVE the tokens before calling this.
    function depositToken(address _token, uint _amount) external {
        require(_token != ETHER, "Invalid token address");
        // Make sure the token contract returns true on success.
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        tokens[_token][msg.sender] += _amount;
        emit Deposit(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    function withdrawEther(uint _amount) external {
        require(tokens[ETHER][msg.sender] >= _amount, "Insufficient balance");
        tokens[ETHER][msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
        emit Withdraw(ETHER, msg.sender, _amount, tokens[ETHER][msg.sender]);
    }

    function withdrawToken(address _token, uint _amount) external {
        require(_token != ETHER, "Invalid token address");
        require(
            tokens[_token][msg.sender] >= _amount,
            "Insufficient token balance"
        );
        tokens[_token][msg.sender] -= _amount;
        require(
            IERC20(_token).transfer(msg.sender, _amount),
            "Token transfer failed"
        );
        emit Withdraw(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    function balanceOf(
        address _token,
        address user
    ) public view returns (uint256) {
        // Check our balance
        return tokens[_token][user];
    }

    /// @param _tokenGet The token the user wants to get
    /// @param _amountGet The amount the user wants to get
    /// @param _tokenGive The token the user wants to give
    /// @param _amountGive The amount the user wants to give
    function makeOrder(
        address _tokenGet,
        uint256 _amountGet,
        address _tokenGive,
        uint256 _amountGive
    ) external {
        orderCount++;
        orders[orderCount] = _Order(
            orderCount,
            msg.sender,
            _tokenGet,
            _amountGet,
            _tokenGive,
            _amountGive,
            block.timestamp
        );
        emit Order(
            orderCount,
            msg.sender,
            _tokenGet,
            _amountGet,
            _tokenGive,
            _amountGive,
            block.timestamp
        );
    }

    function cancelOrder(uint256 _id) external {
        _Order memory orderToCancel = orders[_id];
        require(orderToCancel.user == msg.sender, "Not your order");
        // technically i dont need the commented out line below as the require above will revert if the order does not exist. (ie. if the order does not exist, when we get the orderToCancel, all datatypes will be falsey, meaning the user will not be the msg.sender since orderToCancel.user will be 0x0)
        // require(orderToCancel.id == _id, "Order does not exist");
        require(!orderFilled[_id], "Order already filled");
        require(!orderCancelled[_id], "Order already cancelled");
        orderCancelled[_id] = true;
        emit Cancel(
            _id,
            msg.sender,
            orderToCancel.tokenGet,
            orderToCancel.amountGet,
            orderToCancel.tokenGive,
            orderToCancel.amountGive,
            block.timestamp
        );
    }

    function fillOrder(uint256 _id) external {
        require(_id > 0 && _id <= orderCount, "Invalid order id");
        require(!orderCancelled[_id], "Order already cancelled");
        require(!orderFilled[_id], "Order already filled");

        _Order storage orderToFill = orders[_id];
        _trade(
            orderToFill.id,
            orderToFill.user,
            orderToFill.tokenGet,
            orderToFill.amountGet,
            orderToFill.tokenGive,
            orderToFill.amountGive
        );
        orderFilled[_id] = true;
    }

    /**
     * @notice Executes a trade between an order maker and an order filler.
     * @dev This internal function transfers tokens between the order maker and the order filler while charging a fee.
     * It deducts (_amountGet + feeAmount) of _tokenGet from the order filler (msg.sender) and credits _amountGet to the order maker.
     * Simultaneously, it deducts _amountGive of _tokenGive from the order maker and credits that amount to the order filler.
     * The fee, calculated as (_amountGet * feePercent / 100), is credited to the fee account.
     * @param _orderId The unique identifier of the order being filled.
     * @param _user The address of the order maker (the one who created the order).
     * @param _tokenGet The address of the token that the order maker wants to receive in exchange.
     * @param _amountGet The amount of _tokenGet that the order maker expects to receive.
     * @param _tokenGive The address of the token that the order maker is offering to trade away.
     * @param _amountGive The amount of _tokenGive that the order maker is willing to give in exchange.
     * Requirements:
     * - The order filler (msg.sender) must have at least (_amountGet + feeAmount) of _tokenGet.
     * - The order maker (_user) must have at least _amountGive of _tokenGive.
     * Emits a {Trade} event.
     */

    function _trade(
        uint256 _orderId,
        address _user,
        address _tokenGet,
        uint256 _amountGet,
        address _tokenGive,
        uint256 _amountGive
    ) internal {
        uint256 feeAmount = (_amountGet * feePercent) / 100;

        // Ensure the order filler has enough of _tokenGet to cover the amount plus fee
        require(
            tokens[_tokenGet][msg.sender] >= (_amountGet + feeAmount),
            "Trade failed: Insufficient balance to cover amount plus fee"
        );

        // Ensure the order maker has enough of _tokenGive to cover the offered amount
        require(
            tokens[_tokenGive][_user] >= _amountGive,
            "Trade failed: Order maker has insufficient token balance"
        );

        // Deduct the amount plus fee from the order filler
        tokens[_tokenGet][msg.sender] -= (_amountGet + feeAmount);
        // Credit the order creator with the requested amount
        tokens[_tokenGet][_user] += _amountGet;
        // Credit the fee account with the fee
        tokens[_tokenGet][feeAccount] += feeAmount;

        // Deduct the offered token from the order creator
        tokens[_tokenGive][_user] -= _amountGive;
        // Credit the order filler with the offered token
        tokens[_tokenGive][msg.sender] += _amountGive;

        emit Trade(
            _orderId,
            _user,
            _tokenGet,
            _amountGet,
            _tokenGive,
            _amountGive,
            msg.sender,
            block.timestamp
        );
    }
}
