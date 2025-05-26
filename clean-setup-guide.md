## Setup Env Files
- copy apps/frontend/.env.example to apps/frontend/.env
- copy apps/backend/.env.example to apps/backend/.env
- copy packages/prisma/.env.example to packages/prisma/.env

## Setup Supabase
- create a new supabase project at https://supabase.com

## Update Env Files
- update apps/frontend/.env with your supabase project info
- update apps/backend/.env with your supabase project info
- update packages/prisma/.env with your supabase project info

## Setup Google Auth (Optional)
- if you want to use google auth, add your google client id and secret to apps/frontend/.env ( you can get this from the google developers console)

## Initialize Database
- run `yarn prisma:migrate` in the root directory

## Install Auth Triggers
- run `yarn workspace @kingstack/backend run install-custom-user-trigger` in the root directory

## Backfill User Data ( only needed if you have existing users)
- run `yarn workspace @kingstack/backend run backfill-user-data` in the root directory

## Test the stack
- run `yarn dev` in the root directory
- open http://localhost:3069 in your browser
- you should see the landing page
- register using username and password
- check email for confirmation
- login and you should be redirected to the dashboard
- click "create post" to inject a post into db
- click "fetch posts" to fetch posts from db via NestJS api route
- click "fetch posts2" to fetch posts from db via NextJS api route
