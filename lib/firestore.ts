import { readFileSync } from "fs";
import path from "path";
import admin from "firebase-admin";

let app: admin.app.App | null = null;

function getServiceAccount(): admin.ServiceAccount {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return JSON.parse(inlineJson) as admin.ServiceAccount;
  }

  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (base64Json) {
    const raw = Buffer.from(base64Json, "base64").toString("utf8");
    return JSON.parse(raw) as admin.ServiceAccount;
  }

  const credsPath = process.env.FIREBASE_CREDENTIALS_PATH;
  if (credsPath) {
    const absolutePath = path.resolve(credsPath);
    const raw = readFileSync(absolutePath, "utf8");
    return JSON.parse(raw) as admin.ServiceAccount;
  }

  throw new Error(
    "Firebase admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, or FIREBASE_CREDENTIALS_PATH.",
  );
}

export function getFirestore() {
  if (!app) {
    if (admin.apps.length) {
      app = admin.app();
    } else {
      const serviceAccount = getServiceAccount();
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }

  return admin.firestore();
}
