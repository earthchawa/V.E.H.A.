import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { isUserUploadKey } from "@/lib/storage";

/**
 * Issues a short-lived token so a signed-in user's browser can upload ONE file straight to Vercel Blob
 * (request bodies through a Vercel function are capped at 4.5 MB). The file may only land under the user's own
 * prefix, is private, and is limited to the configured upload size. What it is for (a material, a submission…)
 * is decided afterwards by the server action that receives the reference, with its own permission checks.
 */
export async function POST(request: Request): Promise<Response> {
  if (!config.directUpload) return Response.json({ error: "direct uploads are off" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as HandleUploadBody;
  // Only token requests: the browser never needs the "upload completed" callback, and it is not authenticated.
  if (body.type !== "blob.generate-client-token") return Response.json({ error: "unsupported" }, { status: 400 });
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isUserUploadKey(pathname, user.id)) throw new Error("invalid upload path");
        return {
          maximumSizeInBytes: config.maxUploadMb * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
