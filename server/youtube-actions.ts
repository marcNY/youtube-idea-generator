"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/drizzle";
import { eq, and } from "drizzle-orm";
import {
  YouTubeChannels,
  Videos,
  VideoComments,
  Video,
  VideoComment,
} from "@/server/db/schema";
import { google, youtube_v3 } from "googleapis";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

async function getChannelId(channelName: string): Promise<string | null> {
  try {
    const response = await youtube.search.list({
      part: ["snippet"],
      type: ["channel"],
      q: channelName,
      maxResults: 1,
    });

    return response.data.items?.[0]?.id?.channelId || null;
  } catch (error) {
    console.error("Error fetching channel ID:", error);
    return null;
  }
}

async function fetchAllVideosForChannel(channelId: string): Promise<string[]> {
  let allVideoIds: string[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    try {
      const response = await youtube.search.list({
        part: ["id"],
        channelId: channelId,
        type: ["video"],
        order: "date",
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const data: youtube_v3.Schema$SearchListResponse = response.data;
      const videoIds =
        (data.items
          ?.map((item) => item.id?.videoId)
          .filter(Boolean) as string[]) || [];
      allVideoIds = allVideoIds.concat(videoIds);

      nextPageToken =
        data.nextPageToken !== null ? data.nextPageToken : undefined;
    } catch (error) {
      console.error("Error fetching YouTube videos:", error);
      break;
    }
  } while (nextPageToken);

  return allVideoIds;
}

async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
  try {
    const response = await youtube.videos.list({
      part: ["snippet", "statistics"],
      id: videoIds,
    });

    return (
      response.data.items?.map((item) => ({
        id: { videoId: item.id! },
        snippet: item.snippet!,
        statistics: item.statistics!,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching video details:", error);
    return [];
  }
}

async function fetchVideoComments(videoId: string): Promise<YouTubeComment[]> {
  let allComments: YouTubeComment[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    try {
      const response = await youtube.commentThreads.list({
        part: ["snippet"],
        videoId: videoId,
        maxResults: 100,
        pageToken: nextPageToken,
      });

      const data: youtube_v3.Schema$CommentThreadListResponse = response.data;
      const comments =
        data.items?.map((item) => ({
          id: item.id!,
          snippet: item.snippet!.topLevelComment!.snippet!,
        })) || [];
      allComments = allComments.concat(comments);

      // Stop fetching if we have reached 100 comments
      if (allComments.length >= 100) {
        allComments = allComments.slice(0, 100);
        break;
      }

      nextPageToken =
        data.nextPageToken !== null ? data.nextPageToken : undefined;
    } catch (error) {
      console.error(`Error fetching comments for video ${videoId}:`, error);
      break;
    }
  } while (nextPageToken);

  return allComments;
}

interface YouTubeVideo {
  id: {
    videoId: string;
  };
  snippet: youtube_v3.Schema$VideoSnippet;
  statistics: youtube_v3.Schema$VideoStatistics;
}

interface YouTubeComment {
  id: string;
  snippet: youtube_v3.Schema$CommentSnippet;
}

function getBestThumbnail(
  thumbnails: youtube_v3.Schema$ThumbnailDetails
): string {
  if (thumbnails.maxres) return thumbnails.maxres.url!;
  if (thumbnails.standard) return thumbnails.standard.url!;
  if (thumbnails.high) return thumbnails.high.url!;
  if (thumbnails.medium) return thumbnails.medium.url!;
  return thumbnails.default!.url!;
}

/**
 * Scrapes videos and comments from YouTube channels associated with the authenticated user
 * 
 * This function:
 * 1. Gets the authenticated user ID
 * 2. Retrieves all YouTube channels associated with the user from the database
 * 3. For each channel:
 *    - Gets/updates the channel ID if not already stored
 *    - Fetches all video IDs for that channel
 *    - Gets detailed video information for each video
 *    - Stores new videos in the database
 *    - Fetches and stores up to 100 comments per video
 * 
 * @returns An array of newly added Video objects
 * @throws Error if user is not authenticated or has no channels
 */
export async function scrapeVideos() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  // Get all YouTube channels for this user
  const channels = await db
    .select()
    .from(YouTubeChannels)
    .where(eq(YouTubeChannels.userId, userId));

  if (channels.length === 0) {
    throw new Error("No channels found for the user");
  }

  const newVideos: Video[] = [];
  const newComments: VideoComment[] = [];

  // Process each channel
  for (const channel of channels) {
    // Get channel ID if not already stored
    if (!channel.channelId) {
      const channelId = await getChannelId(channel.name);

      if (!channelId) {
        console.error(`Could not find channel ID for ${channel.name}`);
        continue;
      }

      // Update channel with the found ID
      await db
        .update(YouTubeChannels)
        .set({ channelId, updatedAt: new Date() })
        .where(
          and(
            eq(YouTubeChannels.id, channel.id),
            eq(YouTubeChannels.userId, userId)
          )
        );

      channel.channelId = channelId;
    }

    // Fetch all videos for this channel
    const videoIds = await fetchAllVideosForChannel(channel.channelId);
    const videoDetails = await fetchVideoDetails(videoIds);

    // Process each video
    for (const video of videoDetails) {
      // Check if video already exists in database
      const existingVideo = await db
        .select()
        .from(Videos)
        .where(
          and(eq(Videos.videoId, video.id.videoId), eq(Videos.userId, userId))
        )
        .limit(1);

      let videoId: string;

      // If video doesn't exist, create new entry
      if (existingVideo.length === 0) {
        const newVideo = {
          videoId: video.id.videoId,
          title: video.snippet.title!,
          description: video.snippet.description!,
          publishedAt: new Date(video.snippet.publishedAt!),
          thumbnailUrl: getBestThumbnail(video.snippet.thumbnails!),
          channelId: channel.channelId,
          channelTitle: video.snippet.channelTitle!,
          userId,
          viewCount: parseInt(video.statistics.viewCount || "0", 10),
          likeCount: parseInt(video.statistics.likeCount || "0", 10),
          dislikeCount: parseInt(video.statistics.dislikeCount || "0", 10),
          commentCount: parseInt(video.statistics.commentCount || "0", 10),
        };

        const [insertedVideo] = await db
          .insert(Videos)
          .values(newVideo)
          .returning();
        newVideos.push(insertedVideo);
        videoId = insertedVideo.id;
      } else {
        videoId = existingVideo[0].id;
      }

      // Fetch and store comments for this video
      const comments = await fetchVideoComments(video.id.videoId);
      for (const comment of comments) {
        const newComment = {
          videoId,
          userId,
          commentText: comment.snippet.textDisplay!,
          likeCount: parseInt(`${comment.snippet.likeCount || "0"}`, 10),
          dislikeCount: 0, // YouTube API doesn't provide dislike count for comments
          publishedAt: new Date(comment.snippet.publishedAt!),
        };

        const [insertedComment] = await db
          .insert(VideoComments)
          .values(newComment)
          .returning();
        newComments.push(insertedComment);
      }
    }
  }

  return newVideos;
}

export async function updateVideoStatistics() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const videos = await db
    .select()
    .from(Videos)
    .where(eq(Videos.userId, userId));

  for (const video of videos) {
    const [updatedVideo] = await fetchVideoDetails([video.videoId]);
    if (updatedVideo) {
      await db
        .update(Videos)
        .set({
          viewCount: parseInt(updatedVideo.statistics.viewCount || "0", 10),
          likeCount: parseInt(updatedVideo.statistics.likeCount || "0", 10),
          dislikeCount: parseInt(
            updatedVideo.statistics.dislikeCount || "0",
            10
          ),
          commentCount: parseInt(
            updatedVideo.statistics.commentCount || "0",
            10
          ),
          updatedAt: new Date(),
        })
        .where(eq(Videos.videoId, video.videoId));
    }
  }
}
