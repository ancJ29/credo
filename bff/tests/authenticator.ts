import {
  createHash,
  createPrivateKey,
  createSign,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';

/** CBOR for what an attestation object holds: maps, byte and text strings, and integers. */
function cbor(value: unknown): Buffer {
  const head = (major: number, n: number) => {
    if (n < 24) return Buffer.from([(major << 5) | n]);
    if (n < 256) return Buffer.from([(major << 5) | 24, n]);
    return Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
  };
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === 'string')
    return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  const entries = Object.entries(value as Record<string, unknown>);
  return Buffer.concat([
    head(5, entries.length),
    ...entries.flatMap(([k, v]) => [cbor(k), cbor(v)]),
  ]);
}

/** A map whose keys are the integers COSE uses. */
function coseMap(entries: [number, unknown][]) {
  const parts = entries.flatMap(([k, v]) => [cbor(k), cbor(v)]);
  return Buffer.concat([Buffer.from([0xa0 | entries.length]), ...parts]);
}

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest();
const FLAG = { userPresent: 0x01, userVerified: 0x04, attested: 0x40 };

/**
 * A software authenticator: an ES256 key pair per passkey, attestation `none`, answering a
 * ceremony in the browser library's JSON form as a device would. It signs real ceremonies, so the
 * BFF's library checks real signatures. A test chooses the origin, the counter and the user
 * verification an answer claims, to make each fault on purpose.
 */
export class SoftwareAuthenticator {
  readonly credentialId: Buffer;
  private readonly privateKey: KeyObject;
  private readonly publicJwk: { x: string; y: string };
  /** The user handle the registration was made for, as the device keeps it. */
  userHandle = '';
  counter = 0;

  constructor(
    private readonly origin: string,
    /** The relying party an answer is made for; a test changes it to answer for another. */
    public rpId = new URL(origin).hostname,
    /** A passkey already made elsewhere (the stack's walk passkey): its credential id and user
     * handle in base64url and its private key as PKCS8, base64. It answers a ceremony, and never
     * registers one, since its public half is not kept here. */
    held?: { id: string; privateKey: string; userHandle: string },
  ) {
    if (held) {
      this.credentialId = Buffer.from(held.id, 'base64url');
      this.privateKey = createPrivateKey({
        key: Buffer.from(held.privateKey, 'base64'),
        format: 'der',
        type: 'pkcs8',
      });
      this.userHandle = held.userHandle;
      this.publicJwk = { x: '', y: '' };
      return;
    }
    this.credentialId = randomBytes(16);
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = pair.privateKey;
    this.publicJwk = pair.publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  }

  get id() {
    return this.credentialId.toString('base64url');
  }

  private clientData(type: string, challenge: string, origin = this.origin) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  private authData(flags: number, counter: number, attested?: Buffer) {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    return Buffer.concat([
      sha256(this.rpId),
      Buffer.from([flags]),
      count,
      ...(attested ? [attested] : []),
    ]);
  }

  /** The answer to the options a join or an add gave. */
  register(
    options: { challenge: string; user: { id: string } },
    claim: {
      origin?: string;
      verified?: boolean;
      /** The transports the answer reports; none when null. */
      transports?: string[] | null;
      /** A packed attestation whose signature is not the key's: the library says not verified. */
      forged?: boolean;
    } = {},
  ) {
    this.userHandle = options.user.id;
    const key = coseMap([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(this.publicJwk.x, 'base64url')],
      [-3, Buffer.from(this.publicJwk.y, 'base64url')],
    ]);
    const length = Buffer.alloc(2);
    length.writeUInt16BE(this.credentialId.length);
    const flags =
      FLAG.userPresent | FLAG.attested | (claim.verified === false ? 0 : FLAG.userVerified);
    const authData = this.authData(
      flags,
      this.counter,
      Buffer.concat([Buffer.alloc(16), length, this.credentialId, key]),
    );
    const clientData = this.clientData('webauthn.create', options.challenge, claim.origin);
    const forgery = createSign('sha256').update(Buffer.concat([authData, sha256(clientData)]));
    const attestationObject = claim.forged
      ? cbor({
          fmt: 'packed',
          attStmt: {
            alg: -7,
            sig: forgery.sign(generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey),
          },
          authData,
        })
      : cbor({ fmt: 'none', attStmt: {}, authData });
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      response: {
        clientDataJSON: clientData.toString('base64url'),
        attestationObject: attestationObject.toString('base64url'),
        ...(claim.transports === null ? {} : { transports: claim.transports ?? ['internal'] }),
      },
      clientExtensionResults: {},
    };
  }

  /** The answer to the options a sign-in gave. `counter` moves on by one unless the test sets it. */
  authenticate(
    options: { challenge: string },
    claim: {
      origin?: string;
      verified?: boolean;
      counter?: number;
      userHandle?: string | null;
      tamper?: boolean;
    } = {},
  ) {
    this.counter = claim.counter ?? this.counter + 1;
    const flags = FLAG.userPresent | (claim.verified === false ? 0 : FLAG.userVerified);
    const authData = this.authData(flags, this.counter);
    const clientData = this.clientData('webauthn.get', options.challenge, claim.origin);
    const signer = createSign('sha256');
    signer.update(Buffer.concat([authData, sha256(clientData)]));
    const signature = signer.sign(this.privateKey);
    if (claim.tamper) signature[signature.length - 1] ^= 1;
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      response: {
        clientDataJSON: clientData.toString('base64url'),
        authenticatorData: authData.toString('base64url'),
        signature: signature.toString('base64url'),
        ...(claim.userHandle === null ? {} : { userHandle: claim.userHandle ?? this.userHandle }),
      },
      clientExtensionResults: {},
    };
  }
}
