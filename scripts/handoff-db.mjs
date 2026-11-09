const identifier = /^[a-z_][a-z0-9_]*$/;
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';

export function assertHandoffTarget(value) {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !/^[a-z0-9_]+_handoff(?:_test)?$/.test(url.pathname.slice(1))
  )
    throw new Error(
      "Restore requires a local database ending in _handoff or _handoff_test. Cloud and primary databases are refused.",
    );
}

export function validateSnapshot(snapshot) {
  if (
    snapshot.format !== "ctv-handoff-v1" ||
    !Array.isArray(snapshot.tables) ||
    !snapshot.tables.length
  )
    throw new Error("Unsupported handoff snapshot");
  const names = new Set();
  for (const table of snapshot.tables) {
    if (
      !identifier.test(table.name) ||
      names.has(table.name) ||
      !Array.isArray(table.columns) ||
      !table.columns.length ||
      !Array.isArray(table.rows) ||
      !/^[a-f0-9]{32}$/.test(table.checksum)
    )
      throw new Error("Invalid snapshot table");
    names.add(table.name);
    const columns = table.columns.map((c) => c.column_name);
    if (
      new Set(columns).size !== columns.length ||
      columns.some((c) => !identifier.test(c))
    )
      throw new Error("Invalid snapshot columns");
    if (
      table.rows.some(
        (row) =>
          !row ||
          Array.isArray(row) ||
          Object.keys(row).length !== columns.length ||
          columns.some((c) => !Object.hasOwn(row, c)),
      )
    )
      throw new Error("Invalid snapshot row");
  }
}

export async function tableChecksum(client, name) {
  return (
    await client.query(
      `select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text) as hash from public.${quote(name)} t`,
    )
  ).rows[0].hash;
}

async function requireEmpty(client) {
  const tables = (
    await client.query(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    )
  ).rows;
  for (const t of tables) {
    if (
      (
        await client.query(
          `select exists(select 1 from public.${quote(t.table_name)} limit 1) as populated`,
        )
      ).rows[0].populated
    )
      throw new Error(
        "Destination contains data. Restore stopped without overwriting it.",
      );
  }
}

export async function verifySnapshot(client, snapshot) {
  validateSnapshot(snapshot);
  await client.query("set timezone='UTC'");
  const actual = (
    await client.query(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
    )
  ).rows.map((t) => t.table_name);
  const expected = snapshot.tables.map((t) => t.name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Database tables do not match the snapshot");
  for (const table of snapshot.tables) {
    if ((await tableChecksum(client, table.name)) !== table.checksum)
      throw new Error("Snapshot verification failed: " + table.name);
  }
  return {
    tables: snapshot.tables.length,
    scenarios:
      snapshot.tables.find((t) => t.name === "scenarios")?.rows.length ?? 0,
    checksums: "match",
  };
}

export async function restoreSnapshot(client, snapshot, migrate) {
  validateSnapshot(snapshot);
  await client.query("set timezone='UTC'");
  await requireEmpty(client);
  await migrate();
  await client.query("begin");
  try {
    await client.query(
      "lock table " +
        snapshot.tables.map((t) => "public." + quote(t.name)).join(",") +
        " in share row exclusive mode",
    );
    await requireEmpty(client);
    for (const table of snapshot.tables) {
      if (!table.rows.length) continue;
      const columns = table.columns.map((c) => quote(c.column_name)).join(",");
      // One statement per table preserves self-references and exact JSON/timestamp values.
      await client.query(
        `insert into public.${quote(table.name)} (${columns}) select ${columns} from jsonb_populate_recordset(null::public.${quote(table.name)}, $1::jsonb)`,
        [JSON.stringify(table.rows)],
      );
    }
    const result = await verifySnapshot(client, snapshot);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
