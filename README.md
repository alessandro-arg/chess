# <img src="https://chess2.alessandro-argenziano.com/assets/login-icon.png" alt="Chess² Logo" width="35" /> Chess² - Online Chess Game

<p align="left">
  <a href="https://angular.dev/"><img src="https://img.shields.io/badge/Angular-17-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular"></a>&nbsp;&nbsp;
  <a href="https://firebase.google.com/"><img src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Database-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase"></a>&nbsp;&nbsp;
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/TailwindCSS-3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS"></a>
</p>

## 📖 About the Project

**Chess²** is a modern web-based chess game where you can:
- Play against a **Stockfish-powered AI bot**  
- Invite and play against your **friends in real-time**  
- Create an account with **Firebase Authentication**  
- Track your progress with a fully functional **Elo rating system**  
- Review your **recent games** with detailed recap  

The goal of this project was to build a **complete multiplayer chess platform** with a clean UI, robust backend, and smooth real-time gameplay – all within 4 weeks.

## 📷 Screenshots

Dashboard preview:  

![Chess² Dashboard](https://github.com/alessandro-arg/assets/blob/main/chess-mockup.png)

## ✨ Features

-  **entication** – Sign up & log in with Firebase   
-  **Play vs Bot** – Challenge the Stockfish API (via Render Worker)  
-  **Friends System** – Add friends & invite them to play  
-  **Real-time Games** – Powered by Firebase Realtime Database  
-  **Elo Rating** – Dynamic rating system for fair matchmaking  
-  **Game History** – Recap of your recent matches
-  **Responsive UI** – Built with Angular 17 & TailwindCSS
  
## 🚀 Live Demo

🔗 Try it here: [https://chess2.alessandro-argenziano.com](https://chess2.alessandro-argenziano.com)  

## 🛠️ Tech Stack

- **Frontend:** Angular 17 (standalone components),TypeScript, TailwindCSS  
- **Backend:** Firebase (, Firestore, Realtime Database)  
- **Chess Engine:** Stockfish API (served via [Render](https://render.com))  
- **Other:** Angular SSR, Express server for deployment  


## 🗂️ Project Structure

```text
.
├─ .vscode/
│
├─ dist/
├─ node_modules/
│
├─ engine-server/
│ └─ ...
│
├─ src/
│ ├─ app/
│ │ ├─ components/
│ │ │ ├─ chess-board/
│ │ │ │ ├─ chess-board.component.ts
│ │ │ │ ├─ chess-board.component.html
│ │ │ │ └─ chess-board.component.css
│ │ │ ├─ dashboard/
│ │ │ ├─ friends-modal/
│ │ │ ├─ game-end/
│ │ │ ├─ games-modal/
│ │ │ ├─ impressum/
│ │ │ ├─ live-clock/
│ │ │ ├─ login/
│ │ │ ├─ privacy-policy/
│ │ │ ├─ promotion-modal/
│ │ │ ├─ register/
│ │ │ ├─ settings/
│ │ │ ├─ share-menu/
│ │ │ ├─ start-animation/
│ │ │ └─ toast-message/
│ │ │
│ │ ├─ shared/
│ │ │ ├─ elo.ts
│ │ │ └─ a2hs.util.ts
│ │ │
│ │ ├─ app.component.ts
│ │ ├─ app.component.html
│ │ ├─ app.component.css
│ │ ├─ app.routes.ts
│ │ ├─ app.config.ts
│ │ ├─ app.config.server.ts
│ │ ├─ .guard.ts
│ │ │
│ │ ├─ .service.ts
│ │ ├─ bot.service.ts
│ │ ├─ elo.service.ts
│ │ ├─ friend.service.ts
│ │ ├─ game-rtdb.service.ts
│ │ ├─ latency.service.ts
│ │ ├─ notification.service.ts
│ │ ├─ presence.service.ts
│ │ ├─ ratings.service.ts
│ │ ├─ start-intro.service.ts
│ │ └─ user.service.ts
│ │
│ ├─ assets/
│ │ └─ login-icon.png
│ │
│ ├─ environments/
│ │ └─ environment.ts
│ │
│ ├─ index.html
│ ├─ main.ts
│ ├─ main.server.ts
│ ├─ manifest.webmanifest
│ ├─ styles.css
│ └─ ngsw-config.json
│
├─ server.ts
│
├─ angular.json
├─ package.json
├─ package-lock.json
├─ postcss.config.js
├─ tailwind.config.js
├─ proxy.conf.json
│
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.spec.json
│
├─ .editorconfig
├─ .gitignore
└─ README.md
```

## 🛠️ Setup & Development

### 1) Prerequisites

- Node.js 18+
- PNPM or NPM
- Firebase project (console) with entication, Firestore/RTDB and Storage enabled

### 2) Clone & install

```bash
git clone https://github.com/alessandro-arg/chess.git
cd chess
# choose one package manager
npm install
# or
pnpm install
```

### 3) Environment variables

Create `src/environments/environment.ts` (and `environment.prod.ts`) with your Firebase config:

```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com"
  }
};
```

If you're using AngularFire `provideFirebaseApp`, `provideAuth`, etc., ensure they're wired in your `app.config.ts`.

### 4) Run locally

```bash
npm run start    # alias for ng serve
# or
ng serve
```

App will be running on: [http://localhost:4200](http://localhost:4200).


## 🔐 Authentication

- Email/Password and Google sign‑in via Firebase Auth
- Route guards to protect authenticated views
- Per‑user data isolation (security rules below)

## 📦 Scripts

Common Angular scripts (adjust to match your `package.json`):

```json
{
   "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "serve:ssr:chess": "node dist/chess/server/server.mjs"
  },
  "private": true,
  "dependencies": {
    "@angular/animations": "^17.3.0",
    "@angular/common": "^17.3.0",
    "@angular/compiler": "^17.3.0",
    "@angular/core": "^17.3.0",
    "@angular/fire": "^17.1.0",
    "@angular/forms": "^17.3.0",
    "@angular/platform-browser": "^17.3.0",
    "@angular/platform-browser-dynamic": "^17.3.0",
    "@angular/platform-server": "^17.3.0",
    "@angular/router": "^17.3.0",
    "@angular/service-worker": "^17.3.12",
    "@angular/ssr": "^17.3.17",
    "chess.js": "^1.4.0",
    "express": "^4.18.2",
    "firebase": "^10.14.1",
    "lottie-web": "^5.13.0",
    "ngx-lottie": "^11.0.2",
    "rxjs": "~7.8.0",
    "stockfish": "^16.0.0",
    "tslib": "^2.3.0",
    "zone.js": "~0.14.3"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^17.3.17",
    "@angular/cli": "^17.3.17",
    "@angular/compiler-cli": "^17.3.0",
    "@types/express": "^4.17.17",
    "@types/jasmine": "~5.1.0",
    "@types/node": "^18.18.0",
    "autoprefixer": "^10.4.21",
    "jasmine-core": "~5.1.0",
    "karma": "~6.4.0",
    "karma-chrome-launcher": "~3.2.0",
    "karma-coverage": "~2.2.0",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.4.2"
  }
}
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m "feat: add amazing feature"`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

I use Conventional Commits and PR templates (optional). Keep components small, typed, and accessible.

## 📄 License

This project is licensed under the **MIT License** – see `LICENSE` for details.

## 🙏 Acknowledgements

- Stockfish Chess Engine
- Angular
- Firebase
- Tailwind CSS
- Render for hosting the Stockfish worker

## 📬 Contact

For questions, feature requests, or collaboration:

- Open an issue: [https://github.com/alessandro-arg/chess/issues](https://github.com/alessandro-arg/chess/issues)
- Or reach out to **contact@alessandro-argenziano.com**
- Have a look at my [Portfolio](https://alessandro-argenziano.com)
