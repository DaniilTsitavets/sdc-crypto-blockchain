// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract MultiSigWallet {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Deposit(address indexed sender, uint value, uint balance);
    event SubmitTransaction(
        address indexed owner,
        uint indexed txId,
        address indexed to,
        uint value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint indexed txId);
    event RevokeConfirmation(address indexed owner, uint indexed txId);
    event ExecuteTransaction(address indexed owner, uint indexed txId);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public required; // minimum confirmations to execute

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint confirmationCount;
    }

    Transaction[] public transactions;
    // txId => owner => confirmed
    mapping(uint => mapping(address => bool)) public isConfirmed;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    modifier txExists(uint _txId) {
        require(_txId < transactions.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint _txId) {
        require(!transactions[_txId].executed, "tx already executed");
        _;
    }

    modifier notConfirmed(uint _txId) {
        require(!isConfirmed[_txId][msg.sender], "tx already confirmed");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address[] memory _owners, uint _required) {
        require(_owners.length > 0, "owners required");
        require(
            _required > 0 && _required <= _owners.length,
            "invalid required count"
        );

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "zero address owner");
            require(!isOwner[owner], "duplicate owner");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
    }

    // -------------------------------------------------------------------------
    // Receive ETH
    // -------------------------------------------------------------------------

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    // -------------------------------------------------------------------------
    // Core functions
    // -------------------------------------------------------------------------

    /// @notice Propose a new transaction; returns the transaction index.
    function submitTransaction(
        address _to,
        uint _value,
        bytes calldata _data
    ) external onlyOwner returns (uint txId) {
        txId = transactions.length;
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                confirmationCount: 0
            })
        );
        emit SubmitTransaction(msg.sender, txId, _to, _value, _data);
    }

    /// @notice Confirm a pending transaction.
    function confirmTransaction(uint _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
        notConfirmed(_txId)
    {
        Transaction storage txn = transactions[_txId];
        isConfirmed[_txId][msg.sender] = true;
        txn.confirmationCount += 1;
        emit ConfirmTransaction(msg.sender, _txId);
    }

    /// @notice Execute a transaction once it has enough confirmations.
    function executeTransaction(uint _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
    {
        Transaction storage txn = transactions[_txId];
        require(txn.confirmationCount >= required, "insufficient confirmations");

        txn.executed = true;
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txId);
    }

    /// @notice Revoke a previously given confirmation (only before execution).
    function revokeConfirmation(uint _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
    {
        require(isConfirmed[_txId][msg.sender], "tx not confirmed");

        isConfirmed[_txId][msg.sender] = false;
        transactions[_txId].confirmationCount -= 1;
        emit RevokeConfirmation(msg.sender, _txId);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() external view returns (uint) {
        return transactions.length;
    }

    function getTransaction(uint _txId)
        external
        view
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint confirmationCount
        )
    {
        Transaction storage txn = transactions[_txId];
        return (txn.to, txn.value, txn.data, txn.executed, txn.confirmationCount);
    }
}