export type SavedPublicationPhoto = { file: File; uploadedUrl?: string }

const DATABASE = "gimmy-drafts-v1"
const STORE = "publication-photos"
let writes: Promise<unknown> = Promise.resolve()

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Photo draft storage unavailable")); return }
    const request = indexedDB.open(DATABASE, 1)
    let finished = false
    const timeout = setTimeout(() => { finished = true; reject(new Error("Photo draft storage timed out")) }, 5000)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => {
      clearTimeout(timeout)
      if (finished) { request.result.close(); return }
      finished = true
      resolve(request.result)
    }
    request.onerror = () => { clearTimeout(timeout); finished = true; reject(request.error ?? new Error("Cannot open photo drafts")) }
    request.onblocked = () => { clearTimeout(timeout); finished = true; reject(new Error("Photo draft storage blocked")) }
  })
}

async function transaction(owner: string, value?: SavedPublicationPhoto[] | null): Promise<SavedPublicationPhoto[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, value === undefined ? "readonly" : "readwrite")
    const store = tx.objectStore(STORE)
    const request = value === undefined ? store.get(owner) : value === null || !value.length ? store.delete(owner) : store.put(value, owner)
    let result: SavedPublicationPhoto[] = []
    request.onsuccess = () => {
      if (value !== undefined) return
      if (request.result === undefined) return
      if (!Array.isArray(request.result) || !request.result.every((photo: SavedPublicationPhoto) => photo?.file instanceof Blob && typeof photo.file.name === "string")) { tx.abort(); return }
      result = request.result.map(({ file, uploadedUrl }: SavedPublicationPhoto) => ({
        file,
        uploadedUrl: typeof uploadedUrl === "string" && uploadedUrl.trim() ? uploadedUrl : undefined,
      }))
    }
    tx.oncomplete = () => { database.close(); resolve(result) }
    tx.onabort = tx.onerror = () => { database.close(); reject(tx.error ?? new Error("Cannot access photo drafts")) }
  })
}

export async function readPublicationPhotos(owner: string): Promise<SavedPublicationPhoto[]> {
  await writes
  return transaction(owner)
}
export function savePublicationPhotos(owner: string, photos: SavedPublicationPhoto[]): Promise<void> {
  const snapshot = photos.map(({ file, uploadedUrl }) => ({ file, uploadedUrl }))
  const task = writes.then(() => transaction(owner, snapshot)).then(() => undefined)
  writes = task.catch(() => {})
  return task
}
export function removePublicationPhotos(owner: string): Promise<void> {
  const task = writes.then(() => transaction(owner, null)).then(() => undefined)
  writes = task.catch(() => {})
  return task
}
