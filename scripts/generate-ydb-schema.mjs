import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const clean = source.replace(/\/\/[^\n]*/g, "");
const enums = Object.fromEntries([...clean.matchAll(/enum\s+(\w+)\s*\{([^}]+)\}/g)].map((m) => [m[1], m[2].trim().split(/\s+/)]));
const models = {};
const scalarTypes = new Set(["String", "Boolean", "Int", "Float", "DateTime", "Json"]);
for (const match of clean.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)) {
  const model = { name: match[1], fields: {}, relations: {}, primaryKey: [], unique: [], indexes: [] };
  for (const raw of match[2].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("@@")) {
      const index = line.match(/^@@(unique|index)\(\[([^\]]+)\]/);
      if (!index) throw new Error(`Unsupported schema directive: ${line}`);
      model[index[1] === "unique" ? "unique" : "indexes"].push(index[2].split(",").map((v) => v.trim()));
      continue;
    }
    const field = line.match(/^(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)$/);
    if (!field) throw new Error(`Cannot parse schema line: ${line}`);
    const [, name, type, modifier, attrs] = field;
    if (!scalarTypes.has(type) && !enums[type]) {
      const from = attrs.match(/fields:\s*\[([^\]]+)\]/)?.[1];
      const to = attrs.match(/references:\s*\[([^\]]+)\]/)?.[1];
      model.relations[name] = { model: type, many: modifier === "[]", nullable: modifier === "?", from: from?.split(",").map((v) => v.trim()), to: to?.split(",").map((v) => v.trim()), onDelete: attrs.match(/onDelete:\s*(\w+)/)?.[1] || (modifier === "?" ? "SetNull" : "Restrict") };
      const relationName = attrs.match(/@relation\("([A-Za-z_][A-Za-z0-9_]*)"/)?.[1];
      if (relationName) model.relations[name].relationName = relationName;
      continue;
    }
    const data = { type, nullable: modifier === "?", list: modifier === "[]", updatedAt: attrs.includes("@updatedAt") };
    const def = attrs.match(/@default\(("(?:[^"\\]|\\.)*"|\[.*?\]|\w+\(\)|-?[\d.]+|\w+)\)/)?.[1];
    if (def !== undefined) {
      if (def === "cuid()" || def === "now()") data.default = { fn: def.slice(0, -2) };
      else if (enums[type]) data.default = def;
      else { data.default = JSON.parse(def); if (type === "Json" && typeof data.default === "string") data.default = JSON.parse(data.default); }
    }
    if (data.list && data.default === undefined) data.default = [];
    model.fields[name] = data;
    if (/@id\b/.test(attrs)) model.primaryKey.push(name);
    if (/@unique\b/.test(attrs)) model.unique.push([name]);
  }
  if (!model.primaryKey.length) model.primaryKey = model.unique[0] || [];
  if (!model.primaryKey.length) throw new Error(`No primary key for ${model.name}`);
  models[model.name] = model;
}
for (const model of Object.values(models)) {
  for (const relation of Object.values(model.relations)) {
    if (!relation.from) {
      const reverse = Object.values(models[relation.model].relations).filter((r) => r.model === model.name && r.from && r.relationName === relation.relationName);
      if (reverse.length !== 1) throw new Error(`Ambiguous relation ${model.name} -> ${relation.model}`);
      relation.from = reverse[0].to;
      relation.to = reverse[0].from;
      relation.reverse = true;
    } else model.indexes.push(relation.from);
  }
  model.indexes = model.indexes.filter((fields, i, list) =>
    ![model.primaryKey, ...model.unique].some((key) => JSON.stringify(key) === JSON.stringify(fields)) &&
    list.findIndex((key) => JSON.stringify(key) === JSON.stringify(fields)) === i);
}
const metadata = { sourceHash: crypto.createHash("sha256").update(source).digest("hex"), enums, models };
const json = JSON.stringify(metadata, null, 2) + "\n";
const target = path.join(root, "src/lib/ydb/schema.json");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== json) throw new Error("YDB schema metadata is stale. Run npm run ydb:generate.");
  console.log(`YDB schema metadata matches ${Object.keys(models).length} models.`);
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, json);
  console.log(`Generated YDB schema metadata for ${Object.keys(models).length} models.`);
}
