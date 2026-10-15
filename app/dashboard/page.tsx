import { auth } from "@clerk/nextjs/server";
import DashboardFrame from "./DashboardFrame";

// Signed-in users only. The dashboard itself is a static file served from /public.
export default async function Dashboard() {
  await auth.protect();
  return <DashboardFrame />;
}
