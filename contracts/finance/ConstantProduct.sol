// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/// @notice A simple implementation of a constant product AMM with a 0.3% fee
/// @author Emmanuel Douge - https://github.com/EmanCanCode/DeFi/blob/main/contracts/ConstantProduct.sol
contract ConstantProduct {
    // ----- STATE VARIABLES ----- //

    // The two tokens that are being pooled
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    // Owner of address
    address public immutable owner;
    // Keep track of the reserves of each token
    uint public reserveA; // reserves of tokenA
    uint public reserveB; // reserves of tokenB
    // Keep track of the total supply of the LP tokens (created or burned)
    uint public totalSupply;
    // keep track of the LP tokens owned by each address
    mapping(address => uint) public balanceOf;

    // ----- CONSTRUCTOR ----- //

    // The constructor sets the two tokens that are being pooled - underscore is used to differentiate between the state variable and the local variable
    constructor(IERC20 _tokenA, IERC20 _tokenB) {
        owner = msg.sender;
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    // ----- EVENTS ----- //

    event AddedLiquidity (address indexed to, uint shares);
    event RemovedLiquidity (address indexed from, uint shares);
    event Swapped (address indexed from, address indexed to, uint amountReceived, uint amountReturned);

    // ----- PRIVATE FUNCTIONS ----- //

    /// @notice Adds liquidity to the pool, minting @param _amount of LP tokens and assigning them to the @param _to address
    function _mint(address _to, uint _amount) private {
        balanceOf[_to] += _amount;
        totalSupply += _amount;
    }

    /// @notice Removes liquidity to the pool, burning @param _amount of LP tokens and removing them from the @param _from address
    function _burn(address _from, uint _amount) private {
        balanceOf[_from] -= _amount;
        totalSupply -= _amount;
    }

    /// @notice Updates the reserves of tokenA and tokenB
    /// @param _reserveA The new reserve of tokenA
    /// @param _reserveB The new reserve of tokenB
    function _update(uint _reserveA, uint _reserveB) private {
        reserveA = _reserveA;
        reserveB = _reserveB;
    }

    /// @notice Calculates the square root of a number
    /// @param _y The number to calculate the square root of
    /// @return _z The square root of the number
    function _sqrt(uint256 _y) private pure returns (uint256 _z) {
        if (_y > 3) {
            _z = _y;
            uint256 x = _y / 2 + 1;
            while (x < _z) {
                _z = x;
                x = (_y / x + x) / 2;
            }
        } else if (_y != 0) {
            _z = 1;
        }
    }

    /// @notice Returns the lower value of two numbers
    /// @param _x The first number
    /// @param _y The second number
    /// @return The lower value of the two numbers
    function _min(uint256 _x, uint256 _y) private pure returns (uint256) {
        return _x <= _y ? _x : _y;
    }

    // ----- EXTERNAL FUNCTIONS ----- //

    /// @notice Swaps @param _amountReceived of one token for the other
    /// @param _tokenReceived The token address that is being swapped
    /// @param _amountReceived The amount of tokens that are being swapped
    /// @return _amountReturned The amount of tokens that are returned to the sender
    function swap(
        address _tokenReceived,
        uint _amountReceived
    ) external returns (uint _amountReturned) {
        // Ensure that the token is in the pair - no other tokens can be swapped using this contract
        require(
            _tokenReceived == address(tokenA) ||
                _tokenReceived == address(tokenB),
            "Token not in pair"
        );
        // Ensure that the amount received is greater than 0, dont want to swap 0 tokens
        require(_amountReceived > 0, "Amount must be greater than 0");

        // Collect received token from the sender, depending on which token was received
        bool isTokenA = _tokenReceived == address(tokenA);
        (IERC20 tokenReceived, IERC20 tokenReturned, uint reserveReceived, uint reserveReturned) = isTokenA
            ? (tokenA, tokenB, reserveA, reserveB)
            : (tokenB, tokenA, reserveB, reserveA);
        require(
            tokenReceived.transferFrom(msg.sender, address(this), _amountReceived),
            "TransferFrom failed"
        );

        // Calculate _amountReturned, include fees - standard fee is 0.3%
        // ydx / (x + dx) = dy
        // y is the token return's reserve before the swap
        // dx is the amount of token received (subtract fee)
        // x is the token received's reserve before the swap
        // dy = what is going to be returned to the user
        // x * y = k, where k is the constant product of the reserves
        uint amountReceivedWithFee = (_amountReceived * 997) / 1000;  // 0.3% fee applied 
        _amountReturned = (reserveReturned * amountReceivedWithFee) / (reserveReceived + amountReceivedWithFee);

        // Transfer returned token to the sender, depending on which token was received
        require(
            tokenReturned.transfer(msg.sender, _amountReturned),
            "Transfer out failed"
        );

        // send owner the fee
        require(
            tokenReceived.transfer(owner, _amountReceived - amountReceivedWithFee), // this is the fee calculation
            "Transfer fee failed"
        );

        // Update the reserves of tokenA and tokenB
        _update(
            tokenA.balanceOf(address(this)),
            tokenB.balanceOf(address(this))
        );

        emit Swapped(msg.sender, address(tokenReturned), _amountReceived, _amountReturned);
    }


    /// @notice Adds liquidity to the pool, minting LP tokens and assigning them to the sender
    /// @param _amountA The amount of tokenA to add to the pool
    /// @param _amountB The amount of tokenB to add to the pool
    /// @return _shares The amount of LP tokens that were minted
    function addLiquidity(uint _amountA, uint _amountB) external returns (uint _shares) {
        // Get tokenA and tokenB
        tokenA.transferFrom(msg.sender, address(this), _amountA);
        tokenB.transferFrom(msg.sender, address(this), _amountB);

        /* 
            dy / dx = y / x
            dx = amount of tokenA reserve
            dy = amount of tokenB reserve
            x = amount of tokenA
            y = amount of tokenB 
        */
        // require that the product of the reserves is equal to the product of the new reserves
        if (reserveA > 0 || reserveB > 0) {
            require(reserveA * _amountB == reserveB * _amountA, "dy / dx != y / x");  // quick math - cross multiply instead of dividing
        }
        // Mint shares, without affecting the price of the pool
        if (totalSupply == 0) {
            _shares = _sqrt(_amountA * _amountB);
        } else {
            _shares = _min(
                (_amountA * totalSupply) / reserveA,
                (_amountB * totalSupply) / reserveB
            );
        }
        _mint(msg.sender, _shares);

        // Update reserves
        _update(
            tokenA.balanceOf(address(this)),
            tokenB.balanceOf(address(this))
        );

        emit AddedLiquidity(msg.sender, _shares);
    }


    /// @notice Removes liquidity from the pool, burning LP tokens and returning the underlying tokens to the sender
    /// @param _shares The amount of LP tokens to remove
    /// @return amountA The amount of tokenA that was returned
    /// @return amountB The amount of tokenB that was returned
    function removeLiquidity(
        uint _shares
    ) external  returns (uint amountA, uint amountB) {

        // Get the balance of tokenA and tokenB
        uint256 bal0 = tokenA.balanceOf(address(this));
        uint256 bal1 = tokenB.balanceOf(address(this));

        // Calculate the amount of tokenA and tokenB to return
        /* 
            dx, dy = amount of liquidity to remove
            dx = s / T * x
            dy = s / T * y
        */
        amountA = (_shares * bal0) / totalSupply;
        amountB = (_shares * bal1) / totalSupply;
        require(amountA > 0 && amountB > 0, "amountA or amountB = 0");

        // Burn shares
        _burn(msg.sender, _shares);

        // Update reserves
        _update(bal0 - amountA, bal1 - amountB);

        // Transfer tokens to the sender
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);

        emit RemovedLiquidity(msg.sender, _shares);
    }
}