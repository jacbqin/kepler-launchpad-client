import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    TransactionInstruction,
    Transaction,
    sendAndConfirmTransaction,
    Ed25519Program,
} from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Buffer } from "buffer";
import { SolPay, TokenPay, Claim, RefundToken, RefundSOL } from "../sdk/instructions";
import { LaunchpadAccount } from "../sdk/accounts";
import BN from "bn.js";

export class LaunchpadClient {
    constructor(public connection: Connection, public programId: PublicKey) {}

    findLaunchpadAccountPDA() {
        return PublicKey.findProgramAddressSync([Buffer.from("Launchpad")], this.programId)[0];
    }

    findMintAuthorityPDA() {
        return PublicKey.findProgramAddressSync([Buffer.from("MintAuthority")], this.programId)[0];
    }

    findTokenVaultPDA(mint: PublicKey) {
        return PublicKey.findProgramAddressSync([Buffer.from("TokenVault"), mint.toBytes()], this.programId)[0];
    }

    findSolVaultPDA() {
        return PublicKey.findProgramAddressSync([Buffer.from("SolVault")], this.programId)[0];
    }

    findUserRefundPDA(user: PublicKey, mint?: PublicKey) {
        if (mint != null) return PublicKey.findProgramAddressSync([Buffer.from("Refund"), user.toBytes(), mint.toBytes()], this.programId)[0];
        return PublicKey.findProgramAddressSync([Buffer.from("Refund"), user.toBytes()], this.programId)[0];
    }

    async getTokenBalance(tokenAccount: PublicKey) {
        try {
            return (await this.connection.getTokenAccountBalance(tokenAccount)).value;
        } catch (err) {
            return {};
        }
    }

    async queryLaunchpadAccount() {
        const launchpadAccountPDA = this.findLaunchpadAccountPDA();
        const info = await this.connection.getAccountInfoAndContext(launchpadAccountPDA);
        if (info.value) {
            return new LaunchpadAccount(info.value.data);
        }
    }

    async solPay(user: Keypair, amount: BN, expireAt: BN, vault: PublicKey, signer: PublicKey, message: Uint8Array, signature: Uint8Array) {
        const launchpadAccountPDA = this.findLaunchpadAccountPDA();
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: user.publicKey, isSigner: true, isWritable: true }, // user
                { pubkey: launchpadAccountPDA, isSigner: false, isWritable: true }, // launchpad account
                { pubkey: vault, isSigner: false, isWritable: true }, // vault
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // sysvar
            ],
            programId: this.programId,
            data: new SolPay({ amount, expireAt, signature }).toBuffer(),
        });
        let tx = new Transaction().add(this.ed25519Instruction(signer, message, signature)).add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: true });
    }

    async tokenPay(
        user: Keypair,
        mint: PublicKey,
        recipient: PublicKey,
        amount: BN,
        price: BN,
        expireAt: BN,
        signer: PublicKey,
        message: Uint8Array,
        signature: Uint8Array
    ) {
        const userTokenAccount = await getAssociatedTokenAddress(mint, user.publicKey);
        const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipient);
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: user.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: mint, isSigner: false, isWritable: true }, // mint
                { pubkey: recipient, isSigner: false, isWritable: true }, // mint
                { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // from Token account
                { pubkey: recipientTokenAccount, isSigner: false, isWritable: true }, // to Token account
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // sysvar
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
            ],
            programId: this.programId,
            data: new TokenPay({ amount, price, expireAt, signature }).toBuffer(),
        });
        let tx = new Transaction().add(this.ed25519Instruction(signer, message, signature)).add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: false });
    }

    async claim(user: Keypair, mint: PublicKey, amount: BN, expireAt: BN, signer: PublicKey, message: Uint8Array, signature: Uint8Array) {
        const vaultPDA = this.findTokenVaultPDA(mint);
        const to = getAssociatedTokenAddressSync(mint, user.publicKey);
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: user.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: mint, isSigner: false, isWritable: true }, // Mint account
                { pubkey: vaultPDA, isSigner: false, isWritable: true }, //vault token account
                { pubkey: to, isSigner: false, isWritable: true }, // user_token_account
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // sysvar
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
            ],
            programId: this.programId,
            data: new Claim({ amount, expireAt, signature }).toBuffer(),
        });
        let tx = new Transaction().add(this.ed25519Instruction(signer, message, signature)).add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: false });
    }

    async refundToken(user: Keypair, mint: PublicKey, refundId: BN, amount: BN, expireAt: BN, signer: PublicKey, message: Uint8Array, signature: Uint8Array) {
        const vaultPDA = this.findTokenVaultPDA(mint);
        const to = getAssociatedTokenAddressSync(mint, user.publicKey);
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: user.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: this.findUserRefundPDA(user.publicKey, mint), isSigner: false, isWritable: true }, // user refund account
                { pubkey: mint, isSigner: false, isWritable: true }, // Mint account
                { pubkey: vaultPDA, isSigner: false, isWritable: true }, //vault token account
                { pubkey: to, isSigner: false, isWritable: true }, // user_token_account
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // sysvar
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
            ],
            programId: this.programId,
            data: new RefundToken({ refundId, amount, expireAt, signature }).toBuffer(),
        });
        let tx = new Transaction().add(this.ed25519Instruction(signer, message, signature)).add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: false });
    }

    async refundSOL(user: Keypair, refundId: BN, amount: BN, expireAt: BN, signer: PublicKey, message: Uint8Array, signature: Uint8Array) {
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: user.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: this.findUserRefundPDA(user.publicKey), isSigner: false, isWritable: true }, // user refund account
                { pubkey: this.findSolVaultPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // sysvar
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
            ],
            programId: this.programId,
            data: new RefundSOL({ refundId, amount, expireAt, signature }).toBuffer(),
        });
        let tx = new Transaction().add(this.ed25519Instruction(signer, message, signature)).add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: false });
    }

    ed25519Instruction(signer: PublicKey, message: Uint8Array, signature: Uint8Array) {
        return Ed25519Program.createInstructionWithPublicKey({
            publicKey: signer.toBytes(),
            message,
            signature,
        });
    }
}
