import { useState } from "react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { accounts, hashPassword, type Account } from "@/lib/services/permissions"
import { readEditorSheet } from "@/lib/services/workbook-editor"
import { Button } from "./ui/button"

export function AccountControls() {
  const { user, signIn, signOut, loading } = useWorkbook()
  const [open, setOpen] = useState(false), [username, setUsername] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState("")
  return <div className="border-t border-sidebar-border p-4 text-sm">
    <div className="flex items-center justify-between"><span>{user.Role}</span>{user.Username ? <button disabled={loading} onClick={signOut}>Sign out</button> : <button onClick={() => setOpen(!open)}>Sign in</button>}</div>
    {open && !user.Username && <form className="mt-3 space-y-2" onSubmit={async e => { e.preventDefault(); setError(""); try { await signIn(username, password); setPassword(""); setOpen(false) } catch(e) { setError((e as Error).message) } }}>
      <input aria-label="Username" autoComplete="username" placeholder="Username" className="w-full rounded bg-background p-2 text-foreground" value={username} onChange={e => setUsername(e.target.value)} />
      <input aria-label="Password" autoComplete="current-password" type="password" placeholder="Password" className="w-full rounded bg-background p-2 text-foreground" value={password} onChange={e => setPassword(e.target.value)} />
      <Button type="submit" disabled={loading}>Sign in</Button>{error && <p role="alert">{error}</p>}
    </form>}
  </div>
}
export function UserManagement() {
  const { buffer, user, editRecord, loading } = useWorkbook()
  const data = useWorkbookData(false)
  const [editing, setEditing] = useState<Account | null>(null), [password, setPassword] = useState(""), [error, setError] = useState("")
  if (!buffer || !(user.Role === "Administrator" || user.Role === "Contributor" && user.ManageUsers)) return <p>Permission required to manage users.</p>
  const users = accounts(buffer).filter(a => a.Username !== "admin")
  const field = (key: keyof Account, value: string | boolean) => setEditing(editing ? { ...editing, [key]: value } : null)
  return <section className="space-y-4"><h1 className="text-2xl font-semibold">Users and permissions</h1>
    <p>Accounts are separate from people and business records. Permission changes are saved to the Users worksheet.</p>
    <Button disabled={loading} onClick={() => { setEditing({ Username: "", PasswordHash: "", Role: "Viewer", Departments: "", Active: true, ExportReports: false, ManageUsers: false, ManagePathways: false }); setPassword(""); setError("") }}>Add user</Button>
    {users.map(a => <div className="flex gap-4 rounded border bg-card p-3" key={a.Username}><span>{a.Username} · {a.Role} · {a.Active ? "Active" : "Inactive"}</span><Button variant="outline" onClick={() => { setEditing(a); setPassword(""); setError("") }}>Edit permissions</Button></div>)}
    {editing && <form className="space-y-3 rounded border bg-card p-5" onSubmit={async e => { e.preventDefault(); setError(""); try {
      const hash = password ? await hashPassword(password) : editing.PasswordHash
      const row = readEditorSheet(buffer, "Users").rows.find(r => r.values.Username === editing.Username)
      await editRecord("Users", row?.row ?? null, { ...editing, PasswordHash: hash }, "save"); setEditing(null); setPassword("")
    } catch(e) { setError((e as Error).message) } }}>
      <label className="block">Username<input required className="ml-3 rounded border p-2" value={editing.Username} disabled={!!editing.PasswordHash} onChange={e => field("Username", e.target.value)} /></label>
      <label className="block">New password<input type="password" autoComplete="new-password" className="ml-3 rounded border p-2" value={password} onChange={e => setPassword(e.target.value)} placeholder={editing.PasswordHash ? "Leave blank to retain" : "Required"} /></label>
      <label className="block">Role<select className="ml-3 rounded border p-2" value={editing.Role} onChange={e => field("Role", e.target.value)}>{["Viewer", "Contributor", "Administrator"].map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="block">Permitted departments<input className="ml-3 rounded border p-2" value={editing.Departments} onChange={e => field("Departments", e.target.value)} placeholder="Comma-separated IDs or * for all" /></label>
      <p className="text-sm text-muted-foreground">{data?.departments.map(d => `${d.departmentId}: ${d.name}`).join(" · ")}. Blank grants no departments; * grants all.</p>
      {(["Active", "ExportReports", "ManagePathways", "ManageUsers"] as const).map(key => <label className="mr-5 inline-flex gap-2" key={key}><input type="checkbox" checked={editing[key]} onChange={e => field(key, e.target.checked)} />{key}</label>)}
      <div><Button type="submit" disabled={loading}>Save user</Button><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </form>}
  </section>
}

