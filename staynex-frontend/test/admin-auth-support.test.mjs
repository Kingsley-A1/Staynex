import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSupportContact } from "../src/lib/support-contact.ts";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("admin access is a production-safe login while registration stays gated", async () => {
  const [access, registration, form] = await Promise.all([
    source("../src/app/(public)/admin-access/page.tsx"),
    source("../src/app/(public)/admin-access/register/page.tsx"),
    source("../src/features/auth/auth-form.tsx"),
  ]);

  assert.match(access, /<AuthForm mode="login" next="\/admin" requireAdmin/);
  assert.doesNotMatch(access, /ENABLE_ADMIN_ACCESS_PAGE|notFound/);
  assert.match(registration, /ENABLE_ADMIN_ACCESS_PAGE/);
  assert.match(registration, /<AuthForm mode="admin" next="\/admin"/);
  assert.match(form, /requireAdmin && !isAdminCapable\(user\)/);
  assert.match(form, /does not have admin access/);
  assert.match(form, /mode === "admin"/);
});

test("forbidden workspace explains the signed-in mismatch and offers recovery", async () => {
  const forbidden = await source("../src/app/forbidden.tsx");
  assert.match(forbidden, /This account cannot open this workspace/);
  assert.match(forbidden, /does not include the required Staynex permission/);
  assert.match(forbidden, /<AccountSwitchButton/);
  assert.match(forbidden, /href="\/support"/);
});

test("support contact values come from environment and phone links are normalized", () => {
  const previous = {
    email: process.env.SUPPORT_EMAIL,
    phone: process.env.SUPPORT_PHONE,
    publicEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    publicPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE,
  };

  try {
    process.env.SUPPORT_EMAIL = "help@example.com";
    process.env.SUPPORT_PHONE = "+234 (0) 800 123 4567";
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    delete process.env.NEXT_PUBLIC_SUPPORT_PHONE;

    const contact = getSupportContact();
    assert.equal(contact.email, "help@example.com");
    assert.match(contact.emailHref ?? "", /^mailto:help@example\.com\?/);
    assert.equal(contact.phone, "+234 (0) 800 123 4567");
    assert.equal(contact.phoneHref, "tel:+23408001234567");
  } finally {
    restoreEnv("SUPPORT_EMAIL", previous.email);
    restoreEnv("SUPPORT_PHONE", previous.phone);
    restoreEnv("NEXT_PUBLIC_SUPPORT_EMAIL", previous.publicEmail);
    restoreEnv("NEXT_PUBLIC_SUPPORT_PHONE", previous.publicPhone);
  }
});

test("support is wired into public and admin navigation", async () => {
  const [footer, header, nav, publicPage, adminPage] = await Promise.all([
    source("../src/components/site-footer.tsx"),
    source("../src/components/public-header.tsx"),
    source("../src/components/nav-config.ts"),
    source("../src/app/(public)/support/page.tsx"),
    source("../src/app/(admin)/admin/support/page.tsx"),
  ]);

  assert.match(footer, /\["Contact support", "\/support"\]/);
  assert.match(header, /href="\/support"/);
  assert.match(nav, /href: "\/admin\/support"/);
  assert.match(publicPage, /<SupportPanel/);
  assert.match(adminPage, /<SupportPanel compact/);
});

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
