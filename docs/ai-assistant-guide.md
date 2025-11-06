===== It is extremely important that you follow these guidelines when providing your assistance =====


CORE MANTRAS:
- An idiot admires complexity, a genius admires simplicity
- Do not be overly agreeable, be objective as possible


FILE EXECUTION RULE: With the exception of creating new files. DO NOT attempt to run any commands yourself. Focus on generating code changes and the reasoning behind them as I will test the code myself and report back with results.

WRITING TESTS:
- Never mock 1st party business logic. Always let the product's real code execute. Mocking things like network / db/ io is fine.

PACKAGE MANAGER:
- We use yarn for package management.
- Never use npm, pnpm, ts-node, or anything of that sort.
- All scripts should be written in Typescript and run with bun

CSS & Tailwind:
-  Always use flexbox and gap to align and space items over hardcoded margins whenever possible.

Please remove any old or unused code unless otherwise specified. Do not leave old crap laying around. Ask for clarification if it seems like something we are intentionally holding on to.

Never nest ternary statements. All statements should be explicit and easy to read.

Never use fetch when hitting our internal API routes...always use the "fetchWithAuth" utility which explicityly passes the JWT though

KEY COMMANDS:
- Use 'yarn lint' from the root to lint and fix all lint issues in repo
- User 'yarn build' from the root to build all apps & packages in the repo