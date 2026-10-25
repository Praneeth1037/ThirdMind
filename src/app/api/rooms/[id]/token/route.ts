import { AccessToken } from "livekit-server-sdk";
import { api, json } from "@/server/http";
import { authenticatedRoom, HttpError } from "@/server/rooms";
import { rateLimit } from "@/server/store";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await params;
    const { member } = await authenticatedRoom(id, request);
    await rateLimit(`token:${id}:${member.id}`, 12);
    const url = process.env.LIVEKIT_URL,
      key = process.env.LIVEKIT_API_KEY,
      secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret)
      throw new HttpError(
        "Calls need LiveKit. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to your server environment. Group chat is ready to use.",
        503,
      );
    const token = new AccessToken(key, secret, {
      identity: member.id,
      name: member.name,
      ttl: "1h",
    });
    token.addGrant({
      room: id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return json({ token: await token.toJwt(), url });
  });
}
