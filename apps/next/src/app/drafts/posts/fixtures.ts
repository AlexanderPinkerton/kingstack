import type { PostApiData } from "@/repositories/posts/types";

export function createDraftPostFixtures(now = new Date()): PostApiData[] {
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  return [
    {
      id: "draft-welcome",
      title: "A backend can come later",
      content:
        "This post lives only in browser memory, but it moves through the real #optimistic store and transformer.",
      published: true,
      author_id: "draft-designer",
      created_at: hoursAgo(2),
      author: {
        id: "draft-designer",
        username: "Draft Designer",
        email: "designer@local.test",
      },
    },
    {
      id: "draft-concept",
      title: "Shape the interaction first",
      content:
        "Try editing, filtering, publishing, and deleting this concept. When the backend is ready, switch only the repository adapter. #prototype #ux",
      published: false,
      author_id: "draft-designer",
      created_at: hoursAgo(8),
      author: {
        id: "draft-designer",
        username: "Draft Designer",
        email: "designer@local.test",
      },
    },
  ];
}
