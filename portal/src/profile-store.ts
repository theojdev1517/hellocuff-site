import {
  doc,
  runTransaction,
  type Firestore,
  type DocumentData,
} from "firebase/firestore";
// Shared real Firestore transaction used by the browser adapter and emulator tests.
// Validation belongs to the caller and is independently enforced by Firestore rules.
export async function commitProfile(
  db: Firestore,
  uid: string,
  publicId: string,
  value: DocumentData,
  publish: boolean,
) {
  await runTransaction(
    db,
    async (transaction) => {
      await transaction.get(doc(db, "accounts", uid));
      transaction.set(doc(db, "drafts", uid), value);
      if (publish)
        transaction.set(doc(db, "publicProfiles", publicId), {
          ...value,
          published: true,
        });
    },
    { maxAttempts: 2 },
  );
}
