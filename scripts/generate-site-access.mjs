import { randomBytes, scryptSync } from "node:crypto";

const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64).toString("hex");
const secret = randomBytes(48).toString("base64url");

process.stdout.write(`Save the password in a password manager. Do not commit these values.\n\nSite password: ${password}\nSITE_ACCESS_PASSWORD_HASH=${salt.toString("hex")}:${hash}\nSITE_ACCESS_SESSION_SECRET=${secret}\n`);
