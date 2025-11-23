import { generateManifest } from "@/lib/metadata";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return generateManifest();
}
