// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PayCrowEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    struct Project {
        address client;
        address freelancer;
        uint256 amount;
        bool isFunded;
        bool isCompleted;
    }

    mapping(uint256 => Project) public projects;
    uint256 public projectCount;

    event ProjectFunded(
        uint256 indexed projectId,
        address client,
        address freelancer,
        uint256 amount
    );
    event PaymentReleased(
        uint256 indexed projectId,
        address freelancer,
        uint256 amount
    );

    constructor(address _usdcAddress) {
        usdcToken = IERC20(_usdcAddress);
    }

    /**
     * @notice Fund a project in ONE step using ERC20 Permit
     * @param _freelancer The address of the worker
     * @param _amount Total USDC amount (6 decimals)
     * @param _deadline The timestamp until which the signature is valid
     * @param v, r, s These are the components of the user's digital signature
     */
    function fundWithPermit(
        address _freelancer,
        uint256 _amount,
        uint256 _deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        // 1. Execute the permit (This sets the 'allowance' using the signature)
        IERC20Permit(address(usdcToken)).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            v,
            r,
            s
        );

        // 2. Now the contract has permission, so it can pull the funds
        usdcToken.safeTransferFrom(msg.sender, address(this), _amount);

        // 3. Create the project
        projectCount++;
        projects[projectCount] = Project({
            client: msg.sender,
            freelancer: _freelancer,
            amount: _amount,
            isFunded: true,
            isCompleted: false
        });

        emit ProjectFunded(projectCount, msg.sender, _freelancer, _amount);
    }

    function releasePayment(uint256 _projectId) external nonReentrant {
        Project storage project = projects[_projectId];
        require(project.isFunded && !project.isCompleted, "Invalid state");
        require(msg.sender == project.client, "Only client can release");

        project.isCompleted = true;
        usdcToken.safeTransfer(project.freelancer, project.amount);

        emit PaymentReleased(_projectId, project.freelancer, project.amount);
    }
}
