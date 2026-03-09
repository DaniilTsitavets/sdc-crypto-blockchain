# Crypto Task1

## Problem

Given three candidate 128-bit symmetric keys, identify the correct one, use it to decrypt an AES-128-CBC message, generate an EC key pair, and produce a digital signature over the plaintext.

## Solution

**Step 1 — Key identification**

Each candidate key is hashed with SHA-256. The result is compared against the provided target hash. The matching key is used in the next step.

**Step 2 — Decryption**

The correct key is used to decrypt the ciphertext with AES-128 in CBC mode using the provided IV. PKCS#7 padding is stripped from the result.

**Step 3 — Key pair generation**

An asymmetric EC key pair is generated using the P-256 curve.

**Step 4 — Digital signature**

The plaintext is hashed with SHA-256 and signed with the private key using ECDSA. The signature consists of two values: `r` and `s`.

## Results

**Symmetric key (hex)**
```
54684020247570407220244063724074
```

**Decrypted message**
```
Hello Blockchain!
```

**Public key, signature** — generated at runtime (EC key pair is ephemeral, values differ on each run).

## Run

```bash
cd task1
go run main.go
```
