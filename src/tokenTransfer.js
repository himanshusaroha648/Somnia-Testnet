import dotenv from 'dotenv';
dotenv.config();

import { JsonRpcProvider, ethers } from 'ethers';
import kleur from 'kleur';
import fs from 'fs';
import moment from 'moment-timezone';
import fetch from 'node-fetch';
import chalk from 'chalk';
import readline from 'readline';

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

// Function to process a single wallet
export async function processWallet(wallet, current = 0, total = 0) {
    try {
        const progressInfo = total > 0 ? ` [${current}/${total}]` : '';
        process.emit('transfer:log', `🔍 Checking Balance for Wallet: ${wallet.address}${progressInfo}`);
        
        const balance = await provider().getBalance(wallet.address);
        const balanceInEth = ethers.formatEther(balance);
        process.emit('transfer:log', `Balance: ${balanceInEth} ETH${progressInfo}`);
        
        const randomToAddress = generateRandomAddress();
        const randomAmount = (Math.random() * 0.004) + 0.001; // 0.001-0.005 ETH

        const tx = {
            to: randomToAddress,
            value: ethers.parseEther(randomAmount.toFixed(6)),
            gasLimit: 21000,
            maxFeePerGas: ethers.parseUnits("10", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("5", "gwei")
        };

        const transaction = await wallet.sendTransaction(tx);
        process.emit('transfer:success', `Transaction sent for ${wallet.address}${progressInfo}`);
        
        const receipt = await transaction.wait();
        process.emit('transfer:success', `Transaction confirmed for ${wallet.address}${progressInfo}`);
        
        return true;
    } catch (error) {
        if (error.message.includes('insufficient funds')) {
            process.emit('transfer:error', `Insufficient funds for ${wallet.address}${progressInfo}`);
            try {
                const balance = await provider().getBalance(wallet.address);
                const balanceInEth = ethers.formatEther(balance);
                process.emit('transfer:log', `Balance: ${balanceInEth} ETH${progressInfo}`);
            } catch (balanceError) {
                // Ignore balance error
            }
        } else {
            process.emit('transfer:error', `Error processing wallet: ${error.message}${progressInfo}`);
        }
        return false;
    }
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
