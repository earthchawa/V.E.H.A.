import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { isUserUploadKey } from "@/lib/storage";

/**
 * Lets a signed-in user's browser upload ONE file straight to Vercel Blob (request bodies through a Vercel
 * function are capped at 4.5 MB). The file may only land under the user's own prefix, is private, and is limited
 * to the configured upload size. What it is for (a material, a submission…) is decided afterwards by the server
 * action that receives the reference, with its own permission checks.
 *
 * Two ways, matching how the store is connected (config.blobAuth):
 *  - "token" (BLOB_READ_WRITE_TOKEN): issue a client token (`upload()` in the browser);
 *  - "oidc" (BLOB_STORE_ID, Vercel's newer default): issue a presigned PUT URL (`uploadPresigned()`).
 */
export async function POST(request: Request): Promise<Response> {
  if (!config.directUpload) return Response.json({ error: "direct uploads are off" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as HandleUploadBody | HandleUploadPresignedBody;
  const maximumSizeInBytes = config.maxUploadMb * 1024 * 1024;
  const validUntil = Date.now() + 10 * 60 * 1000;
  const checkPath = (pathname: string) => {
    if (!isUserUploadKey(pathname, user.id)) throw new Error("invalid upload path");
  };
  try {
    // Only issuance requests: the browser never needs the "upload completed" callback, and it is not authenticated.
    if (body.type === "blob.generate-client-token") {
      const result = await handleUpload({
        request,
        body,
        onBeforeGenerateToken: async (pathname) => {
          checkPath(pathname);
          return { maximumSizeInBytes, addRandomSuffix: false, allowOverwrite: false, validUntil };
        },
      });
      return Response.json(result);
    }
    if (body.type === "blob.generate-presigned-url") {
      const result = await handleUploadPresigned({
        request,
        body,
        getSignedToken: async (pathname) => {
          checkPath(pathname);
          const token = await issueSignedToken({ pathname, operations: ["put"], validUntil, maximumSizeInBytes });
          return { token, urlOptions: { maximumSizeInBytes, addRandomSuffix: false, allowOverwrite: false, validUntil } };
        },
      });
      return Response.json(result);
    }
    return Response.json({ error: "unsupported" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
