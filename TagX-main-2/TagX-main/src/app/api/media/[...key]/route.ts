import { getCompanyMediaObject } from "@/modules/storage/actions";

export async function GET(_request: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.map((segment) => decodeURIComponent(segment)).join("/");
  const object = await getCompanyMediaObject(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
