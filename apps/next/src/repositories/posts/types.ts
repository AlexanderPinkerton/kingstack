import type { EntityRepository } from "@/repositories/entity-repository";

export interface PostAuthor {
  id: string;
  username: string;
  email: string;
}

export interface PostApiData {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  author_id: string;
  created_at: string;
  author: PostAuthor;
}

export interface PostCreateInput {
  title: string;
  content?: string;
  published?: boolean;
  author_id?: string;
}

export interface PostUpdateInput {
  title?: string;
  content?: string;
  published?: boolean;
}

export interface PostRepositoryUser {
  id: string;
  email?: string;
  user_metadata?: {
    username?: string;
    [key: string]: unknown;
  };
}

export interface PostRepositoryContext {
  /**
   * Stable cache boundary. Use a user/tenant id for remote data and a unique
   * draft id for an isolated in-memory workspace.
   */
  scope: string;
  enabled: boolean;
  accessToken?: string;
  currentUser: PostRepositoryUser | null;
}

export type PostRepository = EntityRepository<
  PostApiData,
  PostCreateInput,
  PostUpdateInput,
  PostRepositoryContext
>;
