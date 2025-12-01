# ARC Raiders Inventory Manager

## Project Overview

This is a React-based web application designed to help players of the game "ARC Raiders" manage their inventory. The application's standout feature is its ability to automatically recognize items from screenshots using AI (Vision Transformer) and OCR (Optical Character Recognition).

**Key Features:**
*   **Item Recognition:** Uses a local AI model (`Xenova/clip-vit-base-patch32`) to identify item icons from uploaded screenshots.
*   **OCR Integration:** Uses `tesseract.js` to read text (e.g., quantities, item names) from images.
*   **Data Management:** Fetches and maintains a database of game items and their metadata.
*   **User Interface:** A modern, responsive UI built with React and Tailwind CSS.

## Architecture

*   **Frontend:** React (Vite), TypeScript, Tailwind CSS.
*   **AI/ML:** `@xenova/transformers` (running in the browser/worker), `tesseract.js` for OCR.
*   **Data Pipeline:** Node.js scripts (`scripts/`) to fetch game data, download models, and generate embeddings for item recognition.
*   **State Management:** React Hooks (e.g., `useAiVision`, `useOcr`).

## Building and Running

### Prerequisites
*   Node.js (Latest LTS recommended)
*   npm

### Initial Setup
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Download AI Model:**
    Downloads the Vision Transformer model to `public/models`.
    ```bash
    npm run download-model
    ```
3.  **Fetch Game Data & Icons:**
    Downloads item icons and metadata from external wikis/DBs.
    ```bash
    npm run fetch:gamedata
    ```
4.  **Generate Embeddings:**
    Pre-calculates vector embeddings for item icons to enable the AI recognition features.
    ```bash
    npm run embed:generate
    ```

### Development Server
Start the local development server:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

### Production Build
Build the application for production:
```bash
npm run build
```
To preview the production build locally:
```bash
npm run preview
```

## Directory Structure

*   `src/`: Main application source code.
    *   `components/`: React components (e.g., `InventoryImageInput`, `ResultTable`).
    *   `hooks/`: Custom React hooks (`useAiVision`, `useOcr`).
    *   `logic/`: Core business logic (OCR processing, item matching, string utilities).
    *   `data/`: Static data files (`items.json`, `items.ts`).
    *   `worker.ts`: Web Worker for offloading heavy AI/OCR tasks.
*   `scripts/`: Node.js scripts for build-time data processing and model management.
*   `public/`: Static assets, including models (`public/models`) and item icons (`public/items`).

## Development Conventions

*   **Type Safety:** Strict adherence to TypeScript. Define interfaces in `src/types.ts`.
*   **Styling:** Use Tailwind CSS utility classes. Avoid custom CSS files where possible.
*   **AI/Workers:** Heavy computational tasks (image processing, inference) should be offloaded to Web Workers (`src/worker.ts`, `src/logic/ocrWorker.ts`) to keep the UI responsive.
*   **Data Updates:** When the game updates, run the scripts in `scripts/` to synchronize data and embeddings.
