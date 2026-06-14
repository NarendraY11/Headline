import { Client, Receiver } from "@upstash/qstash";

let _client: Client | null = null;
let _receiver: Receiver | null = null;

export function getQStash(): Client {
  if (!_client) {
    _client = new Client({ token: process.env.QSTASH_TOKEN! });
  }
  return _client;
}

export function getQStashReceiver(): Receiver {
  if (!_receiver) {
    _receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });
  }
  return _receiver;
}

export async function verifyQStashSignature(
  body: string,
  signature: string
): Promise<boolean> {
  try {
    return await getQStashReceiver().verify({ body, signature });
  } catch {
    return false;
  }
}
