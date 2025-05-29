import dotenv from "dotenv";
dotenv.config();
import blessed from "blessed";
import { ethers } from "ethers";
import { swapTokens } from './src/swap.js';
import { mintToken } from './src/mint.js';
import { processWallet } from './src/tokenTransfer.js';
import { createTokenAuto } from './src/createToken.js';

// Configuration
const RPC_URL = process.env.RPC_URL || "https://dream-rpc.somnia.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const PING_TOKEN = "0x33e7fab0a8a5da1a923180989bd617c9c2d1c493";
const PONG_TOKEN = "0x9beaa0016c22b646ac311ab171270b0ecf23098f";

// Global variables
let provider;
let wallet;
let isAutoSwapping = false;
let isAutoSending = false;
let isMinting = false;
let autoAllRunning = false;
let currentWalletIndex = 0;
let totalWallets = 0;
let wallets = [];

// Add configuration for Auto All
const autoAllConfig = {
    createToken: true,
    doSwaps: true,
    doSends: true,
    swapMin: 5,
    swapMax: 10,
    sendMin: 4,
    sendMax: 8,
    delayMin: 2000,  // 2 seconds
    delayMax: 5000   // 5 seconds
};

// Initialize blessed screen
const screen = blessed.screen({
    smartCSR: true,
    title: "Somnia Auto Swap Bot",
    fullUnicode: true
});

// Create header box with branding
const headerBox = blessed.box({
    top: 0,
    left: 'center',
    width: '100%',
    height: '20%',
    content: `{center}{bold}{cyan-fg}
    ╔═══════════════════════════════════════╗
    ║             SOMNIA AUTO SWAP          ║
    ║      Developed by HIMANSHU SAROHA     ║
    ╚═══════════════════════════════════════╝{/cyan-fg}{/bold}{/center}`,
    tags: true,
    style: {
        fg: 'white'
    }
});

// Create wallet info box
const walletBox = blessed.box({
    top: '20%',
    right: 0,
    width: '40%',
    height: '30%',
    label: ' Wallet Info ',
    border: { type: 'line' },
    tags: true,
    style: {
        border: { fg: 'magenta' },
        fg: 'white'
    }
});

// Create logs box
const logsBox = blessed.box({
    top: '20%',
    left: 0,
    width: '60%',
    height: '80%',
    label: ' Swap Logs ',
    border: { type: 'line' },
    scrollable: true,
    alwaysScroll: true,
    tags: true,
    style: {
        border: { fg: 'blue' },
        fg: 'white'
    }
});

// Create menu with more options
const menuBox = blessed.list({
    bottom: 0,
    right: 0,
    width: '40%',
    height: '50%',
    label: ' Menu ',
    items: [
        "Auto Swap PING/PONG",
        "Mint PING Token",
        "Mint PONG Token",
        "Auto Send Token",
        "Create Random Token",
        "Auto All",
        "Next Wallet",
        "Stop All Tasks",
        "Clear Logs",
        "Refresh Balance",
        "Exit"
    ],
    border: { type: 'line' },
    style: {
        selected: { bg: 'green', fg: 'black' },
        border: { fg: 'yellow' }
    },
    keys: true,
    mouse: true
});

// Create a custom prompt for amount input
const promptBox = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 'shrink',
    width: '50%',
    top: 'center',
    left: 'center',
    label: ' Enter Amount ',
    tags: true,
    keys: true,
    mouse: true,
    style: {
        fg: 'white',
        bg: 'black',
        border: {
            fg: 'blue'
        }
    }
});

// Helper functions
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let formattedMessage = '';
    
    // Split message into lines and format each line
    const lines = message.split('\n');
    lines.forEach((line, index) => {
        let prefix = index === 0 ? `[${timestamp}] ` : ' '.repeat(timestamp.length + 3);
        
        switch(type) {
            case 'error':
                formattedMessage += `{red-fg}${prefix}${line}{/red-fg}\n`;
                break;
            case 'success':
                formattedMessage += `{green-fg}${prefix}${line}{/green-fg}\n`;
                break;
            default:
                formattedMessage += `${prefix}${line}\n`;
        }
    });
    
    // Remove trailing newline
    formattedMessage = formattedMessage.slice(0, -1);
    
    logsBox.pushLine(formattedMessage);
    logsBox.setScrollPerc(100);
    screen.render();
}

async function updateWalletInfo() {
    try {
        if (!wallet) return;
        
        const [pingContract, pongContract] = [
            new ethers.Contract(PING_TOKEN, ["function balanceOf(address) view returns (uint256)"], wallet),
            new ethers.Contract(PONG_TOKEN, ["function balanceOf(address) view returns (uint256)"], wallet)
        ];
        
        const [pingBalance, pongBalance, nativeBalance] = await Promise.all([
            pingContract.balanceOf(wallet.address),
            pongContract.balanceOf(wallet.address),
            provider.getBalance(wallet.address)
        ]);

        const content = `{bold}Address:{/bold} ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} {yellow-fg}[${currentWalletIndex + 1}/${totalWallets}]{/yellow-fg}
{cyan-fg}PING Balance:{/cyan-fg} ${Number(ethers.formatUnits(pingBalance, 18)).toFixed(4)}
{cyan-fg}PONG Balance:{/cyan-fg} ${Number(ethers.formatUnits(pongBalance, 18)).toFixed(4)}
{cyan-fg}STT Balance:{/cyan-fg} ${Number(ethers.formatUnits(nativeBalance, 18)).toFixed(4)}
{magenta-fg}Current Wallet:{/magenta-fg} ${currentWalletIndex + 1} of ${totalWallets}`;
        
        walletBox.setContent(content);
        screen.render();
    } catch (error) {
        log(`Error updating wallet info: ${error.message}`, 'error');
    }
}

async function startAutoSwap() {
    if (isAutoSwapping) return;
    isAutoSwapping = true;
    
    while (isAutoSwapping) {
        try {
            const fromToken = Math.random() < 0.5 ? PING_TOKEN : PONG_TOKEN;
            const toToken = fromToken === PING_TOKEN ? PONG_TOKEN : PING_TOKEN;
            
            await swapTokens(fromToken, toToken, wallet);
            await updateWalletInfo();
            
            // Random delay between swaps (15-30 seconds)
            await new Promise(resolve => setTimeout(resolve, Math.random() * 15000 + 15000));
        } catch (error) {
            log(`Swap error: ${error.message}`, 'error');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Initialize application
async function initialize() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Read all private keys from .env file
        const envContent = await import('fs').then(fs => fs.readFileSync('.env', 'utf8'));
        const privateKeys = envContent
            .split('\n')
            .filter(line => line.trim().startsWith('PRIVATE_KEY='))
            .map(line => line.split('=')[1].trim())
            .filter(key => key.length > 0);

        if (privateKeys.length === 0) {
            log("Please add PRIVATE_KEY entries in the .env file", 'error');
            return;
        }

        // Initialize all wallets
        wallets = privateKeys.map(pk => {
            // Add 0x prefix if missing
            const formattedPk = pk.startsWith('0x') ? pk : `0x${pk}`;
            return new ethers.Wallet(formattedPk, provider);
        });
        
        totalWallets = wallets.length;
        currentWalletIndex = 0;
        wallet = wallets[currentWalletIndex];
        
        log(`Initialized ${totalWallets} wallet(s) successfully`, 'success');
        await updateWalletInfo();
    } catch (error) {
        log(`Initialization error: ${error.message}`, 'error');
    }
}

// Event handlers
process.on('swap:log', (message, current, total) => {
    log(message);
});

process.on('swap:success', async (message) => {
    log(message, 'success');
    await updateWalletInfo();
});

process.on('swap:error', (message) => {
    log(message, 'error');
});

process.on('token:create', (message) => {
    log(message);
});

process.on('token:deploy', (message) => {
    log(message);
});

process.on('token:success', (message) => {
    log(message, 'success');
});

// Add these event listeners after the existing process.on handlers
process.on('transfer:log', (message) => {
    log(message);
});

process.on('transfer:success', (message) => {
    log(message, 'success');
});

process.on('transfer:error', (message) => {
    log(message, 'error');
});

// Menu event handling
menuBox.on('select', async (item) => {
    const selected = item.content;
    switch (selected) {
        case 'Auto Swap PING/PONG':
            if (!isAutoSwapping) {
                log('Starting auto swap...', 'success');
                startAutoSwap();
            }
            break;
        case 'Mint PING Token':
            if (!isMinting) {
                isMinting = true;
                log("Starting PING token mint...");
                try {
                    await mintToken(PING_TOKEN, "PING", wallet);
                    log("PING token minted successfully!", 'success');
                } catch (error) {
                    log(`Mint failed: ${error.message}`, 'error');
                }
                isMinting = false;
                await updateWalletInfo();
            }
            break;
        case 'Mint PONG Token':
            if (!isMinting) {
                isMinting = true;
                log("Starting PONG token mint...");
                try {
                    await mintToken(PONG_TOKEN, "PONG", wallet);
                    log("PONG token minted successfully!", 'success');
                } catch (error) {
                    log(`Mint failed: ${error.message}`, 'error');
                }
                isMinting = false;
                await updateWalletInfo();
            }
            break;
        case 'Auto Send Token':
            if (!isAutoSending) {
                isAutoSending = true;
                const numSends = Math.floor(Math.random() * 5) + 4; // 4-8 sends
                log(`Starting auto send process (${numSends} sends)...`);
                
                (async () => {
                    for (let i = 0; i < numSends; i++) {
                        if (!isAutoSending) break;
                        
                        try {
                            // Random amount between 0.001 and 0.005
                            const amount = (Math.random() * 0.004 + 0.001).toFixed(6);
                            await processWallet(wallet, amount, i + 1, numSends);
                            await updateWalletInfo();
                            
                            // Add delay between sends (1-3 seconds)
                            if (i < numSends - 1) {
                                await delay(Math.random() * 2000 + 1000);
                            }
                        } catch (error) {
                            log(`Send ${i + 1}/${numSends} failed: ${error.message}`, 'error');
                        }
                    }
                    
                    isAutoSending = false;
                    log("Auto send completed", 'success');
                })();
            }
            break;
        case 'Create Random Token':
            if (!isMinting) {
                isMinting = true;
                log("Starting token creation process...");
                try {
                    const tokenAddress = await createTokenAuto();
                    await updateWalletInfo();
                } catch (error) {
                    log(`Token creation failed: ${error.message}`, 'error');
                }
                isMinting = false;
            }
            break;
        case 'Auto All':
            if (!autoAllRunning) {
                autoAll();
            }
            break;
        case 'Next Wallet':
            await cycleWallet();
            break;
        case 'Stop All Tasks':
            isAutoSwapping = false;
            isAutoSending = false;
            autoAllRunning = false;
            log("Stopping all running tasks...", 'success');
            break;
        case 'Clear Logs':
            logsBox.setContent('');
            screen.render();
            break;
        case 'Refresh Balance':
            await updateWalletInfo();
            log("Balances refreshed", 'success');
            break;
        case 'Exit':
            process.exit(0);
    }
});

// Helper function for delays
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Key bindings
screen.key(['escape', 'q', 'C-c'], () => process.exit(0));
screen.key(['C-up'], () => {
    logsBox.scroll(-1);
    screen.render();
});
screen.key(['C-down'], () => {
    logsBox.scroll(1);
    screen.render();
});

// Setup screen
screen.append(headerBox);
screen.append(walletBox);
screen.append(logsBox);
screen.append(menuBox);

// Focus menu and start
menuBox.focus();
screen.render();
initialize();

// Add function to cycle through wallets
async function cycleWallet() {
    currentWalletIndex = (currentWalletIndex + 1) % totalWallets;
    wallet = wallets[currentWalletIndex];
    await updateWalletInfo();
    log(`Switched to wallet ${currentWalletIndex + 1}/${totalWallets}`, 'success');
}

// Update Auto All function to run directly
async function autoAll() {
    if (!autoAllRunning) {
        autoAllRunning = true;
        log("Starting Auto All process...");
        
        for (let i = 0; i < wallets.length; i++) {
            if (!autoAllRunning) break;
            
            currentWalletIndex = i;
            wallet = wallets[currentWalletIndex];
            await updateWalletInfo();
            log(`\n=== Processing wallet ${i + 1}/${totalWallets} ===`, 'info');
            
            try {
                // 1. Create Random Token
                log("1. Creating random token...");
                try {
                    const tokenAddress = await createTokenAuto();
                    log(`✅ Token created successfully`, 'success');
                    await delay(2000);
                } catch (error) {
                    log(`❌ Token creation failed: ${error.message}`, 'error');
                }

                // 2. Auto Swaps (3-5 times)
                log("2. Starting auto swaps...");
                const numSwaps = Math.floor(Math.random() * 3) + 3; // 3-5 swaps
                
                for (let j = 0; j < numSwaps; j++) {
                    if (!autoAllRunning) break;
                    
                    // Random amount between 10-50
                    const amount = (Math.random() * 40 + 10).toFixed(2);
                    
                    // Alternate between PING->PONG and PONG->PING
                    const fromToken = j % 2 === 0 ? PING_TOKEN : PONG_TOKEN;
                    const toToken = j % 2 === 0 ? PONG_TOKEN : PING_TOKEN;
                    
                    try {
                        await swapTokens(fromToken, toToken, wallet, amount);
                        log(`✅ Swap ${j + 1}/${numSwaps} completed`, 'success');
                        await updateWalletInfo();
                        await delay(Math.random() * 3000 + 2000);
                    } catch (error) {
                        log(`❌ Swap ${j + 1}/${numSwaps} failed: ${error.message}`, 'error');
                    }
                }

                // 3. Auto Sends (3-6 times)
                log("3. Starting auto sends...");
                const numSends = Math.floor(Math.random() * 4) + 3; // 3-6 sends
                
                for (let k = 0; k < numSends; k++) {
                    if (!autoAllRunning) break;
                    
                    try {
                        // Random amount between 0.001-0.005
                        const amount = (Math.random() * 0.004 + 0.001).toFixed(6);
                        log(`Starting send ${k + 1}/${numSends} with amount: ${amount} ETH`);
                        
                        // Wait for the transfer to complete
                        await processWallet(wallet, amount, k + 1, numSends);
                        
                        // Add delay between sends
                        if (k < numSends - 1) {
                            await delay(Math.random() * 2000 + 1000);
                        }
                    } catch (error) {
                        log(`❌ Send ${k + 1}/${numSends} failed: ${error.message}`, 'error');
                    }
                }

                log(`✅ Completed Auto All for wallet ${i + 1}/${totalWallets}`, 'success');
                await delay(3000);

            } catch (error) {
                log(`❌ Error in Auto All for wallet ${i + 1}/${totalWallets}: ${error.message}`, 'error');
            }
        }
        
        autoAllRunning = false;
        log("\n=== Auto All process completed for all wallets! ===", 'success');
    } else {
        log("Auto All is already running!", 'error');
    }
}

// Helper function to format transaction hash
function formatTxHash(hash) {
    if (!hash) return '';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
}
