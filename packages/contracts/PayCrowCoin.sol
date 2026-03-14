// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PayCrowUSD (PUSD)
 * @dev Simulated USDC for the PayCrow Escrow Platform.
 * Built with EIP-2612 Permit for gasless approvals.
 */
contract PayCrowUSD is ERC20, ERC20Permit, Ownable {
    constructor(
        address initialOwner
    ) ERC20("USD Coin", "USDC") ERC20Permit("USD Coin") Ownable(initialOwner) {
        // Initial mint for liquidity (1 Million USDC)
        _mint(msg.sender, 1000000 * 10 ** 6);
    }

    /**
     * @notice Set decimals to 6 to perfectly simulate official USDC behavior.
     */
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    /**
     * @notice God-mode minting for demo purposes.
     * @param to The address receiving the test tokens.
     * @param amount The amount to mint (remember 6 decimals).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
