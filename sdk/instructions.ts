import BN from "bn.js";
import * as borsh from "borsh";

enum Instructions {
    InitializeLaunchpad,
    CreateToken,
    MintToken,
    InitializeSolVault,
    InitializeTokenVault,
    SolPay,
    TokenPay,
    Claim,
    RefundToken,
    RefundSOL,
    Redeem,
}

abstract class BaseArgs {
    abstract schema: borsh.Schema;
    abstract instruction: Instructions;
    constructor(properties) {
        Object.keys(properties).map((key) => {
            return (this[key] = properties[key]);
        });
    }

    toBuffer() {
        this["instruction"] = this.instruction;
        return Buffer.from(borsh.serialize(this.schema, this));
    }
}

export class InitializeLaunchpad extends BaseArgs {
    instruction = Instructions.InitializeLaunchpad;
    schema = { struct: { instruction: "u8" } };
}
export class InitializeTokenVault extends BaseArgs {
    instruction = Instructions.InitializeTokenVault;
    schema = { struct: { instruction: "u8" } };
}
export class InitializeSolVault extends BaseArgs {
    instruction = Instructions.InitializeSolVault;
    schema = { struct: { instruction: "u8", lamports: "u64" } };
}

export class CreateToken extends BaseArgs {
    instruction = Instructions.CreateToken;
    schema = { struct: { instruction: "u8", name: "string", symbol: "string", uri: "string", decimals: "u8" } };
}

export class MintNFT extends BaseArgs {
    instruction = Instructions.MintToken;
    schema = { struct: { instruction: "u8", amount: "u64" } };
}

export class SolPay extends BaseArgs {
    instruction = Instructions.SolPay;
    schema = {
        struct: {
            instruction: "u8",
            amount: "u64",
            solPrice: "u64",
            expireAt: "u64",
            signature: { array: { type: "u8", len: 64 } },
        },
    };
}

export class TokenPay extends BaseArgs {
    instruction = Instructions.TokenPay;
    schema = {
        struct: {
            instruction: "u8",
            amount: "u64",
            tokenPrice: "u64",
            solPrice: "u64",
            expireAt: "u64",
            signature: { array: { type: "u8", len: 64 } },
        },
    };
}

export class Claim extends BaseArgs {
    instruction = Instructions.Claim;
    schema = { struct: { instruction: "u8", amount: "u64", expireAt: "u64", signature: { array: { type: "u8", len: 64 } } } };
}

export class Redeem extends BaseArgs {
    instruction = Instructions.Redeem;
    schema = {
        struct: {
            instruction: "u8",
            redeemId: "u64",
            powerValue: "u64",
            tokenAmount: "u64",
            expireAt: "u64",
            signature: { array: { type: "u8", len: 64 } },
        },
    };
}

export class RefundToken extends BaseArgs {
    instruction = Instructions.RefundToken;
    schema = { struct: { instruction: "u8", refundId: "u64", amount: "u64", expireAt: "u64", signature: { array: { type: "u8", len: 64 } } } };
}

export class RefundSOL extends BaseArgs {
    instruction = Instructions.RefundSOL;
    schema = { struct: { instruction: "u8", refundId: "u64", amount: "u64", expireAt: "u64", signature: { array: { type: "u8", len: 64 } } } };
}
