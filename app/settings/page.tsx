import { auth } from "@clerk/nextjs/server";
import SettingsClient from "./SettingsClient";

// Signed-in users only.
export default async function SettingsPage() {
  await auth.protect();
  return <SettingsClient />;
}
