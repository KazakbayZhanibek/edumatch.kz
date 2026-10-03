# EduMatch KZ: запуск для друга

## Что установить

Обязательно:

- [Node.js 22 LTS](https://nodejs.org/) (минимум Node.js 18)
- [Git](https://git-scm.com/)
- [Visual Studio Code](https://code.visualstudio.com/)

Обязательные расширения VS Code не нужны. Проект написан на обычных JavaScript, HTML и CSS.

Необязательные расширения:

- ESLint — проверка JavaScript
- Prettier — форматирование кода
- GitLens — удобная работа с Git
- REST Client — тестирование API
- SQLite Viewer — просмотр базы данных

## Установка проекта

Открыть PowerShell и выполнить:

```powershell
git clone <ссылка-на-репозиторий>
cd edumatch-kz\backend
npm install
Copy-Item .env.example .env
```

Открыть файл `backend/.env` и задать `JWT_SECRET`. Например:

```env
JWT_SECRET=my-local-secret-change-this
```

`OPENROUTER_API_KEY` можно оставить пустым. Основные функции проекта будут работать без него.

## Запуск

Из папки `backend` выполнить:

```powershell
node server.js
```

Открыть в браузере:

```text
http://localhost:3000
```

Важно: команда `node server` неправильная. Нужно использовать именно `node server.js`.

## Проверка работы

Открыть:

```text
http://localhost:3000/health
```

Если сервер работает, появится JSON-ответ со статусом.

## Дополнительно

Расширение Live Server не нужно: фронтенд уже отдаётся Node.js-сервером.

Для остановки сервера нажать `Ctrl+C` в PowerShell.