"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/drizzle";
import {
  Videos,
  YouTubeChannelType,
  YouTubeChannels,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
export async function getVideosForUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return db.select().from(Videos).where(eq(Videos.userId, userId));
}
export async function getChannelsForUser(): Promise<YouTubeChannelType[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return db
    .select()
    .from(YouTubeChannels)
    .where(eq(YouTubeChannels.userId, userId));
}
