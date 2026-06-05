let state = { mods: [], pack: {}, git: {} };
let busy = false;

const els = {
  packName: document.querySelector("#packName"),
  packMeta: document.querySelector("#packMeta"),
  refreshBtn: document.querySelector("#refreshBtn"),
  pushBtn: document.querySelector("#pushBtn"),
  addBtn: document.querySelector("#addBtn"),
  search: document.querySelector("#search"),
  sideFilter: document.querySelector("#sideFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  provider: document.querySelector("#provider"),
  source: document.querySelector("#source"),
  count: document.querySelector("#count"),
  gitStatus: document.querySelector("#gitStatus"),
  modList: document.querySelector("#modList"),
  toast: document.querySelector("#toast"),
  pushDialog: document.querySelector("#pushDialog"),
  confirmPush: document.querySelector("#confirmPush"),
  commitMessage: document.querySelector("#commitMessage"),
  remote: document.querySelector("#remote"),
};

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 4500);
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("button, input, select").forEach((el) => {
    if (el.closest("dialog") && !els.pushDialog.open) return;
    el.disabled = value;
  });
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Request failed");
  return data;
}

async function load() {
  state = await api("/api/state");
  render();
}

function matches(mod) {
  const query = els.search.value.trim().toLowerCase();
  const side = els.sideFilter.value;
  const type = els.typeFilter.value;
  const haystack = `${mod.name} ${mod.file} ${mod.filename}`.toLowerCase();
  return (
    (!query || haystack.includes(query)) &&
    (!side || mod.side === side) &&
    (!type || mod.type === type)
  );
}

function render() {
  const { pack, git } = state;
  els.packName.textContent = pack.name || "Packwiz";
  els.packMeta.textContent = [
    pack.version && `v${pack.version}`,
    pack.minecraft && `Minecraft ${pack.minecraft}`,
    pack.loader && `loader ${pack.loader}`,
    git.branch && `branch ${git.branch}`,
  ]
    .filter(Boolean)
    .join(" | ");
  els.gitStatus.textContent = git.clean ? "Рабочее дерево чистое" : git.text;

  const mods = state.mods.filter(matches);
  els.count.textContent = `${mods.length} из ${state.mods.length} модов`;
  els.modList.innerHTML = "";
  for (const mod of mods) {
    const item = document.createElement("article");
    item.className = "mod";
    item.innerHTML = `
      <div>
        <h3></h3>
        <div class="meta">
          <span class="pill"></span>
          <span class="pill"></span>
          <span class="pill"></span>
        </div>
      </div>
      <button class="danger">Удалить</button>
      <div class="file"></div>
    `;
    item.querySelector("h3").textContent = mod.name;
    const pills = item.querySelectorAll(".pill");
    pills[0].textContent = mod.side || "side?";
    pills[1].textContent = mod.type;
    pills[2].textContent = mod.provider;
    item.querySelector(".file").textContent = mod.filename || mod.file;
    item.querySelector("button").addEventListener("click", () => removeMod(mod));
    els.modList.append(item);
  }
}

async function withBusy(fn) {
  if (busy) return;
  setBusy(true);
  try {
    await fn();
    await load();
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

async function addMod() {
  await withBusy(async () => {
    const data = await api("/api/mods/add", {
      method: "POST",
      body: JSON.stringify({
        provider: els.provider.value,
        source: els.source.value,
      }),
    });
    els.source.value = "";
    toast(data.output || "Мод добавлен");
  });
}

async function removeMod(mod) {
  if (!confirm(`Удалить ${mod.name}?`)) return;
  await withBusy(async () => {
    await api("/api/mods/remove", {
      method: "POST",
      body: JSON.stringify({ file: mod.file }),
    });
    toast("Мод удален");
  });
}

async function refresh() {
  await withBusy(async () => {
    await api("/api/refresh", { method: "POST", body: "{}" });
    toast("Index обновлен");
  });
}

async function push() {
  els.pushDialog.showModal();
}

async function confirmPush(event) {
  event.preventDefault();
  els.pushDialog.close();
  await withBusy(async () => {
    const data = await api("/api/push", {
      method: "POST",
      body: JSON.stringify({
        message: els.commitMessage.value,
        remote: els.remote.value,
      }),
    });
    toast(data.output || "Изменения отправлены");
  });
}

els.search.addEventListener("input", render);
els.sideFilter.addEventListener("change", render);
els.typeFilter.addEventListener("change", render);
els.addBtn.addEventListener("click", addMod);
els.refreshBtn.addEventListener("click", refresh);
els.pushBtn.addEventListener("click", push);
els.confirmPush.addEventListener("click", confirmPush);
els.source.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addMod();
});

load().catch((error) => toast(error.message));
