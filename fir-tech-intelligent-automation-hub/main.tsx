import { Evidence } from "./components/evidence"
import { UserManagement } from "./components/accounts"
import React from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom"
import { WorkbookProvider } from "./lib/workbook-context"
import { AppShell } from "./components/app-shell"
const Overview = React.lazy(() => import("./app/page"))
const Departments = React.lazy(() => import("./app/departments/page"))
const People = React.lazy(() => import("./app/people/page"))
const Courses = React.lazy(() => import("./app/courses/page"))
const Pipeline = React.lazy(() => import("./app/pipeline/page"))
const Revenue = React.lazy(() => import("./app/revenue/page"))
const Pathways = React.lazy(() => import("./app/pathways/page"))
const Reports = React.lazy(() => import("./app/reports/page"))
const Validation = React.lazy(() => import("./app/validation/page"))
const Audit = React.lazy(() => import("./app/audit/page"))
import "./app/globals.css"

createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><WorkbookProvider><AppShell><React.Suspense fallback={<p className="text-sm text-muted-foreground">Loading section…</p>}><Routes>
  <Route path="/evidence" element={<Evidence/>}/><Route path="/users" element={<UserManagement/>}/><Route path="/" element={<Overview/>}/><Route path="/departments" element={<Departments/>}/><Route path="/people" element={<People/>}/><Route path="/courses" element={<Courses/>}/><Route path="/training" element={<Navigate to="/courses" replace/>}/><Route path="/pipeline" element={<Pipeline/>}/><Route path="/revenue" element={<Revenue/>}/><Route path="/engagements" element={<Navigate to="/" replace/>}/><Route path="/pathways" element={<Pathways/>}/><Route path="/reports" element={<Reports/>}/><Route path="/audit" element={<Audit/>}/><Route path="/validation" element={<Validation/>}/><Route path="*" element={<p>Page not found. <Link to="/">Return to overview</Link></p>}/>
</Routes></React.Suspense></AppShell></WorkbookProvider></BrowserRouter></React.StrictMode>)


