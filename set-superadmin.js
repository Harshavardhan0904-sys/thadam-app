import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const config = JSON.parse(readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp({ projectId: config.projectId });
const auth = getAuth(app);

async function grantSuperAdmin(email) {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { superAdmin: true });
  console.log(`Successfully assigned superAdmin: true to ${email} (UID: ${user.uid})`);
}

grantSuperAdmin("harshavardhan04off@gmail.com");
