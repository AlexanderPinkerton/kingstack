## Setup Env Files
- copy apps/frontend/.env.example to apps/frontend/.env
- copy apps/backend/.env.example to apps/backend/.env
- copy packages/prisma/.env.example to packages/prisma/.env

## Update Env Files
- update apps/frontend/.env with your supabase project info
- update apps/backend/.env with your supabase project info
- update packages/prisma/.env with your supabase project info

## Setup Monorepo name
- edit package.json in the root directory and change the name to your desired name
- find a and replace all usages within the file

## Setup Supabase
- create a new supabase project at https://supabase.com

## Initialize Database
- run `yarn prisma:migrate` in the root directory

## Install Auth Triggers
- run `yarn workspace @<project-name>/backend run install-custom-user-trigger` in the root directory

## Setup Auth Redirects
- go to supabase project and navigate to Authentication -> URL Configuration
- under "Redirect URLs" add the following:
    - http://localhost:3069
    - <your vercel domain>

## Setup Google Auth (Optional)
- if you want to use google auth, add your google client id and secret to apps/frontend/.env ( you can get this from the google developers console)

## Backfill User Data ( only needed if you have existing users)
- run `yarn workspace @<project-name>/backend run backfill-user-data` in the root directory

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


## Setting Up Realtime
- Go to supabase project and navigate to the posts table
- TODO: Fill me out

## Deployments

### Deploying Backend to Railway
- Use railway git integration to deploy the backend with ease
- Under settings -> Config-as-code -> set the railway.json file path to ```/apps/backend/railway.json```
- Under variables -> add the environment variables from the .env file in the backend directory
- Under settings -> Networking: generate a domain name
- Copy the generated domain name and add update the `NEXT_PUBLIC_NEST_BACKEND_URL` environment variable in the vercel dashboard

### Deploying Frontend to Vercel
- Use vercel git integration to deploy the frontend with ease
- Be sure to set the environment variables in the vercel dashboard before deploying