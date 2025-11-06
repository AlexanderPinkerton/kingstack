## Setup Env Files
- copy apps/next/.env.example to apps/next/.env
- copy apps/nest/.env.example to apps/nest/.env
- copy packages/prisma/.env.example to packages/prisma/.env

## Update Env Files
- update apps/next/.env with your supabase project info
- update apps/nest/.env with your supabase project info
- update packages/prisma/.env with your supabase project info

## Setup Monorepo name
- edit package.json in the root directory and change the name to your desired name
- find a and replace all usages within the file

## Setup Supabase
- create a new supabase project at https://supabase.com

## Initialize Database
- run `yarn prisma:migrate` in the root directory

## Setup Auth Redirects
- go to supabase project and navigate to Authentication -> URL Configuration
- under "Redirect URLs" add the following:
    - http://localhost:3069
    - <your vercel domain>

## Setup Google Auth (Optional)
- if you want to use google auth, add your google client id and secret to apps/next/.env ( you can get this from the google developers console)

## Backfill User Data ( only needed if you have existing users)
- run `yarn workspace @<project-name>/nest run backfill-user-data` in the root directory

## Test the stack in Playground Mode
- run `yarn dev` in the root directory
- run `yarn build` in the root directory
- run `yarn env:playground` in the root directory
- open http://localhost:3069 in your browser
- you should see the landing page
- you can now vibecode with great power

## Setting Up Supabase
- fill out the necessary env files in the `/secrets/development/` directory
- run `yarn env:development` to have the secrets installed into the correct .env files
- run `yarn dev` to spin up the stack in dev mode

## Deploying the Apps
- run `yarn lint` to clean the code. Fix all errors.
- run `yarn build` to build the apps. Fix all errors.
- ...

### Deploying NestJS to Railway
- Use railway git integration to deploy the nestjs app with ease
- Under settings -> Config-as-code -> set the railway.json file path to ```/apps/nest/railway.json```
- Under variables -> add the environment variables from the .env file in the nest directory
- Under settings -> Networking: generate a domain name
- Copy the generated domain name and add update the `NEXT_PUBLIC_NEST_URL` environment variable in the vercel dashboard

### Deploying NextJS to Vercel
- Use vercel git integration to deploy the frontend with ease
- Be sure to set the environment variables in the vercel dashboard before deploying

## Moving into Production
- fill out the necessary env files in the `/secrets/production/` directory
- run `yarn env:production` to have the secrets installed into the correct .env files
- run `yarn lint` to clean the code. Fix all errors.
- run `yarn build` to build the apps. Fix all errors.
- ....