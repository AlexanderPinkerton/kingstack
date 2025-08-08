Rather than trying to rely on dot-env actually working, This repo ensures that secrets will be found by only using '.env' and replacing it when targeting a different environment.

All secrets (.env files) should live in this directory. ( Ex: .env.frontend & .env.backend )

Additionally, this will make it very easy to onboard new developers as you can just send them the secrets folder.

The env-swap script will allow you to swap the .env files around whenever you want to have local development target different envrionments.

