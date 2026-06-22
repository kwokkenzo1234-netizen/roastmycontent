import { createRouteHandler } from "uploadthing/next"
import { ourFileRouter } from "./core"

// Guard: UploadThing token HARUS ada
if (!process.env.UPLOADTHING_TOKEN) {
  console.error(
    "\n[UploadThing] UPLOADTHING_TOKEN is not set!\n" +
    "Get your token from https://uploadthing.com/dashboard → API Keys\n" +
    "Token format: base64 JSON {apiKey, appId, regions}\n"
  )
}

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
