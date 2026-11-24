import { NextResponse, type NextRequest } from "next/server";
import { signedFileUrl } from "@/features/files/actions";

/** GET /api/files/:id[?download=1] → 302 to a 5-minute signed URL (or 404). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  try {
    const url = await signedFileUrl(id, request.nextUrl.searchParams.get("download") === "1");
    if (!url) return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
}
