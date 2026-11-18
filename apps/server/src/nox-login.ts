import { request } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { z } from "zod";

export const secret = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const same = (left: string, right: string) => {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export function origin(value: string, https = false): string {
  const url = new URL(value);
  if (
    !(https ? url.protocol === "https:" : ["http:", "https:"].includes(url.protocol)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("invalid_origin");
  return url.origin;
}
export const AuthConfigSchema = z
  .object({
    issuer: z.string(),
    publicOrigin: z.string(),
    clientId: z.literal("pc-configurator"),
    clientSecret: z.string().min(43),
  })
  .strict();
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export const IdentitySchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  name: z.string().default(""),
  email_verified: z.literal(true),
  nox_admin: z.literal(true),
  google_sub: z.string().min(1),
});
export type Identity = z.infer<typeof IdentitySchema>;
export type Credentials = {
  accessToken: string;
  identity: Identity;
  expires: number;
  renewAt: number;
};
export type Transaction = {
  state: string;
  nonce: string;
  verifier: string;
  created: number;
  expires: number;
};

export function unixRequest(
  socketPath: string,
  path: string,
  method = "GET",
  body?: string,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path,
        method,
        headers: { host: "nox-auth", ...headers },
        signal,
        timeout: 10_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 65536) req.destroy(new Error("auth_response_too_large"));
          else chunks.push(Buffer.from(chunk));
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 500,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("auth_unavailable")));
    req.on("error", () => reject(new Error("auth_unavailable")));
    req.end(body);
  });
}
export class NoXLogin {
  readonly config: AuthConfig;
  constructor(
    config: AuthConfig,
    readonly socketPath: string,
  ) {
    this.config = AuthConfigSchema.parse({
      ...config,
      issuer: origin(config.issuer, true),
      publicOrigin: origin(config.publicOrigin),
    });
    if (!socketPath.startsWith("/")) throw new Error("invalid_auth_socket");
  }
  get callback() {
    return `${this.config.publicOrigin}/auth/nox/callback`;
  }
  get basic() {
    return `Basic ${Buffer.from(`${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`).toString("base64")}`;
  }
  begin(): { transaction: Transaction; url: string } {
    const transaction = {
      state: secret(),
      nonce: secret(),
      verifier: secret(),
      created: Date.now(),
      expires: Date.now() + 600000,
    };
    const url = new URL(`${this.config.issuer}/authorize`);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.callback,
      scope: "openid email profile",
      state: transaction.state,
      nonce: transaction.nonce,
      code_challenge: createHash("sha256").update(transaction.verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return { transaction, url: url.toString() };
  }
  async complete(
    transaction: Transaction,
    query: URLSearchParams,
    signal?: AbortSignal,
  ): Promise<Credentials> {
    if (
      Date.now() < transaction.created ||
      Date.now() >= transaction.expires ||
      query.getAll("state").length !== 1 ||
      query.getAll("code").length !== 1 ||
      !same(transaction.state, query.get("state") ?? "") ||
      !query.get("code") ||
      query.has("error")
    )
      throw new Error("login_denied");
    const result = await unixRequest(
      this.socketPath,
      "/oauth/token",
      "POST",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: query.get("code")!,
        redirect_uri: this.callback,
        code_verifier: transaction.verifier,
      }).toString(),
      { Authorization: this.basic, "Content-Type": "application/x-www-form-urlencoded" },
      signal,
    );
    if (result.status !== 200) throw new Error("login_denied");
    const tokens = z
      .object({
        access_token: z.string().min(1),
        id_token: z.string().min(1),
        expires_in: z.number().positive(),
        token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
      })
      .parse(JSON.parse(result.body));
    const keys = await unixRequest(this.socketPath, "/keys", "GET", undefined, {}, signal);
    if (keys.status !== 200) throw new Error("auth_unavailable");
    const { payload } = await jwtVerify(
      tokens.id_token,
      createLocalJWKSet(JSON.parse(keys.body) as JSONWebKeySet),
      {
        issuer: this.config.issuer,
        audience: this.config.clientId,
        algorithms: ["ES256"],
        requiredClaims: ["exp", "iat", "sub", "nonce"],
        maxTokenAge: "5 minutes",
      },
    );
    if (
      typeof payload.nonce !== "string" ||
      !same(payload.nonce, transaction.nonce) ||
      (payload.azp !== undefined && payload.azp !== this.config.clientId)
    )
      throw new Error("login_denied");
    if (
      Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== this.config.clientId
    )
      throw new Error("login_denied");
    if (
      payload.at_hash !== undefined &&
      (typeof payload.at_hash !== "string" ||
        !same(
          payload.at_hash,
          createHash("sha256")
            .update(tokens.access_token)
            .digest()
            .subarray(0, 16)
            .toString("base64url"),
        ))
    )
      throw new Error("login_denied");
    const identity = IdentitySchema.parse(payload);
    return {
      accessToken: tokens.access_token,
      identity,
      expires: Date.now() + Math.min(tokens.expires_in, 366 * 86400) * 1000,
      renewAt: Date.now() + 30 * 86400000,
    };
  }
  async check(credentials: Credentials, signal?: AbortSignal) {
    const started = Date.now();
    const response = await unixRequest(
      this.socketPath,
      "/oauth/introspect",
      "POST",
      new URLSearchParams({ token: credentials.accessToken }).toString(),
      { Authorization: this.basic, "Content-Type": "application/x-www-form-urlencoded" },
      signal,
    );
    if (response.status >= 500) throw new Error("auth_unavailable");
    if (response.status !== 200) throw new Error("login_denied");
    const result = z
      .object({
        active: z.literal(true),
        client_id: z.literal(this.config.clientId),
        exp: z.number().int().positive(),
      })
      .and(IdentitySchema)
      .parse(JSON.parse(response.body));
    if (result.sub !== credentials.identity.sub || result.exp * 1000 <= Date.now())
      throw new Error("login_denied");
    const validUntil = Math.min(started + 300000, result.exp * 1000);
    if (Date.now() < started || Date.now() >= validUntil) throw new Error("auth_unavailable");
    return { identity: IdentitySchema.parse(result), expires: result.exp * 1000, validUntil };
  }
  async logout(credentials: Credentials) {
    const result = await unixRequest(
      this.socketPath,
      "/v1/logout",
      "POST",
      JSON.stringify({ token: credentials.accessToken, scope: "app" }),
      { Authorization: this.basic, "Content-Type": "application/json" },
    );
    if (result.status !== 204) throw new Error("auth_unavailable");
  }
}
