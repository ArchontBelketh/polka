import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const projectRequire = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

// Выполняем исходные серверные модули с изолированными БД/сетью. Это позволяет
// проверять опасные сценарии без секретов, реальных платежей и изменений БД.
export function loadModule(entry, { mocks = {}, env = {}, globals = {} } = {}) {
  const cache = new Map()
  function load(file) {
    const absolute = path.resolve(root, file)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const compiled = { exports: {} }
    cache.set(absolute, compiled)
    const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      fileName: absolute,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const resolve = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name === "server-only") return {} // Next's build marker has no runtime behavior in this isolated VM.
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(absolute), name)
        if (base.endsWith(".json") && fs.existsSync(base)) return JSON.parse(fs.readFileSync(base, "utf8"))
        for (const suffix of [".ts", ".tsx", ".js", "/index.ts", "/index.tsx", "/index.js"]) {
          if (fs.existsSync(base + suffix)) return load(base + suffix)
        }
      }
      return projectRequire(name)
    }
    vm.runInNewContext(code, {
      module: compiled, exports: compiled.exports, require: resolve,
      process: { env: { NODE_ENV: "test", ...env }, cwd: () => root },
      console: { log() {}, warn() {}, error() {} },
      Buffer, Headers, Request, Response, URL, URLSearchParams, AbortSignal, crypto: globalThis.crypto,
      setTimeout, clearTimeout, setInterval, clearInterval,
      ...globals,
    }, { filename: absolute })
    return compiled.exports
  }
  return load(entry)
}
