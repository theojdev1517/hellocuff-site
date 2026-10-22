import { validPhotoPolicy, type PhotoMetadata, type PhotoPolicy } from "./domain";

// Private server registry metadata drives this UX check. Firestore rules enforce
// the same requirement independently, including when config changes mid-save.
export function photoAssetIssue(photo: PhotoMetadata, asset: unknown, policy: PhotoPolicy): string | null {
  const retry = "This photo is not ready to save. Choose a new crop or remove the photo; your edits remain here.";
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return retry;
  const record = asset as Record<string, unknown>;
  if (record.state !== "ready" || record.webBytes !== photo.webBytes || record.vcfBytes !== photo.vcfBytes) return retry;
  if (!validPhotoPolicy(policy) || !policy.enabled ||
      !Number.isInteger(record.webDimension) || !Number.isInteger(record.vcfDimension) ||
      Number(record.webDimension) < 1 || Number(record.vcfDimension) < 1 ||
      Number(record.webDimension) > policy.webMaxDimension || Number(record.vcfDimension) > policy.vcfMaxDimension ||
      photo.webBytes > policy.webMaxBytes || photo.vcfBytes > policy.vcfMaxBytes)
    return "This photo exceeds the current plan limits. Choose a new crop or remove the photo; your edits remain here.";
  return null;
}
