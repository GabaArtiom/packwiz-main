const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4173);

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      env: process.env,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data) => (stdout += data));
    child.stderr?.on("data", (data) => (stderr += data));
    child.on("error", (error) =>
      resolve({ ok: false, code: 127, stdout, stderr: error.message })
    );
    child.on("close", (code) =>
      resolve({ ok: code === 0, code, stdout, stderr })
    );
  });
}

function parseTomlValue(raw) {
  const value = raw.trim();
  const quoted = value.match(/^['"]([\s\S]*)['"]$/);
  if (quoted) return quoted[1];
  return value;
}

async function readPack() {
  const text = await fs.readFile(path.join(root, "pack.toml"), "utf8");
  const name = text.match(/^name\s*=\s*(.+)$/m);
  const version = text.match(/^version\s*=\s*(.+)$/m);
  const minecraft = text.match(/^minecraft\s*=\s*(.+)$/m);
  const loader =
    text.match(/^neoforge\s*=\s*(.+)$/m) ||
    text.match(/^forge\s*=\s*(.+)$/m) ||
    text.match(/^fabric\s*=\s*(.+)$/m);
  return {
    name: name ? parseTomlValue(name[1]) : "packwiz pack",
    version: version ? parseTomlValue(version[1]) : "",
    minecraft: minecraft ? parseTomlValue(minecraft[1]) : "",
    loader: loader ? parseTomlValue(loader[1]) : "",
  };
}

async function listMods() {
  const modDir = path.join(root, "mods");
  const entries = await fs.readdir(modDir, { withFileTypes: true });
  const mods = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = `mods/${entry.name}`;
    const full = path.join(root, file);
    if (entry.name.endsWith(".pw.toml")) {
      const text = await fs.readFile(full, "utf8");
      const name = text.match(/^name\s*=\s*(.+)$/m);
      const side = text.match(/^side\s*=\s*(.+)$/m);
      const filename = text.match(/^filename\s*=\s*(.+)$/m);
      const modrinth = text.match(/^mod-id\s*=\s*(.+)$/m);
      const curseforge = text.match(/^project-id\s*=\s*(.+)$/m);
      mods.push({
        file,
        type: "managed",
        name: name ? parseTomlValue(name[1]) : entry.name.replace(/\.pw\.toml$/, ""),
        side: side ? parseTomlValue(side[1]) : "",
        filename: filename ? parseTomlValue(filename[1]) : "",
        provider: modrinth ? "modrinth" : curseforge ? "curseforge" : "url",
      });
    } else if (entry.name.endsWith(".jar")) {
      const stat = await fs.stat(full);
      mods.push({
        file,
        type: "jar",
        name: entry.name.replace(/\.jar$/, ""),
        side: "both",
        filename: entry.name,
        provider: "local",
        size: stat.size,
      });
    }
  }
  mods.sort((a, b) => a.name.localeCompare(b.name));
  return mods;
}

async function gitStatus() {
  const status = await run("git", ["status", "--short"]);
  const branch = await run("git", ["branch", "--show-current"]);
  return {
    branch: branch.stdout.trim() || "main",
    clean: status.ok && status.stdout.trim() === "",
    text: status.stdout.trim(),
  };
}

async function sha256(file) {
  const data = await fs.readFile(path.join(root, file));
  return crypto.createHash("sha256").update(data).digest("hex");
}

function tomlString(value) {
  return JSON.stringify(value);
}

async function refreshIndex() {
  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (rel === ".git" || rel === "tools" || rel === "node_modules") continue;
        await walk(rel);
      } else if (
        rel !== "index.toml" &&
        rel !== "pack.toml" &&
        rel !== "package.json" &&
        !rel.startsWith(".")
      ) {
        files.push(rel);
      }
    }
  }
  await walk(".");
  files.sort();
  let text = 'hash-format = "sha256"\n\n';
  for (const file of files) {
    text += "[[files]]\n";
    text += `file = ${tomlString(file.replace(/^\.\//, ""))}\n`;
    text += `hash = ${tomlString(await sha256(file))}\n`;
    if (file.endsWith(".pw.toml")) text += "metafile = true\n";
    text += "\n";
  }
  await fs.writeFile(path.join(root, "index.toml"), text.replace(/\n\n$/, "\n"));
  const indexHash = await sha256("index.toml");
  const packPath = path.join(root, "pack.toml");
  const pack = await fs.readFile(packPath, "utf8");
  await fs.writeFile(
    packPath,
    pack.replace(/(\[index\][\s\S]*?hash\s*=\s*)["'][^"']+["']/, `$1"${indexHash}"`)
  );
}

async function removeMod(file) {
  if (!file.startsWith("mods/") || file.includes("..")) {
    throw new Error("Можно удалять только файлы из mods/");
  }
  if (!file.endsWith(".pw.toml") && !file.endsWith(".jar")) {
    throw new Error("Можно удалять только .pw.toml или .jar");
  }
  await fs.rm(path.join(root, file));
  await refreshIndex();
}

async function addMod(source, provider) {
  const value = String(source || "").trim();
  if (!value) throw new Error("Нужно указать slug или URL мода");
  const packwiz = await run("packwiz", ["--help"]);
  if (!packwiz.ok) {
    throw new Error("packwiz не найден в PATH. Установи packwiz, затем повтори добавление.");
  }
  let args;
  if (provider === "curseforge") args = ["curseforge", "install", value];
  else if (provider === "url") args = ["url", "add", value];
  else args = ["modrinth", "install", value];
  const result = await run("packwiz", args);
  if (!result.ok) throw new Error((result.stderr || result.stdout || "packwiz failed").trim());
  await refreshIndex();
  return result.stdout.trim();
}

async function commitAndPush(message, remote) {
  const safeMessage = String(message || "Update modpack from UI").trim();
  const safeRemote = String(remote || "origin").trim();
  const statusBefore = await gitStatus();
  if (statusBefore.clean) throw new Error("Нет изменений для коммита");
  const add = await run("git", ["add", "-A"]);
  if (!add.ok) throw new Error(add.stderr || add.stdout);
  const commit = await run("git", ["commit", "-m", safeMessage]);
  if (!commit.ok) throw new Error(commit.stderr || commit.stdout);
  const branch = (await gitStatus()).branch;
  const push = await run("git", ["push", safeRemote, branch]);
  if (!push.ok) throw new Error(push.stderr || push.stdout);
  return `${commit.stdout}\n${push.stdout}\n${push.stderr}`.trim();
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      send(res, 200, {
        pack: await readPack(),
        mods: await listMods(),
        git: await gitStatus(),
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/mods/add") {
      const body = await readBody(req);
      const output = await addMod(body.source, body.provider);
      send(res, 200, { ok: true, output });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/mods/remove") {
      const body = await readBody(req);
      await removeMod(body.file);
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/refresh") {
      await refreshIndex();
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/push") {
      const body = await readBody(req);
      const output = await commitAndPush(body.message, body.remote);
      send(res, 200, { ok: true, output });
      return;
    }
    send(res, 404, { error: "Not found" });
  } catch (error) {
    send(res, 500, { error: error.message || String(error) });
  }
}

async function handleStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.normalize(path.join(publicDir, pathname));
  if (!full.startsWith(publicDir)) {
    send(res, 403, "Forbidden", "text/plain");
    return;
  }
  try {
    const data = await fs.readFile(full);
    const ext = path.extname(full);
    const type =
      ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "text/html";
    send(res, 200, data, type);
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else await handleStatic(req, res, url);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`packwiz UI: http://127.0.0.1:${port}`);
  });
