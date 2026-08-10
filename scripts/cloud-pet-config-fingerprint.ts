import { computeCloudPetSafeConfigSha256 } from "../src/config/cloud-pet-config-fingerprint";

process.stdout.write(`${computeCloudPetSafeConfigSha256(process.env)}\n`);
