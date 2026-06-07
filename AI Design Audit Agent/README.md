# AI Design Audit Agent

A production-grade Next.js application that uses Google's Gemini Vision AI to autonomously audit user interfaces for design principles including Visual Hierarchy, Contrast, Spacing, Alignment, and Consistency.

Built for the Aivar Innovations Associate ML Engineer Hiring Challenge.

## Features

- **Multimodal AI Analysis**: Uses Gemini 2.5 Pro Vision to process full-page UI screenshots.
- **Observability**: Live terminal-style logging panel tracks agent thought process and execution states.
- **Dashboard Results**: Visual metrics, confidence scores, and detailed issue tracking.
- **Export Capabilities**: Download reports as structured JSON or styled PDF.
- **Enterprise-Grade UI**: Built with Tailwind CSS, Framer Motion, and custom glassmorphism components.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS v4, Framer Motion, Lucide React
- **Backend**: Next.js API Routes, `@google/genai`
- **Language**: TypeScript

## Setup Instructions

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd ai-design-audit-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory and add your Gemini API Key:
   ```
   GEMINI_API_KEY="your_google_gemini_api_key_here"
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the App**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Architecture Overview

1. **Upload Phase**: The `UploadDropzone` component captures the image, validates its size/type, and converts it to Base64.
2. **Analysis Phase**: The image is sent to `/api/audit` via a POST request.
3. **AI Evaluation**: The API route queries the `gemini-2.5-pro` model with strict JSON schema enforcing design principle categories.
4. **Presentation**: The `DashboardResults` component takes the structured AI output and renders actionable issue cards with severity styling.

## Docker Support (Optional)

To run this application via Docker:

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t ai-design-audit-agent .
docker run -p 3000:3000 -e GEMINI_API_KEY="your_api_key" ai-design-audit-agent
```
