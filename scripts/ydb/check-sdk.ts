import "./env"
import { disconnectYdb, ydbQuery } from "../../src/lib/ydb/connection"

ydbQuery("SELECT 1 AS connection_ok;")
  .then((sets) => { if (Number(sets[0]?.[0]?.connection_ok) !== 1) throw new Error("Unexpected YDB result"); console.log("Native SDK: connection_ok = 1") })
  .catch((error) => { console.error(error instanceof Error ? error.message : "YDB connection failed"); process.exitCode = 1 })
  .finally(disconnectYdb)
