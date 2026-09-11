import { readFileSync, writeFileSync } from "node:fs"
import { ensureAccounts } from "../lib/services/accounts-workbook"
async function main() {
  const path = "public/firtech_dashboard.xlsx"
  const bytes = readFileSync(path)
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const output = await ensureAccounts(input)
  if (output !== input) writeFileSync(path, new Uint8Array(output))
  console.log("Source workbook account schema ready.")
}
void main()
