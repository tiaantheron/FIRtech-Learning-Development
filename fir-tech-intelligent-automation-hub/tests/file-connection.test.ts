import { test } from "node:test"
import assert from "node:assert/strict"
import { writeSource, type WorkbookHandle } from "../lib/services/file-connection"

const bytes = (value: number) => new Uint8Array([value]).buffer
function fileConnection() {
  let disk = bytes(1), staged = disk
  let permission: PermissionState = "granted"
  let failure = "", writes = 0, aborts = 0
  const handle: WorkbookHandle = {
    name: "source.xlsx",
    getFile: async () => new File([disk], "source.xlsx"),
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    createWritable: async () => {
      if (failure === "locked") throw new Error("File is locked")
      return {
        write: async data => { writes++; staged = data; if (failure === "write") throw new Error("Disk full") },
        close: async () => { if (failure === "close") throw new Error("Commit failed"); disk = staged },
        abort: async () => { aborts++; staged = disk },
      }
    },
  }
  return { handle, disk: () => disk, writes: () => writes, aborts: () => aborts, permission: (p: PermissionState) => { permission = p }, fail: (f: string) => { failure = f } }
}

test("source saves successive edits and undo, rejecting stale copies and lost permissions", async () => {
  const file = fileConnection()
  await writeSource(file.handle, bytes(1), bytes(2))
  await writeSource(file.handle, bytes(2), bytes(3))
  await assert.rejects(writeSource(file.handle, bytes(2), bytes(4)), /No overwrite/)
  assert.deepEqual(file.disk(), bytes(3)); assert.equal(file.writes(), 2)
  file.permission("denied")
  await assert.rejects(writeSource(file.handle, bytes(3), bytes(1)), /permission/)
  assert.equal(file.writes(), 2)
  file.permission("granted")
  await writeSource(file.handle, bytes(3), bytes(2))
  assert.deepEqual(file.disk(), bytes(2))
})

test("locked files and write/close failures retain the source and allow retry", async () => {
  for (const reason of ["locked", "write", "close"]) {
    const file = fileConnection(); file.fail(reason)
    await assert.rejects(writeSource(file.handle, bytes(1), bytes(2)))
    assert.deepEqual(file.disk(), bytes(1))
    assert.equal(file.aborts(), reason === "locked" ? 0 : 1)
    file.fail("")
    await writeSource(file.handle, bytes(1), bytes(2))
    assert.deepEqual(file.disk(), bytes(2))
  }
})
