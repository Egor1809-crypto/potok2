import type { Metadata } from "next";
import { ArtDirectorView } from "@/components/art-director/ArtDirectorView";

export const metadata: Metadata = { title: "Арт-директор" };
export default function ArtDirectorPage() { return <ArtDirectorView />; }
