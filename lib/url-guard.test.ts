import { describe, it, expect } from "vitest"
import { assertSafeUrl, isAllowedUploadHost, isPrivateIp } from "./url-guard"

describe("isPrivateIp", () => {
  it("menandai loopback & metadata cloud sebagai privat", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true)
    expect(isPrivateIp("169.254.169.254")).toBe(true) // cloud metadata
    expect(isPrivateIp("10.0.0.5")).toBe(true)
    expect(isPrivateIp("172.16.0.1")).toBe(true)
    expect(isPrivateIp("192.168.1.1")).toBe(true)
    expect(isPrivateIp("0.0.0.0")).toBe(true)
    expect(isPrivateIp("::1")).toBe(true)
    expect(isPrivateIp("fe80::1")).toBe(true)
    expect(isPrivateIp("fd00::1")).toBe(true)
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true)
  })

  it("mengizinkan IP publik", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false)
    expect(isPrivateIp("1.1.1.1")).toBe(false)
    expect(isPrivateIp("172.32.0.1")).toBe(false) // di luar 172.16/12
  })

  it("menolak string non-IP", () => {
    expect(isPrivateIp("bukan-ip")).toBe(true)
  })
})

describe("isAllowedUploadHost", () => {
  it("hanya menerima host UploadThing", () => {
    expect(isAllowedUploadHost("utfs.io")).toBe(true)
    expect(isAllowedUploadHost("abc123.ufs.sh")).toBe(true)
    expect(isAllowedUploadHost("evil.com")).toBe(false)
    expect(isAllowedUploadHost("utfs.io.evil.com")).toBe(false)
  })
})

describe("assertSafeUrl", () => {
  it("menolak protokol non-http(s)", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow()
    await expect(assertSafeUrl("gopher://x")).rejects.toThrow()
  })

  it("menolak IP literal internal", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toThrow()
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow()
  })

  it("menolak host non-UploadThing saat requireUploadHost", async () => {
    await expect(
      assertSafeUrl("https://evil.com/file.mp4", { requireUploadHost: true })
    ).rejects.toThrow("Host file tidak diizinkan")
  })

  it("mengizinkan IP publik literal", async () => {
    await expect(assertSafeUrl("https://8.8.8.8/")).resolves.toBeUndefined()
  })
})
