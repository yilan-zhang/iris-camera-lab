const dbName = "iris-motion-studio";
async function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("projects", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function transaction(mode, fn) {
  const d = await db();
  try {
    return await new Promise((resolve, reject) => {
      const t = d.transaction("projects", mode),
        r = fn(t.objectStore("projects"));
      let result;
      r.onsuccess = () => (result = r.result);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    d.close();
  }
}
export const saveProject = (p) => transaction("readwrite", (s) => s.put(p));
export const listProjects = () => transaction("readonly", (s) => s.getAll());
export const getProject = (id) => transaction("readonly", (s) => s.get(id));
