export * from "./photo-processing";
import {
  validPhotoMetadata,
  validPhotoPolicy,
  photoCaps,
  type PhotoMetadata,
  type PhotoPolicy,
} from "./domain";
import type { ProcessedPhoto } from "./photo-processing";
import {
  getStorage,
  connectStorageEmulator,
  ref,
  getBytes,
} from "firebase/storage";
import { doc, getDocFromServer } from "firebase/firestore";
import { app, auth, db, configured, emulator } from "./firebase";

export interface PhotoPersistence {
  upload(
    publicId: string,
    photo: ProcessedPhoto,
    policy: PhotoPolicy,
  ): Promise<PhotoMetadata>;
  readPrivate(
    publicId: string,
    photo: PhotoMetadata,
    variant: "web" | "vcf",
  ): Promise<Uint8Array>;
  readPublic(
    publicId: string,
    photo: PhotoMetadata,
    variant: "web" | "vcf",
  ): Promise<Uint8Array>;
  cleanup(publicId: string): Promise<{ inspected: number; removed: number }>;
}
const project = app.options.projectId || "";
const bucket = emulator
  ? `${project}.appspot.com`
  : import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const endpoint = emulator
  ? `http://127.0.0.1:5001/${project}/us-east1/photoApi`
  : import.meta.env.VITE_PUBLIC_PHOTO_ENDPOINT || "/media/photo";
export const photoStorageReady =
  configured &&
  !!bucket &&
  (emulator || !!import.meta.env.VITE_PUBLIC_PHOTO_ENDPOINT);
const storage = photoStorageReady ? getStorage(app, `gs://${bucket}`) : null;
if (storage && emulator) connectStorageEmulator(storage, "127.0.0.1", 9199);
const idSafe = (value: string) => /^[a-f0-9]{32}$/.test(value);
const sameUser = (uid: string) => {
  if (auth.currentUser?.uid !== uid)
    throw Error(
      "Your signed-in account changed. Choose the photo again in the current account.",
    );
};
async function owner(publicId: string) {
  if (!photoStorageReady || !storage)
    throw Error(
      "Photo storage is not configured yet. Your existing profile details are retained.",
    );
  if (!idSafe(publicId) || !auth.currentUser || auth.currentUser.isAnonymous)
    throw Error("Sign in again to manage your photo.");
  const user = auth.currentUser;
  const account = await getDocFromServer(doc(db, "accounts", user.uid));
  sameUser(user.uid);
  if (account.data()?.publicId !== publicId)
    throw Error("Photo access denied.");
  return user;
}
async function api(action: "upload" | "cleanup", body: object) {
  if (!auth.currentUser) throw Error("Sign in again to manage your photo.");
  const user = auth.currentUser;
  const token = await user.getIdToken();
  sameUser(user.uid);
  const response = await fetch(`${endpoint}?action=${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const value = await response.json().catch(() => null);
  sameUser(user.uid);
  if (!response.ok)
    throw Error(
      value?.error ||
        "Photo upload did not complete. Your crop is retained; try again.",
    );
  return value;
}
const uploads = new WeakMap<
  ProcessedPhoto,
  {
    id: string;
    uid: string;
    publicId: string;
    result?: PhotoMetadata;
  }
>();
async function base64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let encoded = "";
  for (let at = 0; at < bytes.length; at += 8192)
    encoded += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(encoded);
}
export async function uploadPhoto(
  publicId: string,
  photo: ProcessedPhoto,
  policy: PhotoPolicy,
): Promise<PhotoMetadata> {
  const user = await owner(publicId);
  if (
    !validPhotoPolicy(policy) ||
    !policy.enabled ||
    photo.web.type !== "image/jpeg" ||
    photo.vcf.type !== "image/jpeg" ||
    photo.web.size > policy.webMaxBytes ||
    photo.vcf.size > policy.vcfMaxBytes
  )
    throw Error(
      "Photo derivatives do not match the current plan. Choose the photo again.",
    );
  let job = uploads.get(photo);
  if (!job) {
    job = {
      id: crypto.randomUUID().replaceAll("-", ""),
      uid: user.uid,
      publicId,
    };
    uploads.set(photo, job);
  }
  if (job.uid !== user.uid || job.publicId !== publicId)
    throw Error("Your signed-in account changed. Choose the photo again.");
  if (job.result) return job.result;
  const [web, vcf] = await Promise.all([base64(photo.web), base64(photo.vcf)]);
  sameUser(user.uid);
  const result = await api("upload", { publicId, photoId: job.id, web, vcf });
  sameUser(user.uid);
  if (
    !validPhotoMetadata(result) ||
    result.id !== job.id ||
    result.webBytes !== photo.web.size ||
    result.vcfBytes !== photo.vcf.size
  )
    throw Error("Photo confirmation was invalid. Your draft was not changed.");
  job.result = result;
  return result;
}
export async function readPrivatePhoto(
  publicId: string,
  photo: PhotoMetadata,
  variant: "web" | "vcf" = "web",
): Promise<Uint8Array> {
  const user = await owner(publicId);
  if (!validPhotoMetadata(photo)) throw Error("Photo metadata is invalid.");
  const maximum =
    variant === "web" ? photoCaps.webMaxBytes : photoCaps.vcfMaxBytes;
  const expected = variant === "web" ? photo.webBytes : photo.vcfBytes;
  const value = new Uint8Array(
    await getBytes(
      ref(storage!, `profilePhotos/${user.uid}/${photo.id}/${variant}.jpg`),
      maximum,
    ),
  );
  sameUser(user.uid);
  if (value.length !== expected)
    throw Error("Photo bytes do not match the saved profile. Try again.");
  return value;
}
export async function readPublicPhoto(
  publicId: string,
  photo: PhotoMetadata,
  variant: "web" | "vcf" = "web",
): Promise<Uint8Array> {
  if (!photoStorageReady || !idSafe(publicId) || !validPhotoMetadata(photo))
    throw Error("Photo unavailable.");
  const url = `${endpoint}?action=public&profile=${encodeURIComponent(publicId)}&photo=${encodeURIComponent(photo.id)}&variant=${variant}`;
  const response = await fetch(url, { cache: "no-store" });
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "image/jpeg"
  )
    throw Error("Photo unavailable.");
  const maximum =
    variant === "web" ? photoCaps.webMaxBytes : photoCaps.vcfMaxBytes;
  const expected = variant === "web" ? photo.webBytes : photo.vcfBytes;
  const length = response.headers.get("content-length");
  if (
    expected > maximum ||
    (length !== null && (!/^\d+$/.test(length) || Number(length) !== expected))
  )
    throw Error("Photo unavailable.");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Photo unavailable.");
  const bytes = new Uint8Array(expected);
  let received = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (received + chunk.value.byteLength > expected)
        throw Error("Photo unavailable.");
      bytes.set(chunk.value, received);
      received += chunk.value.byteLength;
    }
    if (received !== expected) throw Error("Photo unavailable.");
  } catch {
    void reader.cancel().catch(() => {});
    throw Error("Photo unavailable.");
  } finally {
    reader.releaseLock();
  }
  return bytes;
}
export async function cleanupPhotos(
  publicId: string,
): Promise<{ inspected: number; removed: number }> {
  await owner(publicId);
  return api("cleanup", { publicId });
}
