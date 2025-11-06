import React from "react";

interface PostCardProps {
  title: string;
  content: string;
  published: boolean;
  author?: string;
  timestamp?: string;
}

export const PostCard: React.FC<PostCardProps> = ({
  title,
  content,
  published,
  author,
  timestamp,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl shadow-lg p-6 flex flex-col gap-2 hover:border-accent transition-all w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-lg text-accent-1-m">{title}</span>
        {published ? (
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-700/50 text-green-200">
            Published
          </span>
        ) : (
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-yellow-700/50 text-yellow-200">
            Draft
          </span>
        )}
      </div>
      <p className="text-slate-200 whitespace-pre-line break-words">
        {content}
      </p>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
        {author && <span>@{author}</span>}
        {timestamp && <span>{timestamp}</span>}
      </div>
    </div>
  );
};

export default PostCard;
