import type { Metadata } from "next";

import { PresentationPageFrame } from "@/components/presentations/PresentationPageFrame";
import { PresentationStudio } from "@/components/presentations";

export const metadata: Metadata = { title: "Презентации" };

export default function PresentationsPage() {
  return (
    <PresentationPageFrame>
      <PresentationStudio />
    </PresentationPageFrame>
  );
}
