import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

const initialData = {
  student: null,
  tasks: [],
  automations: []
};

export async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    await writeDb(initialData);
    return structuredClone(initialData);
  }
}

export async function writeDb(data) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function updateDb(mutator) {
  const data = await readDb();
  const updated = await mutator(data) ?? data;
  await writeDb(updated);
  return updated;
}
