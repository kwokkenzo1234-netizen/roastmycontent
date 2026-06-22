import { createUploadthing, type FileRouter } from "uploadthing/next"

const f = createUploadthing()

export const ourFileRouter = {
  videoUploader: f({
    video: {
      maxFileSize: "128MB", // app cap sebenarnya 100MB (route.ts) — ini headroom UploadThing
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // Tidak ada auth di v1 — middleware kosong
      return {}
    })
    .onUploadComplete(async ({ file }) => {
      // file.ufsUrl adalah URL permanent (file.url deprecated sejak v7, hilang di v9)
      return { url: file.ufsUrl, key: file.key }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
