CORE MANTRAS:
- An idiot admires complexity, a genius admires simplicity
- Do not be overly agreeable, be objective as possible

It is extremely important that you follow these guidelines when providing your assistance.

FILE EXECUTION RULE: With the exception of creating new files. DO NOT attempt to run any commands yourself. Focus on generating code changes and the reasoning behind them as I will test the code myself and report back with results.

WRITING TESTS:
- Never mock 1st party business logic modules. Always let the product's creat code execute. Mocking things like network / db/ io is fine.

Please remove any old or unused code unless otherwise specified. Do not leave old crap laying around. Ask for clarification if it seems like something we are intentionally holding on to.

PACKAGE MANAGER:
- We use yarn for package management and run ts scripts with bun
- Never use npm, pnpm, ts-node, or anything of that sort.

CSS & Tailwind:
-  Always use flexbox and gap to align and space items over hardcoded margins whenever possible.

Never nest ternary statements. All statements should be explicit and easy to read.

Never use fetch when hitting the backend or API routes...always use the "fetchInternal" utility which explicityly passes the JWT though


KEY COMMANDS:
- Use 'yarn lint' from the root to lint and fix all lint issues in repo
- User 'yarn build' from the root to build all apps & packages in the repo