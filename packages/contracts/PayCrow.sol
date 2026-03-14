// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PayCrowEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // This will point to your PayCrowUSD contract address
    IERC20 public immutable token;

    struct Agreement {
        address client;
        address freelancer;
        uint256 totalAmount;
        uint256 releasedAmount;
        bool isFunded;
        bool isCompleted;
    }

    mapping(uint256 => Agreement) public agreements;
    uint256 public nextAgreementId;

    event AgreementCreated(
        uint256 indexed id,
        address indexed client,
        address indexed freelancer,
        uint256 amount
    );
    event FundsReleased(uint256 indexed id, uint256 amount);
    event AgreementClosed(uint256 indexed id);

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token address");
        token = IERC20(_tokenAddress);
    }

    /**
     * @notice Create and fund an agreement in one go using EIP-2612 Permit.
     */
    function createAndFundAgreement(
        address _freelancer,
        uint256 _amount,
        uint256 _deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(_freelancer != address(0), "Invalid freelancer");

        // 1. Call permit on your custom PayCrowUSD contract
        // This validates the signature and sets the allowance
        IERC20Permit(address(token)).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            v,
            r,
            s
        );

        // 2. Pull the funds into this contract
        token.safeTransferFrom(msg.sender, address(this), _amount);

        // 3. Store the agreement details
        agreements[nextAgreementId] = Agreement({
            client: msg.sender,
            freelancer: _freelancer,
            totalAmount: _amount,
            releasedAmount: 0,
            isFunded: true,
            isCompleted: false
        });

        emit AgreementCreated(
            nextAgreementId,
            msg.sender,
            _freelancer,
            _amount
        );
        nextAgreementId++;
    }

    /**
     * @notice Release a specific amount of funds to the freelancer.
     * Use this for milestone-based payments.
     */
    function releaseMilestone(
        uint256 _id,
        uint256 _amount
    ) external nonReentrant {
        Agreement storage agg = agreements[_id];

        require(msg.sender == agg.client, "Only client can release");
        require(agg.isFunded, "Agreement not funded");
        require(!agg.isCompleted, "Agreement already closed");
        require(
            agg.releasedAmount + _amount <= agg.totalAmount,
            "Exceeds total amount"
        );

        agg.releasedAmount += _amount;
        token.safeTransfer(agg.freelancer, _amount);

        emit FundsReleased(_id, _amount);

        // Auto-close if fully paid
        if (agg.releasedAmount == agg.totalAmount) {
            agg.isCompleted = true;
            emit AgreementClosed(_id);
        }
    }

    /**
     * @notice View function to check the remaining balance in an escrow
     */
    function getLockedBalance(uint256 _id) external view returns (uint256) {
        return agreements[_id].totalAmount - agreements[_id].releasedAmount;
    }
}
