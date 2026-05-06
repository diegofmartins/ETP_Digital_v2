import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

// Load config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase for the server
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const expressApp = express();
  const PORT = 3000;

  expressApp.use(express.json());

  // API to get backups for the UI
  expressApp.get("/api/backups", async (req, res) => {
    try {
      const backupsRef = collection(db, 'backups');
      const q = query(backupsRef, orderBy('createdAt', 'desc'), limit(7));
      const querySnap = await getDocs(q);
      
      const backups = querySnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to ISO string for the client
        createdAt: doc.data().createdAt?.toDate().toISOString()
      }));
      
      res.json(backups);
    } catch (error: any) {
      console.error("Error fetching backups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual trigger if needed
  expressApp.post("/api/backups/trigger", async (req, res) => {
    try {
      await performBackup();
      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  expressApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function performBackup() {
  console.log("[Backup] Iniciando backup automático...");
  try {
    // Backup etps
    const etpsRef = collection(db, 'etps');
    const etpsSnap = await getDocs(etpsRef);
    const etpsData = etpsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Backup users
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Config
    const configSnap = await getDocs(collection(db, 'config'));
    const configData = configSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const backupPayload = {
      etps: etpsData,
      users: usersData,
      config: configData,
      version: "1.0",
      type: "automatic"
    };

    // Store in backups collection
    const backupsRef = collection(db, 'backups');
    await addDoc(backupsRef, {
      data: JSON.stringify(backupPayload),
      createdAt: serverTimestamp(),
      filename: `backup_${new Date().toISOString().split('T')[0]}.json`
    });

    // Cleanup old backups (keep only last 7)
    const q = query(backupsRef, orderBy('createdAt', 'desc'));
    const allBackupsSnap = await getDocs(q);
    if (allBackupsSnap.docs.length > 7) {
      const toDelete = allBackupsSnap.docs.slice(7);
      for (const d of toDelete) {
        await deleteDoc(doc(db, 'backups', d.id));
      }
    }

    console.log("[Backup] Backup concluído com sucesso!");
  } catch (error) {
    console.error("[Backup] Erro ao realizar backup:", error);
  }
}

// Schedule backup at 23:59:59 every day
// Syntax: second minute hour day-of-month month day-of-week
cron.schedule('59 59 23 * * *', () => {
  performBackup();
});

startServer();
