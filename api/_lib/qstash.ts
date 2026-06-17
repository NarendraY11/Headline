import { Receiver } from "@upstash/qstash";

const _receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function verifyQStashSignature(
  body: string,
  signature: string
): Promise<boolean> {
  try {
    return await _receiver.verify({ body, signature });
  } catch {
    return false;
  }
}
