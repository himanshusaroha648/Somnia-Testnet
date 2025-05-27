import { ethers } from 'ethers';

const mintAbi = [
    "function mint() public payable",
    "function balanceOf(address owner) view returns (uint256)",
    "function isMinter(address account) view returns (bool)"
];

export async function mintToken(tokenAddress, tokenName, wallet) {
    try {
        console.log(`\nMinting ${tokenName}...`);
        const contract = new ethers.Contract(tokenAddress, mintAbi, wallet);

        // Check if already minted
        const balance = await contract.balanceOf(wallet.address);
        if (balance > 0) {
            console.log(`Already minted ${tokenName}. Current balance: ${ethers.formatUnits(balance, 18)}`);
            return;
        }

        // First, try to initialize the contract
        console.log("Initializing contract...");
        try {
            const initTx = await contract.mint({
                value: 0,
                gasLimit: 500000
            });
            console.log("Initialization tx sent:", initTx.hash);
            await initTx.wait();
            console.log("Contract initialized successfully!");
        } catch (initErr) {
            if (initErr.message.includes("already initialized")) {
                console.log("Contract already initialized");
            } else {
                console.log("Initialization not required");
            }
        }

        // Now try to mint
        const amount = 1000;
        console.log(`Attempting to mint ${amount}.0 ${tokenName}...`);
        
        // First mint transaction
        console.log("Please confirm the first mint transaction in your wallet...");
        const tx1 = await contract.mint({
            value: 0,
            gasLimit: 500000
        });
        console.log(`${tokenName} Mint Tx Hash:`, tx1.hash);
        console.log("Waiting for transaction confirmation...");
        const receipt1 = await tx1.wait();
        
        if (receipt1.status === 1) {
            console.log("First mint successful!");
        } else {
            console.log("First mint failed, trying second mint...");
        }

        // Second mint transaction
        console.log("\nPlease confirm the second mint transaction in your wallet...");
        const tx2 = await contract.mint({
            value: 0,
            gasLimit: 500000
        });
        console.log(`${tokenName} Mint Tx Hash:`, tx2.hash);
        console.log("Waiting for transaction confirmation...");
        const receipt2 = await tx2.wait();
        
        if (receipt2.status === 1) {
            console.log("Second mint successful!");
            console.log(`✔ Success: Minted ${amount} ${tokenName}`);
        } else {
            console.log("Second mint failed");
        }
    } catch (err) {
        if (err.message.includes("already minted")) {
            console.log(`Already minted ${tokenName}`);
        } else if (err.message.includes("insufficient funds")) {
            console.log("❌ Error: Insufficient funds for minting");
        } else {
            console.error(`${tokenName} Mint Error:`, err.reason || err.message);
        }
    }
}
