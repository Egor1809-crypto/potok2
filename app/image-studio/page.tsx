import type { Metadata } from "next";

import { ImageStudioView } from "@/components/image-studio";

export const metadata: Metadata = {
  title: "Студия изображений",
  description: "Создание и хранение изображений для писем Поток.",
};

export default function ImageStudioPage() {
  return <ImageStudioView />;
}
