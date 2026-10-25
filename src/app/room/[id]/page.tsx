import { RoomClient } from "@/components/room-client";
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; icebreaker?: string }>;
}) {
  const { id } = await params;
  const { invite, icebreaker } = await searchParams;
  return (
    <RoomClient
      id={id}
      invited={invite === "1"}
      icebreakerInvite={icebreaker === "1"}
    />
  );
}
