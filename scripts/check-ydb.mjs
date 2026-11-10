import { accessSync, constants } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { config } from "dotenv";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
config({ path: [resolve(projectDir, ".env.local"), resolve(projectDir, ".env")], quiet: true });

function main() {
  const endpointValue = process.env.YDB_ENDPOINT?.trim();
  const database = process.env.YDB_DATABASE?.trim();
  if (!endpointValue || !database) {
    throw new Error("Заполните YDB_ENDPOINT и YDB_DATABASE в .env.local. См. docs/YDB_SETUP.md.");
  }

  const endpoint = new URL(endpointValue);
  if (endpoint.protocol !== "grpcs:" || endpoint.search || endpoint.hash ||
      endpoint.username || endpoint.password || !["", "/"].includes(endpoint.pathname)) {
    throw new Error("YDB_ENDPOINT должен иметь вид grpcs://host:port, без /?database=. Путь задаётся в YDB_DATABASE.");
  }
  if (!database.startsWith("/") || database.includes("<")) {
    throw new Error("Укажите настоящий абсолютный путь базы в YDB_DATABASE.");
  }

  const keyFile = resolve(projectDir, process.env.YDB_SERVICE_ACCOUNT_KEY_FILE || ".secrets/ydb-service-account.json");
  try {
    accessSync(keyFile, constants.R_OK);
  } catch {
    throw new Error("Не найден доступный для чтения JSON-ключ. Сохраните его в .secrets/ydb-service-account.json или задайте YDB_SERVICE_ACCOUNT_KEY_FILE. См. docs/YDB_SETUP.md.");
  }

  console.log("Проверяю YDB запросом SELECT 1 AS connection_ok; (без изменения данных).");
  const child = spawn(process.env.YDB_CLI_PATH || "ydb", [
    "--endpoint", `${endpoint.protocol}//${endpoint.host}`,
    "--database", database,
    "--sa-key-file", keyFile,
    "sql", "--script", "SELECT 1 AS connection_ok;",
  ], { cwd: projectDir, stdio: "inherit", shell: false, timeout: 60_000 });

  child.on("error", (error) => {
    console.error(error.code === "ENOENT"
      ? "YDB CLI не найден. Установите его по docs/YDB_SETUP.md или задайте YDB_CLI_PATH."
      : "Не удалось запустить YDB CLI. Проверьте установку и доступ к исполняемому файлу.");
    process.exitCode = 1;
  });
  child.on("close", (code, signal) => {
    if (signal || code !== 0) {
      if (signal) console.error("Проверка прервана или превысила лимит 60 секунд.");
      process.exitCode = code || 1;
      return;
    }
    console.log("Соединение и выполнение запроса в YDB проверены.");
  });
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
