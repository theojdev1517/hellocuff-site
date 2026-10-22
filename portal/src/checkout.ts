// Deliberately untrusted rehearsal state; never read by security rules/entitlements.
export interface CheckoutBoundary {
  complete(
    id: string,
    result: "success" | "cancel" | "failure",
  ): { id: string; status: string; simulated: true };
}
export class DevelopmentCheckout implements CheckoutBoundary {
  constructor(private storage: Pick<Storage, "getItem" | "setItem">) {}
  complete(id: string, result: "success" | "cancel" | "failure") {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid rehearsal ID");
    const key = `hellocuff-rehearsal:${id}`;
    const previous = this.storage.getItem(key);
    const status = previous === "success" ? "success" : result;
    this.storage.setItem(key, status);
    return { id, status, simulated: true as const };
  }
}
