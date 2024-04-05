import { PublicKey } from "@solana/web3.js";
import base58 from "bs58";

abstract class BaseAccount {
    constructor(fields, buf: Buffer) {
        let start = 0;
        for (let key of Object.keys(fields)) {
            const type = fields[key];
            const size = this.getTypeSize(type);
            if (size == 0) {
                throw new Error(`unsupported field type, ${key}: ${type}`);
            }
            let end = start + size;
            if (end > buf.length) {
                throw new Error("exceed max bytes length");
            }
            const raw = buf.subarray(start, end);
            const value = this.parseTypeValue(type, raw);
            // console.log(`${key}: ${value}`);
            this[key] = value;
            start = end;
        }
    }
    parseTypeValue(t: string, buf: Buffer) {
        switch (t) {
            case "Pubkey":
                return new PublicKey(base58.encode(buf));
            case "u64":
                return buf.readBigInt64LE(); //binary.LittleEndian.Uint64(bytes);
            case "i64":
                return buf.readBigInt64LE(); // int64(binary.LittleEndian.Uint64(bytes));
            default:
                return 0;
        }
    }

    getTypeSize(t: string) {
        switch (t) {
            case "Pubkey":
                return 32;
            case "u64":
            case "i64":
                return 8;
            default:
                return 0;
        }
    }
}
export class LaunchpadAccount extends BaseAccount {
    static fields = { admin: "Pubkey", signer: "Pubkey" };
    constructor(buf: Buffer) {
        super(LaunchpadAccount.fields, buf);
    }
}
