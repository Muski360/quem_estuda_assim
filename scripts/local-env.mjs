import { existsSync } from "node:fs";

if (existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");
