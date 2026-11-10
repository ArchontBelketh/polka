import "./ydb/env"
import path from "node:path"
import { createRequire } from "node:module"
import { spawn } from "node:child_process"

const resolvePackage = createRequire(path.resolve("package.json"))
const provider = process.env.DB_PROVIDER || "postgresql"
if (provider !== "postgresql" && provider !== "ydb") throw new Error("DB_PROVIDER must be postgresql or ydb")
const args = provider === "ydb"
  ? [resolvePackage.resolve("tsx/cli"), "scripts/ydb/migrate.ts"]
  : [resolvePackage.resolve("prisma"), "migrate", "deploy"]
const child = spawn(process.execPath, args, { stdio: "inherit", shell: false })
child.on("error", () => { console.error("Cannot start the database migration process"); process.exitCode = 1 })
child.on("close", (code) => { process.exitCode = code ?? 1 })
