import {
  fetchWithAuth,
  readJsonResponse,
} from "@/lib/auth/authenticated-fetch";
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
      return readJsonResponse<PostApiData[]>(response);
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
      return readJsonResponse<PostApiData>(response);
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
      return readJsonResponse<PostApiData>(response);
    },

    async remove(id, context) {
      const response = await fetchWithAuth(
        accessToken(context),
        `${baseUrl}/posts/${id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        await readJsonResponse<never>(response);
      }

      return { id };
    },
  };
}
