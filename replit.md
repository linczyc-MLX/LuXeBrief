# Luxury Residence Briefing Application

## Overview

This is a professional briefing application designed for ultra-luxury private residence design consultations. The app guides clients through a structured questionnaire, records verbal responses via voice recording, transcribes them using AI, and generates comprehensive PDF reports summarizing design preferences and requirements.

The application follows an Apple Human Interface Guidelines-inspired design approach with luxury refinements, emphasizing sophisticated minimalism, clarity, and professional elegance appropriate for high-end clientele.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens for luxury aesthetic
- **Theme**: Light/dark mode support via ThemeProvider

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx
- **API Design**: RESTful endpoints under `/api` prefix
- **Build System**: esbuild for production server bundling, Vite for client

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all database models
- **Migrations**: Drizzle Kit for schema migrations in `./migrations`
- **Storage Abstraction**: Interface-based storage pattern allowing memory or database backends

### Core Data Models
- **Sessions**: Track briefing sessions with client name, status, and progress
- **Responses**: Store question responses with transcriptions and audio references
- **Reports**: Generated AI summaries organized by category
- **Questions**: Dynamic questionnaire covering vision, design, functional, lifestyle, and emotional categories (manageable via admin panel)

### Admin Panel
- **Route**: `/admin` - Token-protected admin interface for question and content management
- **Authentication**: Bearer token authentication (default: `luxury-admin-2024`, configurable via `ADMIN_TOKEN` env var)
- **Tabs**:
  - **Questions Tab**: Manage briefing questions with CRUD, drag-and-drop reordering
  - **Site Content Tab**: Edit text elements across the site (headlines, subtitles, button text)
- **Features**:
  - Full CRUD operations for questions (create, read, update, delete)
  - Drag-and-drop reordering using @dnd-kit library
  - Category badges and active/inactive status management
  - Warning alerts when no active questions exist
  - Inline content editing with save buttons for each field
- **API Endpoints**:
  - `POST /api/admin/verify` - Verify admin token
  - `GET /api/admin/questions` - List all questions (includes inactive)
  - `POST /api/admin/questions` - Create new question
  - `PATCH /api/admin/questions/:id` - Update question
  - `DELETE /api/admin/questions/:id` - Delete question
  - `POST /api/admin/questions/reorder` - Reorder questions (requires full ID list)
  - `GET /api/content` - Get all site content (public)
  - `GET /api/admin/content` - Get all content with metadata (admin)
  - `PATCH /api/admin/content/:key` - Update content value (admin)

### Site Content Management
- **Content Keys**: Stored with key-value pairs (e.g., `home.headline`, `home.subtitle`, `home.cta_button`)
- **Storage**: In-memory storage with default values seeded on startup
- **Sections**: Content organized by page section (Home Page, Briefing, Report)

### Cloud-Based Persistence (App Storage)
- **Storage**: Replit App Storage (Google Cloud Storage backed) for permanent file persistence
- **Path Structure**: `.private/briefings/{client-name-slug}-{sessionId}/`
- **Folder Structure**:
  - `audio/` - Audio recordings (WebM format: `question-{id}.webm`)
  - `transcripts/` - Text transcriptions (`question-{id}.txt`)
  - `reports/` - Generated reports (`summary.json`, `report.pdf`)
- **Auto-Save**: Files saved to cloud storage when recording completes and on every "Next" click
- **CloudStorageService**: Handles cloud uploads, downloads, and path management
- **Environment Variables**: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`
- **Security**: Each session has a unique `accessToken` required for file access
- **API Endpoints**:
  - `GET /api/sessions/:id/files` - List all files for a session (requires token)
  - `GET /api/sessions/:id/files/:fileType/:fileName` - Download a specific file (requires token)

### Voice Recording Flow
1. Client records audio via browser MediaRecorder (WebM/Opus format)
2. Audio converted to WAV using ffmpeg on server
3. OpenAI Whisper API transcribes audio to text
4. Transcriptions stored and displayed for client review/editing

### Report Generation
- OpenAI GPT models analyze all transcribed responses
- Insights categorized into actionable sections
- PDF export using PDFKit library

## External Dependencies

### AI Services (via Replit AI Integrations)
- **OpenAI API**: Speech-to-text (Whisper), text generation for report summarization
- **Environment Variables**: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage for Express

### Audio Processing
- **ffmpeg**: System dependency for converting WebM audio to WAV format (available by default on Replit)

### Document Generation
- **PDFKit**: Server-side PDF generation for exportable reports

### Frontend Libraries
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **date-fns**: Date formatting utilities
- **class-variance-authority**: Component variant management