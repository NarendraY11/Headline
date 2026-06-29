import { type BlogPost, blogPosts } from "./blog";

export type BlogMeta = Omit<BlogPost, "content">;

export const blogMeta: BlogMeta[] = blogPosts.map(({ content: _c, ...meta }) => meta);
