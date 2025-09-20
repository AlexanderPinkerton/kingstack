
Im back again! Can you explain in detail why the relative paths in @shared.ts break the backend builds. Why does that cause the dist to end up somewhere else?


Great question! Let me explain in detail why relative paths in shared.ts break the backend builds and cause the dist structure to be nested.
The Root Cause: TypeScript's Path Preservation
When TypeScript compiles your code, it preserves the relative path structure from your source files in the output directory. Here's what happens:
1. Your Source Structure
Apply to shared.ts
ts
This file imports from:
Apply to shared.ts
;
2. TypeScript's Compilation Logic
TypeScript sees this relative path and thinks:
"The source file is at apps/backend/src/lib/shared.ts"
"It imports from ../../../../packages/shapes/karma/KarmaManager"
"So the compiled file should maintain this same relative relationship"
3. The Problem: Path Resolution
TypeScript resolves ../../../../packages/shapes/karma/KarmaManager from the source file's location:
From: apps/backend/src/lib/shared.ts
Going up 4 levels: apps/backend/src/ → apps/backend/ → apps/ → root/
Then into: packages/shapes/karma/KarmaManager
4. Output Structure Preservation
TypeScript preserves this full monorepo path structure in the output:
Apply to shared.ts
js
Instead of the expected:
Apply to shared.ts
js
Why This Happens
TypeScript's Default Behavior
TypeScript compiles files while maintaining their relative import relationships
When you have imports that go outside your source directory, TypeScript creates the full path structure in the output
This is especially problematic in monorepos where packages reference each other
The NestJS CLI Expectation
NestJS CLI expects:
Apply to shared.ts
here
But gets:
Apply to shared.ts
here
The Technical Details
Module Resolution
TypeScript's module resolution algorithm:
Starts from the importing file's location
Follows the relative path exactly
Preserves the relationship in the output structure
Why rootDir Doesn't Work
When you set rootDir: "src", TypeScript requires all source files to be under that directory. But your imports go outside:
Apply to shared.ts
❌
Solutions (In Order of Preference)
1. Path Mapping (Best)
Apply to shared.ts
}
Then use:
Apply to shared.ts
;
2. Post-Build Script (What We Tried)
Move files after compilation to the expected structure.
3. Workspace Packages
Set up proper package.json files so you can import by package name.
Why This Is Common in Monorepos
This is a classic monorepo problem because:
Packages need to reference each other
Relative paths become complex and fragile
TypeScript's default behavior doesn't handle cross-package imports well
Build tools expect flat output structures
The path mapping solution is the most robust because it:
✅ Keeps imports clean and maintainable
✅ Works with TypeScript's module resolution
✅ Doesn't require post-build scripts
✅ Follows monorepo best practices
Does this explanation help clarify why the relative paths cause the build structure issues?
Ok so because one file imports things from above the root dir, the entire dist output is moved down levels to preserve relative paths and that in turn moves the dist file to somewhere lower than expected

Exactly! You've got it perfectly.
The Chain Reaction
One file (shared.ts) imports from above the root dir:
Apply to shared.ts
;
TypeScript preserves ALL relative paths in the entire compilation, so every single file gets moved down to maintain those relationships
The entire dist structure gets nested under dist/apps/backend/src/ instead of just dist/
NestJS CLI expects dist/main.js but finds dist/apps/backend/src/main.js
Why It Affects Everything
It's not just that one file - TypeScript treats the entire compilation as a unit. When it sees that some files need to preserve paths that go outside the source directory, it restructures the whole output to maintain consistency.
So even files that don't import from packages/shapes (like main.ts, app.controller.ts, etc.) all get moved down into the nested structure because TypeScript is preserving the relative path relationships across the entire codebase.
The Fix
That's why the path mapping solution works so well:
Apply to shared.ts
;
The path mapping tells TypeScript "when you see @shapes/*, resolve it to ../../packages/shapes/*" but it doesn't preserve the full monorepo path structure in the output.
You've nailed the root cause! 🎯