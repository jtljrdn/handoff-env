# @handoff-env/crypto specification

This package provides every cryptographic primitive used by Handoff. It has no I/O, no database access, and no environment lookups. It is designed to run identically in the browser, in Bun (CLI), and in Bun-based server code.

All callers MUST `await ready()` before invoking any other function. Calling a function before `ready()` resolves throws.

## Primitive choices

| Use | Algorithm | Reason |
|-----|-----------|--------|
| Identity keypair | X25519 (`crypto_box_keypair`) | Standard for sealed boxes; small keys; good library coverage. |
| Wrap secrets to a public key (org DEK to a member, to a token) | X25519 sealed box (`crypto_box_seal`) | One-shot, ephemeral sender key, anonymous. Exactly what we need. |
| Symmetric AEAD for variables and for wrapping the user's private key | XChaCha20-Poly1305 (`crypto_aead_xchacha20poly1305_ietf`) | 192-bit nonce makes random nonces safe; AEAD lets us bind variable IDs as associated data. |
| Passphrase KDF | Argon2id (`crypto_pwhash` with `ALG_ARGON2ID13`) | Memory-hard, current best practice, available in libsodium. |
| Recovery code → private-key wrap key | BLAKE2b (`crypto_generichash`) of the raw recovery bytes | Recovery code is generated from a CSPRNG with full entropy, so a slow KDF is unnecessary; BLAKE2b is fast and gives a clean 32-byte key. |
| Hashing tokens for storage | SHA-256 (`crypto_hash_sha256`) | We only need a one-way hash with no length-extension worries; matches existing `api_token` storage. |
| Random bytes | `randombytes_buf` | Crypto-grade RNG from libsodium. |

## KDF parameters

Default Argon2id parameters are tuned for ~250-500 ms on commodity 2024+ hardware:

```
ops_limit = crypto_pwhash_OPSLIMIT_MODERATE   // 3 iterations
mem_limit = crypto_pwhash_MEMLIMIT_MODERATE   // 256 MiB
salt      = 16 random bytes
output    = 32 bytes
```

Each user's `kdf_salt`, `kdf_ops_limit`, and `kdf_mem_limit` are stored alongside their `encrypted_private_key` so the parameters can be raised in the future without breaking existing users.

## Recovery code format

- 32 random bytes from `randombytes_buf(32)`.
- Encoded for display as **base32** (RFC 4648, no padding), giving 52 characters.
- Displayed in groups of 4 separated by hyphens: `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`.
- Parsing is case-insensitive, ignores whitespace and hyphens.
- The 32-byte derived wrap key is `crypto_generichash(32, raw_bytes)`. We hash rather than use the raw bytes directly so that the on-screen code and the wrap key are not byte-identical (defense in depth against accidental display in logs).

## Sealed box (DEK to recipient public key)

The org DEK is wrapped with `crypto_box_seal(dek, recipient_public_key)`. Output is a single byte string of length `dek_length + crypto_box_SEALBYTES (48)`. To unwrap, the recipient supplies both their public and secret key. Sealed boxes are anonymous: the recipient cannot tell who sealed the box. That is fine for our use because the act of sealing is always authenticated by a signed-in member of the org.

## Symmetric AEAD format

For both variable encryption and private-key wrapping, the on-the-wire shape is:

```
{
  ciphertext: Uint8Array   // libsodium output, includes 16-byte Poly1305 tag
  nonce:      Uint8Array   // 24 bytes, random
}
```

Variable encryption MUST pass the variable ID as associated data so that swapping ciphertexts between variables is detectable. Private-key wrapping uses no associated data (the encrypted private key is bound to its user row by foreign key).

Encoding for transport / storage is base64 standard (with padding) for `bytea` columns and base64url (no padding) for token strings.

## Public API surface

All exports from `@handoff-env/crypto`:

```ts
ready(): Promise<void>

// primitives
randomBytes(n: number): Uint8Array

// identity
generateIdentity(): { publicKey: Uint8Array; privateKey: Uint8Array }

// passphrase KDF
generateKdfSalt(): Uint8Array
DEFAULT_KDF_PARAMS: { opsLimit: number; memLimit: number }
deriveKekFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  params?: { opsLimit: number; memLimit: number },
): Uint8Array

// symmetric AEAD (XChaCha20-Poly1305)
generateDek(): Uint8Array
encryptWithKey(
  plaintext: Uint8Array,
  key: Uint8Array,
  associatedData?: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array }
decryptWithKey(
  payload: { ciphertext: Uint8Array; nonce: Uint8Array },
  key: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array

// sealed box (X25519)
sealToPublicKey(plaintext: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array
openSealedBox(
  ciphertext: Uint8Array,
  recipientPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array,
): Uint8Array

// recovery code
generateRecoveryCode(): { display: string; wrapKey: Uint8Array }
deriveRecoveryWrapKey(display: string): Uint8Array

// token hashing
sha256(input: Uint8Array): Uint8Array

// encoding helpers
toBase64(bytes: Uint8Array): string
fromBase64(s: string): Uint8Array
toBase64Url(bytes: Uint8Array): string
fromBase64Url(s: string): Uint8Array
```

## Invariants and tests

The test suite verifies:

1. Round-trip: encrypting and decrypting any byte sequence yields the original.
2. Tamper detection: flipping any bit of `ciphertext`, `nonce`, or associated data causes decryption to throw.
3. Wrong-key rejection: decrypting with a different key throws.
4. Sealed-box anonymity and round-trip across distinct keypairs.
5. KDF determinism: same passphrase + salt + params yields the same key.
6. KDF separation: different salt or different params yields a different key.
7. Recovery code round-trip: generated display string parses back to the same wrap key, case-insensitively, with or without separators.
8. Recovery code rejection: a code with a single character flipped does not yield the same wrap key.
9. Random output: 1000 keypairs are pairwise distinct; 1000 nonces are pairwise distinct.
10. End-to-end lifecycle: founder creates org DEK, wraps to founder, member joins, member is wrapped, both can decrypt the same variable; neither party can decrypt with the other's wrapped DEK directly without using their own private key.

## Out of scope

- Key serialization formats for transport (handled by callers using base64 helpers).
- Persistence (the package never reads or writes anywhere).
- Authentication (handled by Better Auth).
- Forward secrecy on the transport (handled by TLS).
