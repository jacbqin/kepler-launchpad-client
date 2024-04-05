import { Keypair, PublicKey, Transaction, SystemProgram, Connection, sendAndConfirmTransaction } from "@solana/web3.js";

async function requireAirport(conn: Connection, user: PublicKey) {
    let tx = await conn.requestAirdrop(user, 1e9 * 1000);
    await conn.confirmTransaction(tx, "confirmed");
    return tx;
}

async function transferSOL(conn: Connection, from: Keypair, to: PublicKey, amount: number) {
    var transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: to,
            lamports: amount,
        })
    );
    return await sendAndConfirmTransaction(conn, transaction, [from]);
}

export { requireAirport, transferSOL };
