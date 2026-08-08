import type { PostApiData } from "@/repositories/posts/types";

export function createOptimisticPostFixtures(now = new Date()): PostApiData[] {
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  return [
    {
      id: "demo-welcome",
      title: "A backend can come later",
      content:
        "This post lives only in browser memory, but it moves through the real #optimistic store and transformer.",
      published: true,
      author_id: "demo-user",
      created_at: hoursAgo(2),
      author: {
        id: "demo-user",
        username: "Demo User",
        email: "demo@local.test",
      },
    },
    {
      id: "demo-concept",
      title: "Shape the interaction first",
      content:
        "Try editing, filtering, publishing, and deleting this concept. Add latency or arm a rejection to watch the optimistic layer reconcile. #prototype #ux",
      published: false,
      author_id: "demo-user",
      created_at: hoursAgo(8),
      author: {
        id: "demo-user",
        username: "Demo User",
        email: "demo@local.test",
      },
    },
  ];
}
