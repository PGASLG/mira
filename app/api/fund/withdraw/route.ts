import { withdraw } from "../../../lib/fundApi";
import { handle } from "../../../lib/fundRoute";

export async function POST(req: Request) {
  return handle(req, withdraw);
}
