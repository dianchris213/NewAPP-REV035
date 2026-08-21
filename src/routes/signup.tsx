import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Daftar - Catatan Keuangan Mini App" },
      {
        name: "description",
        content: "Buat akun baru lewat Telegram atau Google dan mulai mencatat keuangan harian.",
      },
      { property: "og:title", content: "Daftar - Catatan Keuangan Mini App" },
      {
        property: "og:description",
        content: "Registrasi singkat untuk mulai mencatat pemasukan dan pengeluaran.",
      },
    ],
  }),
  component: () => <AuthScreen mode="signup" />,
});
