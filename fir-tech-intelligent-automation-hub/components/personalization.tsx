import { useEffect, useState } from "react"
import { Palette } from "lucide-react"

const palettes = [
  { id: "blue", name: "FIRtech Blue", colours: "linear-gradient(120deg, #15394f, #2a98c8)" },
  { id: "indigo", name: "Indigo Slate", colours: "linear-gradient(120deg, #292e50, #797faf)" },
  { id: "forest", name: "Forest Teal", colours: "linear-gradient(120deg, #173f38, #419886)" },
]
export function Personalization() {
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState(() => {
    try { const saved = localStorage.getItem("firtech-palette"); return palettes.some(p => p.id === saved) ? saved! : "blue" }
    catch { return "blue" }
  })
  useEffect(() => {
    document.documentElement.dataset.palette = palette
    try { localStorage.setItem("firtech-palette", palette) } catch { /* Preferences are optional in private sessions. */ }
  }, [palette])
  return <div className="border-t border-sidebar-border p-3">
    <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent" aria-expanded={open} aria-controls="palette-options" onClick={() => setOpen(!open)}><Palette className="h-4 w-4" />Personalize</button>
    {open && <fieldset id="palette-options" className="mt-2 space-y-1" onKeyDown={e => { if (e.key === "Escape") setOpen(false) }}>
      <legend className="px-3 pb-2 text-xs text-sidebar-foreground/70">Colour palette</legend>
      {palettes.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
        <input type="radio" name="palette" value={p.id} checked={palette === p.id} onChange={() => setPalette(p.id)} className="accent-white" />
        <span aria-hidden className="h-4 w-7 rounded border border-white/30" style={{ background: p.colours }} />{p.name}
      </label>)}
    </fieldset>}
  </div>
}
