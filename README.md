# Subnet Studio

A visual-first IPv4 subnetting tool designed for learning and planning network address spaces. Built as a standalone PWA with zero backend dependencies.

## 🚀 Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Bulma (Layout) + Custom CSS Tokens (Aesthetic)
- **PWA**: `vite-plugin-pwa` for offline-first capabilities

## 🛠️ Local Setup

### Prerequisites
- Node.js (v18 or newer)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd SubnetStudio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Run the development server with hot-module replacement:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
Create an optimized build for deployment:
```bash
npm run build
```
The output will be available in the `dist/` directory.

## 📱 PWA Capabilities
This application is a Progressive Web App. Once deployed:
- It can be "Added to Home Screen" on iOS and Android.
- It works entirely offline after the first load.
- It uses a custom manifest and service worker for near-instant load times.

## 📐 Project Architecture
- `src/domain/`: Pure TypeScript logic for IPv4 and VLSM math (no React dependency).
- `src/state/`: Centralized state management using a custom hook.
- `src/components/`: UI components separated by responsibility.
