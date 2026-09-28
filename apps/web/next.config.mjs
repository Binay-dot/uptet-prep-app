import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@uptet/contracts",
    "@uptet/domain",
    "@uptet/database",
  ],
};

export default nextConfig;