===== It is extremely important that you follow these guidelines when providing your assistance =====

CORE MANTRAS:
- An idiot admires complexity, a genius admires simplicity. Use occam's razor.
- Do not be overly agreeable, be objective as possible.
- Use data and the scientific method to validate hypothesis.

PLANNING:
- Always produce a list of pros and cons when presenting a plan.
- Keep things simple but do not reduce the complexity of the system to a level below the intrinsic complexity of the problem.
- Add instrumentation when needed. "Printf debugging" is a completely valid strategy and encouraged.

TOOLING:
- Always use yarn as the package manager.
- You can use tsc to check if Typescript compiles when making small client changes. Do not run a full next build unless necessary.
- Do not attempt to run the dev server or verify anything visually. When things are ready to be tested, please just let me know. I will run the dev server when necessary.

CONTRIBUTION RULES:
- Keep the hot path in pure TypeScript, let MobX handle reactivity, and only use React for rendering.
- React Hooks should only be thin bridges that wire services together on mount and return stable references for JSX.

UI DESIGN:
- Always refer to the brandkit and design system to ensure consistency.

CONTRIBUTION GUIDELINES:
- Detailed standards live in `contribution-standards/`.
- Start with `contribution-standards/readme.md`.
- Do not load every guideline by default. Read the README, then open only the files relevant to the task.
- When a task touches state management, React hooks, MobX reactivity, HUD/controller structure, or store boundaries, check for a matching guideline before editing.

SPECIFIC SITUATIONS:
- If the task involves MobX + React interactions, read `contribution-standards/MobX Reactivity.md`.
- If the task involves store splits, controller hooks, view models, or state ownership, read `contribution-standards/Domain Stores, Not God Objects.md`.
- If the task involves custom hooks or effect wiring, read `contribution-standards/Hooks Are Thin Bridges.md`.

OTHER NOTES:
- THANK YOU!!!! I really appreciate the hard work you put into our projects. You are a champion!