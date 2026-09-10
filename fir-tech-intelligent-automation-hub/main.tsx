import React from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import { WorkbookProvider } from "./lib/workbook-context"
import { AppShell } from "./components/app-shell"
import Overview from "./app/page"
import Departments from "./app/departments/page"
import People from "./app/people/page"
import Training from "./app/training/page"
import Pipeline from "./app/pipeline/page"
import Revenue from "./app/revenue/page"
import Engagements from "./app/engagements/page"
import Pathways from "./app/pathways/page"
import Reports from "./app/reports/page"
import Validation from "./app/validation/page"
import "./app/globals.css"

createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><WorkbookProvider><AppShell><Routes>
  <Route path="/" element={<Overview/>}/><Route path="/departments" element={<Departments/>}/><Route path="/people" element={<People/>}/><Route path="/training" element={<Training/>}/><Route path="/pipeline" element={<Pipeline/>}/><Route path="/revenue" element={<Revenue/>}/><Route path="/engagements" element={<Engagements/>}/><Route path="/pathways" element={<Pathways/>}/><Route path="/reports" element={<Reports/>}/><Route path="/validation" element={<Validation/>}/><Route path="*" element={<p>Page not found. <Link to="/">Return to overview</Link></p>}/>
</Routes></AppShell></WorkbookProvider></BrowserRouter></React.StrictMode>)
