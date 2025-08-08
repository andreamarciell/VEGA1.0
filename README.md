# Welcome to your Toppery project

## Project info

**URL**: https://Toppery.dev/projects/4fa325ef-cfc8-4b7c-b418-926179947797

## How can I edit this code?

There are several ways of editing your application.

**Use Toppery**

Simply visit the [Toppery Project](https://Toppery.dev/projects/4fa325ef-cfc8-4b7c-b418-926179947797) and start prompting.

Changes made via Toppery will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Toppery.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Toppery](https://Toppery.dev/projects/4fa325ef-cfc8-4b7c-b418-926179947797) and click on Share -> Publish.

## Can I connect a custom domain to my Toppery project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.Toppery.dev/tips-tricks/custom-domain#step-by-step-guide)


## Analisi Avanzata (AI) – Setup rapido
- Aggiunta la pagina **Analisi Avanzata** in Toppery AML (tab nella dashboard AML).
- Richiede la variabile d'ambiente `OPENROUTER_API_KEY` (Netlify ➜ Site settings ➜ Environment).
- La funzione serverless è in `netlify/functions/amlAdvancedAnalysis.js`.

I dati inviati al modello sono anonimizzati (timestamp, importo, direzione, causale normalizzata).
