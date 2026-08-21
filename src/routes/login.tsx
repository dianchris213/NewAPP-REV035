import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk - Catatan Keuangan Mini App" },
      {
        name: "description",
        content: "Masuk dengan Telegram atau Google untuk membuka catatan keuangan Anda.",
      },
      { property: "og:title", content: "Masuk - Catatan Keuangan Mini App" },
      {
        property: "og:description",
        content: "Autentikasi cepat lewat Telegram Mini App atau akun Google.",
      },
    ],
  }),
  component: () => <AuthScreen mode="login" />,
});
