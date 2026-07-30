import { fetchWithAuth } from "@/lib/utils";
import type {
  PostApiData,
  PostCreateInput,
  PostRepository,
  PostRepositoryContext,
  PostUpdateInput,
} from "./types";

export interface HttpPostRepositoryOptions {
  baseUrl?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  const message = await response.text();
  throw new Error(
    message || `Post request failed with status ${response.status}`,
  );
}

function accessToken(context: PostRepositoryContext): string {
  if (!context.accessToken) {
    throw new Error("The HTTP post repository requires an access token");
  }

  return context.accessToken;
}

/**
 * Production adapter for the Nest posts API.
 *
 * AdvancedPostStore knows only the PostRepository contract; replacing this
 * adapter does not change store consumers or optimistic behavior.
 */
export function createHttpPostRepository(
  options: HttpPostRepositoryOptions = {},
): PostRepository {
  const baseUrl =
    options.baseUrl ??
    process.env.NEXT_PUBLIC_NEST_BACKEND_URL ??
    "http://localhost:3000";

  return {
    async list(context) {
      const response = await fetchWithAuth(
        accessToken(context),
        `${baseUrl}/posts`,
      );
      return readJson<PostApiData[]>(response);
    },

    async create(data: PostCreateInput, context) {
      const response = await fetchWithAuth(
        accessToken(context),
        `${baseUrl}/posts`,
        {
          method: "POST",
          body: JSON.stringify({
            title: data.title,
            content: data.content,
            published: data.published,
          }),
        },
      );
      return readJson<PostApiData>(response);
    },

    async update({ id, data }: { id: string; data: PostUpdateInput }, context) {
      const response = await fetchWithAuth(
        accessToken(context),
        `${baseUrl}/posts/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
      return readJson<PostApiData>(response);
    },

    async remove(id, context) {
      const response = await fetchWithAuth(
        accessToken(context),
        `${baseUrl}/posts/${id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        await readJson<never>(response);
      }

      return { id };
    },
  };
}
