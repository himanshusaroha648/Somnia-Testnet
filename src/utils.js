import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Use Somnia testnet RPC
const RPC_URL = 'https://rpc.ankr.com/somnia_testnet/6e3fd81558cf77b928b06b38e9409b4677b637118114e83364486294d5ff4811';

export const ROUTER = "0x7468c4683683097bb4294042a7627b19246be062";
export const PING = "0x33E7fAB0a8a5da1A923180989bD617c9c2D1C493";
export const PONG = "0x9beaA0016c22B646Ac311Ab171270B0ECf23098F";

export const erc20Abi = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

export async function initializeProvider(walletAddress) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // If wallet address is provided, use it
        if (walletAddress) {
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            return { provider, wallet };
        }
        
        // Otherwise use default wallet
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        return { provider, wallet };
    } catch (err) {
        console.error("Error initializing provider:", err.message);
        throw err;
    }
}

export async function getTokenBalance(tokenAddress, wallet, provider) {
    try {
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ["function balanceOf(address owner) view returns (uint256)"],
            provider
        );
        
        const balance = await tokenContract.balanceOf(wallet.address);
        return ethers.formatUnits(balance, 18);
    } catch (err) {
        console.error("Error getting token balance:", err.message);
        return "0";
    }
}
