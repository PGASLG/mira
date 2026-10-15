import { status } from "../../../lib/fundApi";
import { handle } from "../../../lib/fundRoute";

export async function GET() {
  return handle(null, (db, userId) => status(db, userId));
}
