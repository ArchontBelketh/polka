-- Существующие JWT соответствуют версии 0. Блокировка и смена пароля
-- увеличивают версию и отзывают ранее выданные сессии.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
