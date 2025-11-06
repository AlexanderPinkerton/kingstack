export interface PostDSS {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  author_id: string;
  created_at: string;
}

// Full post data with author information for realtime updates
export interface FullPostData {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  author_id: string;
  created_at: string;
  author?: {
    id: string;
    username: string;
    email: string;
  };
}
