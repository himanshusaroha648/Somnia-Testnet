import dotenv from 'dotenv';
dotenv.config();

import { JsonRpcProvider, ethers } from 'ethers';
import kleur from 'kleur';
import fs from 'fs';
import moment from 'moment-timezone';
import fetch from 'node-fetch';
import chalk from 'chalk';
import readline from 'readline';

// Token addresses
const PING_TOKEN = "0x33e7fab0a8a5da1a923180989bd617c9c2d1c493";

// === Only RPC details changed here ===
const rpcProviders = [
  new JsonRpcProvider('https://dream-rpc.somnia.network'), // Somnia Testnet RPC
];

let currentRpcProviderIndex = 0;

function provider() {  
  return rpcProviders[currentRpcProviderIndex];  
}

function rotateRpcProvider() {  
  currentRpcProviderIndex = (currentRpcProviderIndex + 1) % rpcProviders.length;  
  return provider(); 
}

// Explorer base URL
const baseExplorerUrl = 'https://somnia-testnet.socialscan.io';

// Explorer URLs
const explorer = {
  get tx() {
    return (txHash) => `${baseExplorerUrl}/tx/${txHash}`;
  },
  get address() {
    return (address) => `${baseExplorerUrl}/address/${address}`;
  }
};

// Log helper
function appendLog(message) {
  fs.appendFileSync('log-somnia.txt', message + '\n');
}

// Function to generate random transaction value
function getRandomTransactionValue() {
  const min = 0.000001;  // Minimum value for transaction
  const max = 0.00001;   // Maximum value for transaction
  return Math.random() * (max - min) + min;
}

// === Random wallet address generator ===
function generateRandomAddress() {
  const randomPrivateKey = ethers.Wallet.createRandom().privateKey;
  const wallet = new ethers.Wallet(randomPrivateKey);
  return wallet.address;
}

// Function to add delay between transactions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to read private keys
function readPrivateKeys() {
    return process.env.PRIVATE_KEYS
        ? process.env.PRIVATE_KEYS.split(',').map(k => k.trim()).filter(Boolean)
        : [];
}

// Function to get random recipient
function getRandomRecipient() {
    return generateRandomAddress();
}

// Function to approve tokens
async function approveTokens(wallet) {
    try {
        const tokenContract = new ethers.Contract(
            PING_TOKEN,
            [
                "function approve(address spender, uint256 amount) public returns (bool)",
                "function allowance(address owner, address spender) view returns (uint256)"
            ],
            wallet
        );

        const amount = ethers.parseUnits("1000000", 18); // Approve 1M tokens
        const tx = await tokenContract.approve(wallet.address, amount);
        process.emit('transfer:log', `Approval TX: ${formatTxHash(tx.hash)}`);
        return tx;
    } catch (error) {
        process.emit('transfer:error', `Approval failed: ${error.message}`);
        return null;
    }
}

// Function to send tokens
async function sendTokens(wallet, recipient, amount) {
    try {
        const tokenContract = new ethers.Contract(
            PING_TOKEN,
            [
                "function transfer(address to, uint256 amount) public returns (bool)",
                "function balanceOf(address account) view returns (uint256)"
            ],
            wallet
        );

        // Convert amount to token decimals
        const tokenAmount = ethers.parseUnits(amount, 18);
        const tx = await tokenContract.transfer(recipient, tokenAmount);
        
        process.emit('transfer:log', `Send TX: ${formatTxHash(tx.hash)}`);
        process.emit('transfer:log', `Amount: ${amount} ETH`);
        process.emit('transfer:log', `To: ${formatAddress(recipient)}`);
        
        return tx;
    } catch (error) {
        process.emit('transfer:error', `Send failed: ${error.message}`);
        return null;
    }
}

// Function to process a single wallet
export async function processWallet(wallet, amount, current, total) {
    try {
        // Get random recipient
        const recipient = getRandomRecipient();
        
        // First approve tokens
        const approveTx = await approveTokens(wallet);
        if (approveTx) {
            await approveTx.wait();
        }

        // Then send tokens
        const sendTx = await sendTokens(wallet, recipient, amount);
        if (sendTx) {
            await sendTx.wait();
            process.emit('transfer:success', `Transaction confirmed: ${amount} ETH sent [${current}/${total}]`);
        }
    } catch (error) {
        process.emit('transfer:error', `Transaction failed: ${error.message}`);
        throw error;
    }
}

// Helper function to format transaction hash
function formatTxHash(hash) {
    if (!hash) return '';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
}

// Helper function to format address
function formatAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Main function for standalone use
export default async function main() {
    try {
        const privateKeys = readPrivateKeys();
        process.emit('transfer:log', `Detected ${privateKeys.length} wallets in .env.`);

        const batchSize = 1;
        const totalBatches = Math.ceil(privateKeys.length / batchSize);

        for (let i = 0; i < privateKeys.length; i += batchSize) {
            const batchNumber = Math.floor(i / batchSize) + 1;
            process.emit('transfer:log', `Processing Batch ${batchNumber} of ${totalBatches}...`);

            const batch = privateKeys.slice(i, i + batchSize);
            const wallets = batch.map(privateKey => new ethers.Wallet(privateKey, provider()));

            for (let j = 0; j < wallets.length; j++) {
                const wallet = wallets[j];
                await processWallet(wallet);
                await delay(2000);
            }

            process.emit('transfer:success', `Batch ${batchNumber} completed.`);
            await delay(5000);
        }

        process.emit('transfer:success', `All transactions completed.`);
    } catch (error) {
        process.emit('transfer:error', `Error in main process: ${error.message}`);
    }
}
