import { spawn } from "child_process";

const PORT = process.env.PORT || "3069";

console.log(`Starting Next.js Development Server on port ${PORT}...`);

const next = spawn("next", ["dev", "-p", PORT, "--turbopack"], {
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
