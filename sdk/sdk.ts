import { VekeplRecycleClaim } from "./instructions";
import { Key, PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    TransactionInstruction,
    Transaction,
    sendAndConfirmTransaction,
    Ed25519Program,
} from "@solana/web3.js";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Buffer } from "buffer";
import {
    CreateToken,
    MintNFT as MintToken,
    InitializeLaunchpad,
    SolPay,
    TokenPay,
    Claim,
    InitializeTokenVault,
    RefundToken,
    RefundSOL,
    InitializeSolVault,
    Redeem,
} from "../sdk/instructions";
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

    findUserRedeemPDA(user: PublicKey, mint?: PublicKey) {
        return PublicKey.findProgramAddressSync([Buffer.from("Redeem"), user.toBytes(), mint.toBytes()], this.programId)[0];
    }

    findUserVekeplRecycleClaimPDA(user: PublicKey, mint?: PublicKey) {
        return PublicKey.findProgramAddressSync([Buffer.from("VekeplRecycleClaim"), user.toBytes(), mint.toBytes()], this.programId)[0];
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

    async initializeLaunchpad(admin: Keypair, signer: PublicKey) {
        const launchpadAccountPDA = this.findLaunchpadAccountPDA();
        const mintAuthorityPDA = this.findMintAuthorityPDA();
        const instructionData = new InitializeLaunchpad({});
        let tx = new Transaction().add(
            new TransactionInstruction({
                keys: [
                    { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // Payer
                    { pubkey: signer, isSigner: false, isWritable: false }, // Signer
                    { pubkey: launchpadAccountPDA, isSigner: false, isWritable: true }, // launchpad account
                    { pubkey: mintAuthorityPDA, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                ],
                programId: this.programId,
                data: instructionData.toBuffer(),
            })
        );
        return await sendAndConfirmTransaction(this.connection, tx, [admin], { skipPreflight: false });
    }

    async initializeTokenVault(admin: Keypair, mint: PublicKey) {
        let tx = new Transaction().add(
            new TransactionInstruction({
                keys: [
                    { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // Payer
                    { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                    { pubkey: mint, isSigner: false, isWritable: true }, // mint
                    { pubkey: this.findTokenVaultPDA(mint), isSigner: false, isWritable: true }, // vault
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent account
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                ],
                programId: this.programId,
                data: new InitializeTokenVault({}).toBuffer(),
            })
        );
        return await sendAndConfirmTransaction(this.connection, tx, [admin], { skipPreflight: false });
    }

    async initializeSolVault(admin: Keypair) {
        let tx = new Transaction().add(
            new TransactionInstruction({
                keys: [
                    { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // Payer
                    { pubkey: this.findSolVaultPDA(), isSigner: false, isWritable: true }, // sol vault
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent account
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                ],
                programId: this.programId,
                data: new InitializeSolVault({ lamports: 1e3 }).toBuffer(),
            })
        );
        return await sendAndConfirmTransaction(this.connection, tx, [admin], { skipPreflight: false });
    }

    async createToken(admin: Keypair, mintKeypair: Keypair, name: string, symbol: string, uri: string, decimals: number) {
        const metadataAddress = PublicKey.findProgramAddressSync(
            [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
            TOKEN_METADATA_PROGRAM_ID
        )[0];
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true }, // Mint account
                { pubkey: this.findMintAuthorityPDA(), isSigner: false, isWritable: true }, // Mint authority account
                { pubkey: metadataAddress, isSigner: false, isWritable: true }, // Metadata account
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent account
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false }, // Token metadata program
            ],
            programId: this.programId,
            data: new CreateToken({ name, symbol, uri, decimals }).toBuffer(),
        });
        return await sendAndConfirmTransaction(this.connection, new Transaction().add(ix), [admin, mintKeypair], { skipPreflight: false });
    }

    async mintToken(admin: Keypair, mint: PublicKey, to: PublicKey, amount: BN) {
        const associatedTokenAccountAddress = await getAssociatedTokenAddress(mint, to);
        const instructionData = new MintToken({ amount });
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: to, isSigner: false, isWritable: false }, // to
                { pubkey: mint, isSigner: false, isWritable: true }, // Mint account
                { pubkey: this.findMintAuthorityPDA(), isSigner: false, isWritable: true }, // Mint authority account
                { pubkey: associatedTokenAccountAddress, isSigner: false, isWritable: true }, // ATA
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
            ],
            programId: this.programId,
            data: instructionData.toBuffer(),
        });
        return await sendAndConfirmTransaction(this.connection, new Transaction().add(ix), [admin]);
    }

    async transferTokenToVault(user: Keypair, mint: PublicKey, amount: number) {
        const sourceAccount = getAssociatedTokenAddressSync(mint, user.publicKey);
        const destinationAccount = this.findTokenVaultPDA(mint);
        const tx = new Transaction().add(createTransferInstruction(sourceAccount, destinationAccount, user.publicKey, amount));
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: false });
    }

    async solPay(user: Keypair, amount: BN, solPrice: BN, expireAt: BN, vault: PublicKey, signer: PublicKey, message: Uint8Array, signature: Uint8Array) {
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
            data: new SolPay({ amount, solPrice, expireAt, signature }).toBuffer(),
        });
        let tx = new Transaction().add(this.ed25519Instruction(signer, message, signature)).add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: true });
    }

    async tokenPay(
        user: Keypair,
        mint: PublicKey,
        recipient: PublicKey,
        amount: BN,
        tokenPrice: BN,
        solPrice: BN,
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
            data: new TokenPay({ amount, tokenPrice, solPrice, expireAt, signature }).toBuffer(),
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

    async redeem(
        user: Keypair,
        mint: PublicKey,
        redeemId: BN,
        powerValue: BN,
        tokenAmount: BN,
        expireAt: BN,
        signer: PublicKey,
        message: Uint8Array,
        signature: Uint8Array
    ) {
        const vault_account = this.findTokenVaultPDA(mint);
        const user_token_account = getAssociatedTokenAddressSync(mint, user.publicKey);
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: user.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: this.findUserRedeemPDA(user.publicKey, mint), isSigner: false, isWritable: true }, // user redeem account
                { pubkey: mint, isSigner: false, isWritable: true }, // Mint account
                { pubkey: vault_account, isSigner: false, isWritable: true }, //vault token account
                { pubkey: user_token_account, isSigner: false, isWritable: true }, // user_token_account
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // sysvar
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
            ],
            programId: this.programId,
            data: new Redeem({ redeemId, powerValue, tokenAmount, expireAt, signature }).toBuffer(),
        });
        let tx = new Transaction().add(this.ed25519Instruction(signer, message, signature)).add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [user], { skipPreflight: false });
    }

    async vekeplRecycleClaim(
        user: Keypair,
        mint: PublicKey,
        claimId: BN,
        amount: BN,
        expireAt: BN,
        signer: PublicKey,
        message: Uint8Array,
        signature: Uint8Array
    ) {
        const vault_account = this.findTokenVaultPDA(mint);
        const user_token_account = getAssociatedTokenAddressSync(mint, user.publicKey);
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: user.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: this.findLaunchpadAccountPDA(), isSigner: false, isWritable: true }, // launchpad account
                { pubkey: this.findUserVekeplRecycleClaimPDA(user.publicKey, mint), isSigner: false, isWritable: true }, // user claim account
                { pubkey: mint, isSigner: false, isWritable: true }, // Mint account
                { pubkey: vault_account, isSigner: false, isWritable: true }, //vault token account
                { pubkey: user_token_account, isSigner: false, isWritable: true }, // user_token_account
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // sysvar
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
            ],
            programId: this.programId,
            data: new VekeplRecycleClaim({ claimId, amount, expireAt, signature }).toBuffer(),
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
