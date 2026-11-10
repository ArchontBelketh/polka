import { test, expect } from "@playwright/test"

test("гость не может подготовить или подтвердить загрузку", async ({ request }) => {
  expect((await request.post("/api/upload", { data: { productId: "foreign", type: "source", fileName: "app.py", fileSize: 4, contentType: "text/x-python" } })).status()).toBe(401)
  expect((await request.post("/api/upload/foreign/complete")).status()).toBe(401)
})
test("восстановление черновика не раскрывает данные гостю", async ({ request }) => {
  const response = await request.get("/api/product-submissions/foreign")
  expect(response.status()).toBe(401)
  expect(await response.json()).not.toHaveProperty("productId")
})
test("покупка, отзыв и запуск проверки требуют авторизации", async ({ request }) => {
  expect((await request.post("/api/products/foreign/request")).status()).toBe(401)
  expect((await request.post("/api/reviews", { data: { productId: "foreign", rating: 5, text: "forged review text" } })).status()).toBe(401)
  expect((await request.post("/api/scan?productId=foreign")).status()).toBe(401)
})
