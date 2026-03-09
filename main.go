package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

var (
	keys = []string{
		"68544020247570407220244063724074",
		"54684020247570407220244063724074",
		"54684020247570407220244063727440",
	}
	targetHash   = "f28fe539655fd6f7275a09b7c3508a3f81573fc42827ce34ddf1ec8d5c2421c3"
	encryptedMsg = "876b4e970c3516f333bcf5f16d546a87aaeea5588ead29d213557efc1903997e"
	iv           = "656e6372797074696f6e496e74566563"
)

func findKey() []byte {
	for _, k := range keys {
		raw, _ := hex.DecodeString(k)
		hash := sha256.Sum256(raw)
		if hex.EncodeToString(hash[:]) == targetHash {
			return raw
		}
	}
	return nil
}

func decrypt(key []byte) []byte {
	msg, _ := hex.DecodeString(encryptedMsg)
	ivBytes, _ := hex.DecodeString(iv)
	block, _ := aes.NewCipher(key)
	cipher.NewCBCDecrypter(block, ivBytes).CryptBlocks(msg, msg)
	return msg[:len(msg)-int(msg[len(msg)-1])]
}

func sign(msg []byte) (*ecdsa.PublicKey, []byte, []byte) {
	privKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	hash := sha256.Sum256(msg)
	r, s, _ := ecdsa.Sign(rand.Reader, privKey, hash[:])
	return &privKey.PublicKey, r.Bytes(), s.Bytes()
}

func main() {
	key := findKey()
	msg := decrypt(key)
	pubKey, r, s := sign(msg)

	fmt.Printf("Symmetric key: %s\n", hex.EncodeToString(key))
	fmt.Printf("Decrypted msg: %s\n", msg)
	fmt.Printf("Public key X:  %s\n", pubKey.X.Text(16))
	fmt.Printf("Public key Y:  %s\n", pubKey.Y.Text(16))
	fmt.Printf("Signature R:   %s\n", hex.EncodeToString(r))
	fmt.Printf("Signature S:   %s\n", hex.EncodeToString(s))
}
