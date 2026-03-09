# Crypto Task

## How it works

`findKey` decodes each candidate key from hex, computes its SHA-256 hash, and returns the one that matches the target hash.

`decrypt` decodes the ciphertext and IV from hex, creates an AES-128-CBC decrypter with the found key, decrypts in-place, and strips PKCS#7 padding by reading the last byte as pad length.

`sign` generates an ephemeral ECDSA key pair on the P-256 curve, hashes the plaintext with SHA-256, and signs the hash. Returns the public key and signature components `r` and `s`.

## Results

**Symmetric key**
```
54684020247570407220244063724074
```

**Decrypted message**
```
Hello Blockchain!
```

**Public key (P-256)**
```
X: d6ef40578c6aac2b5d0de1517351004e167339fa4f17b8712bfa60b9730b8180
Y: b6f7dda57068d5c1601ddee2e6b29629f05d5fa26f1541ab098363505d8cb624
```

**Digital signature (ECDSA)**
```
R: fededa8df0d38833767d16c90c21194ce2c27b473a39b032399dc2cc762f11ba
S: 82b52d9218b24ec2e390d5f7c80b2a52d1626bcf6b856803d3fbabe79840377c
```

## Run

```bash
go run main.go
```
