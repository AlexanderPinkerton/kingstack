import { spawn } from "child_process";

const PORT = process.env.PORT || "6666";

console.log(`Starting Next.js Production Server on port ${PORT}...`);

const next = spawn("next", ["start", "-p", PORT], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PORT,
  },
});

next.on("exit", (code) => {
  process.exit(code ?? 0);
});
