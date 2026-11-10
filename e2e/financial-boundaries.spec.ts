import { test, expect } from "@playwright/test"

test("гость не может запустить возврат или изменить выплату", async ({ request }) => {
  expect((await request.post("/api/admin/purchases/foreign/refund")).status()).toBe(401)
  expect((await request.patch("/api/admin/payouts/foreign", { data: { status: "PAID" } })).status()).toBe(401)
  expect((await request.post("/api/admin/payouts", { data: { developerId: "foreign" } })).status()).toBe(401)
})

test("история и создание выплат закрыты для гостя", async ({ request }) => {
  const response = await request.get("/api/payouts")
  expect(response.status()).toBe(401)
  expect(await response.json()).not.toHaveProperty("balance")
  expect((await request.post("/api/payouts")).status()).toBe(401)
})

test("претензия требует авторизации покупателя", async ({ request }) => {
  expect((await request.post("/api/purchases/foreign/claim", { data: { text: "Попытка подать чужую претензию" } })).status()).toBe(401)
})
