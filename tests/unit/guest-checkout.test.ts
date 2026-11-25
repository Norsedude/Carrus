import { describe, expect, it, vi } from "vitest";
import { guestUserId } from "@/server/booking/guest";
import type { Db } from "@/server/vehicles/repository";

function fakeAdmin(existing: { id: string; email: string }[]) {
  const createUser = vi.fn(async ({ email }: { email: string }) =>
    existing.some((u) => u.email === email)
      ? { data: { user: null }, error: { message: "A user with this email address has already been registered" } }
      : { data: { user: { id: "new-user-id", email } }, error: null },
  );
  const listUsers = vi.fn(async () => ({ data: { users: existing }, error: null }));
  return { admin: { auth: { admin: { createUser, listUsers } } } as unknown as Db, createUser, listUsers };
}

describe("guest checkout account", () => {
  it("creates a password-less account for a new email (normalized)", async () => {
    const { admin, createUser } = fakeAdmin([]);
    expect(await guestUserId(admin, "  Guest@Example.COM ", "Casey")).toBe("new-user-id");
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "guest@example.com", email_confirm: true }));
    expect(createUser.mock.calls[0][0]).not.toHaveProperty("password");
  });

  it("files the booking under the existing account when the email is already registered", async () => {
    const { admin, listUsers } = fakeAdmin([{ id: "other", email: "someone@x.com" }, { id: "existing-id", email: "guest@example.com" }]);
    expect(await guestUserId(admin, "guest@example.com", "Casey")).toBe("existing-id");
    expect(listUsers).toHaveBeenCalled();
  });
});
