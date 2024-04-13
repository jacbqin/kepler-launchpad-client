import base58 from "bs58";
import { Connection, Keypair } from "@solana/web3.js";
import { decodeUTF8 } from "tweetnacl-util";
import { privateKey } from "./key.json";
import BN from "bn.js";
import { LaunchpadClient } from "./sdk/sdk";
import axios from "axios";
import nacl from "tweetnacl";
let token = "";

const apiPrefix = "https://b.kepler.homes/api/launchpad/solana";

import { PublicKey } from "@solana/web3.js";
const connection = new Connection(`https://api.devnet.solana.com/`, "confirmed");
const programId = new PublicKey("Bjxk4pzkq8TVRMvK38Kfm56GRJPNvHkS8FUAgdvTGzEu");
const client = new LaunchpadClient(connection, programId);
const user = Keypair.fromSecretKey(base58.decode(privateKey));
console.log("user: ", user.publicKey.toBase58());

const logTs = function (tag: string, ts: string) {
    console.log(tag, `https://explorer.solana.com/tx/${ts}?cluster=devnet`);
};

async function main() {
    await userLogin();
    // await solPay();
    await usdcPay();
    // await claim();
    // await refundSol();
    // await refundUsdc();
}

async function userLogin() {
    const message = "login";
    const messageBytes = decodeUTF8(message);
    const signature = base58.encode(nacl.sign.detached(messageBytes, user.secretKey));
    const url = `${apiPrefix}/user/login?address=${user.publicKey.toBase58()}&signature=${signature}`;
    console.log("url: ", url);
    let res = await axios.get(url);
    token = res.data.data.token;
    console.log("token: ", token);
}

const solPay = async () => {
    const amount = new BN(0.1 * 1e6);
    const url = `${apiPrefix}/pay/sol-pay-params?Authorization=${token}&amount=${amount.toNumber()}`;
    console.log("url", url);
    let res = await axios.get(url);
    console.log(res.data);
    const { expire_at, vault, message, signature, signer, sol_price } = res.data.data;
    const ts = await client.solPay(
        user,
        amount,
        new BN(sol_price),
        new BN(expire_at),
        new PublicKey(vault),
        new PublicKey(signer),
        base58.decode(message),
        base58.decode(signature)
    );
    logTs("sol pay", ts);
};

const usdcPay = async () => {
    const amount = new BN(Math.trunc(323 * 1e6));
    const url = `${apiPrefix}/pay/usdc-pay-params?Authorization=${token}&amount=${amount.toNumber()}`;
    console.log("url", url);
    let res = await axios.get(url);
    console.log(res.data);
    const { token_price, sol_price, usdc, expire_at, vault, message, signature, signer } = res.data.data;
    const ts = await client.tokenPay(
        user, //
        new PublicKey(usdc),
        new PublicKey(vault),
        amount,
        new BN(token_price),
        new BN(sol_price),
        new BN(expire_at),
        new PublicKey(signer),
        base58.decode(message),
        base58.decode(signature)
    );
    logTs("usdc pay", ts);
};

const claim = async () => {
    const url = `${apiPrefix}/claim/claim-params?Authorization=${token}`;
    console.log("url", url);
    let res = await axios.get(url);
    console.log(res.data);
    const { amount, mint, expire_at, message, signature, signer } = res.data.data;
    const ts = await client.claim(
        user,
        new PublicKey(mint),
        new BN(amount),
        new BN(expire_at),
        new PublicKey(signer),
        base58.decode(message),
        base58.decode(signature)
    );
    logTs("claim", ts);
};

const refundSol = async () => {
    const url = `${apiPrefix}/refund/refund-sol-params?Authorization=${token}`;
    console.log("url", url);
    let res = await axios.get(url);
    console.log(res.data);
    const { amount, expire_at, refund_id, message, signature, signer } = res.data.data;
    const ts = await client.refundSOL(
        user,
        new BN(refund_id),
        new BN(amount),
        new BN(expire_at),
        new PublicKey(signer),
        base58.decode(message),
        base58.decode(signature)
    );
    logTs("refund sol", ts);
};

const refundUsdc = async () => {
    const url = `${apiPrefix}/refund/refund-usdc-params?Authorization=${token}`;
    console.log("url", url);
    let res = await axios.get(url);
    console.log(res.data);
    const { amount, expire_at, usdc, refund_id, message, signature, signer } = res.data.data;
    const ts = await client.refundToken(
        user,
        new PublicKey(usdc),
        new BN(refund_id),
        new BN(amount),
        new BN(expire_at),
        new PublicKey(signer),
        base58.decode(message),
        base58.decode(signature)
    );
    logTs("refund usdc", ts);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
