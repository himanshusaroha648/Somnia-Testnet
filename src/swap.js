import { ethers } from 'ethers';

// Using the correct swap contract address
const ROUTER = "0x6AAC14f090A35EeA150705f72D90E4CDC4a49b2C";

const swapAbi = [{
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
          { "internalType": "uint256", "name": "amountOutMinimum", "type": "uint256" },
          { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct ExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "exactInputSingle",
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
}];

// Helper function to format transaction hash
function formatTxHash(hash) {
    if (!hash) return '';
    return `0x${hash.substring(2, 6)}...${hash.substring(hash.length - 4)}`;
}

export async function swapTokens(fromToken, toToken, wallet, current = 0, total = 0) {
    try {
        // Convert addresses to checksum format
        const checksumFromToken = ethers.getAddress(fromToken);
        const checksumToToken = ethers.getAddress(toToken);
        const checksumRouter = ethers.getAddress(ROUTER);
        
        const swapContract = new ethers.Contract(
            checksumRouter,
            swapAbi,
            wallet
        );

        // Random amount between 10 and 50
        const amount = (Math.random() * (50 - 10) + 10).toFixed(6);
        const amountIn = ethers.parseUnits(amount.toString(), 18);

        // Get token names for logging
        const tokenInName = checksumFromToken.toLowerCase() === "0x33e7fab0a8a5da1a923180989bd617c9c2d1c493" ? "PING" : "PONG";
        const tokenOutName = tokenInName === "PING" ? "PONG" : "PING";
        
        // First approve the swap contract to spend tokens
        const tokenContract = new ethers.Contract(
            checksumFromToken,
            ["function approve(address spender, uint256 amount) public returns (bool)"],
            wallet
        );

        // Log swap start with progress
        const progressStr = total > 0 ? ` [${current}/${total}]` : '';
        process.emit('swap:log', `Starting swap${progressStr}: ${amount} ${tokenInName} → ${tokenOutName}`, current, total);
        
        // Use max approval amount
        const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approveTx = await tokenContract.approve(
            checksumRouter,
            maxApproval
        );
        
        process.emit('swap:log', `Approval TX: ${formatTxHash(approveTx.hash)}`, current, total);
        await approveTx.wait();
        process.emit('swap:log', `Approval confirmed for ${amount} ${tokenInName}`, current, total);

        // Execute swap with exactInputSingle
        const tx = await swapContract.exactInputSingle({
            tokenIn: checksumFromToken,
            tokenOut: checksumToToken,
            fee: 500,
            recipient: wallet.address,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0n
        });

        process.emit('swap:log', `Swap TX: ${formatTxHash(tx.hash)}`, current, total);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            process.emit('swap:success', `✅ Swapped ${amount} ${tokenInName} → ${tokenOutName}${progressStr}`, current, total);
            return true;
        }
        return false;
    } catch (error) {
        process.emit('swap:error', `❌ Swap failed: ${error.message}`, current, total);
        throw error;
    }
}
