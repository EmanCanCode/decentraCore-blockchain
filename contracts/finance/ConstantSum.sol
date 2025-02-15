// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/// @notice A simple implementation of a constant sum AMM with a 0.3% fee
/// @author Emmanuel Douge - https://github.com/EmanCanCode/DeFi/blob/main/contracts/ConstantSum.sol
contract ConstantSum {
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

    constructor(IERC20 _tokenA, IERC20 _tokenB) {
        owner = msg.sender;
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    // ----- EVENTS ----- //

    event AddedLiquidity(address indexed to, uint amount);
    event RemovedLiquidity(address indexed from, uint amount);
    event Swapped(
        address indexed from,
        address indexed to,
        uint amountReceived,
        uint amountReturned
    );

    // ----- PRIVATE FUNCTIONS ----- //

    /// @notice Adds liquidity to the pool, minting @param _amount of LP tokens and assigning them to the @param _to address
    /// @param _to The address to mint the LP tokens to
    /// @param _amount The amount of LP tokens to mint
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
            _tokenReceived == address(tokenA) || _tokenReceived == address(tokenB),
            "Token not in pair"
        );
        // Ensure that the amount received is greater than 0, dont want to swap 0 tokens
        require(_amountReceived > 0, "Amount must be greater than 0");
        
        // receive the tokens
        uint amountReceived;
        if (_tokenReceived == address(tokenA)) {
            tokenA.transferFrom(msg.sender, address(this), _amountReceived);
            amountReceived = tokenA.balanceOf(address(this)) - reserveA;
        } else {
            tokenB.transferFrom(msg.sender, address(this), _amountReceived);
            amountReceived = tokenB.balanceOf(address(this)) - reserveB;
        }

        // calculate the amount to return, with standard fee of 0.3%
        // dx = dy
        _amountReturned = (amountReceived * 997) / 1000;
        
        // Update reserves and transfer the tokens
        if (_tokenReceived == address(tokenA)) {
            tokenB.transfer(msg.sender, _amountReturned);
            // transfer fee 
            tokenA.transfer(owner, _amountReceived - _amountReturned);
            _update(reserveA + amountReceived, reserveB - _amountReturned);
        } else {
            tokenA.transfer(msg.sender, _amountReturned);
            // transfer fee
            tokenB.transfer(owner, _amountReceived - _amountReturned);
            _update(reserveA - _amountReturned, reserveB + amountReceived);
        }

        emit Swapped(_tokenReceived, _tokenReceived == address(tokenA) ? address(tokenB) : address(tokenA), amountReceived, _amountReturned);
    }

    /// @notice Adds liquidity to the pool, minting LP tokens and assigning them to the sender
    /// @param _amountA The amount of tokenA to add to the pool
    /// @param _amountB The amount of tokenB to add to the pool
    /// @return _shares The amount of LP tokens that were minted
    function addLiquidity(
        uint256 _amountA,
        uint256 _amountB
    ) external returns (uint _shares) {
        require(_amountA > 0 && _amountB > 0, "Amount must be greater than 0");
        // get the assets from the sender
        tokenA.transferFrom(msg.sender, address(this), _amountA);
        tokenB.transferFrom(msg.sender, address(this), _amountB);

        // ensure that price does not get affected by the liquidity added
        if (reserveA > 0 || reserveB > 0) {
            require(
                reserveA * _amountB == reserveB * _amountA,
                "dx / dy != x / y"
            );
        }

        // calculate the amount of LP tokens to mint
        // constant sum
        if (totalSupply == 0) {
            _shares = _sqrt(_amountA * _amountB); // or would i do _shares = _sqrt(_amountA * _amountB) - 1; ?
        } else {
            _shares = _min(
                (_amountA * totalSupply) / reserveA,
                (_amountB * totalSupply) / reserveB
            );
        }

        require(_shares > 0, "Shares must be greater than 0");
        _mint(msg.sender, _shares);

        _update(
            tokenA.balanceOf(address(this)),
            tokenB.balanceOf(address(this))
        );

        emit AddedLiquidity(msg.sender, _shares);
    }

    /// @notice Removes liquidity from the pool, burning LP tokens and returning the underlying tokens to the sender
    /// @param _shares The amount of LP tokens to remove
    /// @return _amountA The amount of tokenA that was returned
    /// @return _amountB The amount of tokenB that was returned
    function removeLiquidity(uint _shares) external returns (uint _amountA, uint _amountB) {
        require(_shares > 0, "Shares must be greater than 0");
        uint256 balA = tokenA.balanceOf(address(this));
        uint256 bal1 = tokenB.balanceOf(address(this));

        _amountA = (_shares * balA) / totalSupply;
        _amountB = (_shares * bal1) / totalSupply;
        require(_amountA > 0 && _amountB > 0, "_amountA or _amountB = 0");

        _burn(msg.sender, _shares);
        _update(balA - _amountA, bal1 - _amountB);

        tokenA.transfer(msg.sender, _amountA);
        tokenB.transfer(msg.sender, _amountB);

        emit RemovedLiquidity(msg.sender, _shares);
    }
}