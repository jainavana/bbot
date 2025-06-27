// storage.js
import { JSONFile, Low } from 'lowdb';
import { join } from 'path';

const file = join(process.cwd(), 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

const defaultData = {
  sessions: {},
  roles: {
    superAdmins: ['919819055003@c.us'],
    admins: {}
  },
  approvedLocations: {},
  groupMembers: {}
};

await db.read();
db.data ||= defaultData;
await db.write();

export default {
  async getData() {
    await db.read();
    return db.data;
  },

  async update(modifyFn) {
    await db.read();
    modifyFn(db.data);
    await db.write();
  },

  async save() {
    await db.write();
  }
};