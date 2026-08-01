/// <reference path="../pb_data/types.d.ts" />

// Дежурный пользователь — авторизации ещё нет, фронт берёт "первого
// пользователя" из БД (см. docs/data-model.md → users). Нужен реальный
// пользователь для блока в сайдбаре.
const USER_EMAIL = 'master@refrigeration.local'

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId('users')
  const user = new Record(usersCol)
  user.set('email', USER_EMAIL)
  user.set('password', 'DevPass!12345')
  user.set('name', 'Дежурный мастер')
  user.set('verified', true)
  app.save(user)
}, (app) => {
  const user = app.findFirstRecordByFilter('users', `email = '${USER_EMAIL}'`)
  if (user) app.delete(user)
})
