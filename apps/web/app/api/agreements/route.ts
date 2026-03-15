import { NextRequest } from "next/server";

import { POST as createDraftPost } from "@/app/api/agreements/drafts/route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return createDraftPost(request);
}
