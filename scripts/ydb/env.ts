import path from "node:path"
import { config } from "dotenv"

config({ path: [path.resolve(".env.local"), path.resolve(".env")], quiet: true })
