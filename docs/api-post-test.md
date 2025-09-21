# API Post Test

## Issue Fixed

The 405 (Method Not Allowed) error was occurring because the Next.js API route at `/api/post` only had a `GET` handler but no `POST` handler.

## Solution

Added a `POST` handler to `/apps/frontend/src/app/api/post/route.ts` that:

1. **Authenticates the user** using the JWT token from the Authorization header
2. **Validates the request** to ensure title is provided
3. **Creates the post** in the database with the authenticated user's ID as the author
4. **Returns the created post** with a 201 status code

## Key Features

- **Authentication**: Uses `getUserAuthDetails()` to verify the JWT token
- **Validation**: Ensures title is required, content is optional
- **User Association**: Automatically sets the `author_id` to the authenticated user's ID
- **Error Handling**: Proper error responses for authentication and validation failures
- **Type Safety**: Fixed TypeScript errors by ensuring `userId` is defined

## API Endpoints

### GET /api/post
- Returns all posts ordered by creation date (newest first)
- Requires authentication

### POST /api/post
- Creates a new post
- Requires authentication
- Body: `{ title: string, content?: string, published?: boolean }`
- Returns: Created post object

## Testing

You can now test the post creation functionality:

1. Make sure you're authenticated (have a valid session)
2. Use the demo at `/realtime-posts` to create posts
3. Posts should be created successfully and appear in real-time
