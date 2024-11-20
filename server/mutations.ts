"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/drizzle";
import { YouTubeChannels, YouTubeChannelType } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
export async function addChannelForUser(
  name: string
): Promise<YouTubeChannelType> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const [newChannel] = await db
    .insert(YouTubeChannels)
    .values({
      name,
      userId,
    })
    .returning();

  return newChannel;
}

export async function removeChannelForUser(id: string): Promise<void> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  await db
    .delete(YouTubeChannels)
    .where(and(eq(YouTubeChannels.id, id), eq(YouTubeChannels.userId, userId)));
}
