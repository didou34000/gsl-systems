// No Cloudflare credentials or identity forwarding on the public Node deployment.
export const env = {} as {DB?: D1Database; FILES?: R2Bucket};
