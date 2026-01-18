# Design Guidelines: Ultra-Luxury Residence Briefing Application

## Design Approach

**Selected Approach:** Apple Human Interface Guidelines-inspired with luxury refinements

**Justification:** This is a professional utility application requiring clarity, elegance, and trustworthiness. The interface must project sophistication appropriate for ultra-luxury clientele while maintaining exceptional usability for voice recording and question navigation.

**Core Principles:**
- Sophisticated minimalism with generous breathing room
- Content-first hierarchy emphasizing questions and responses
- Calm, confident interactions without unnecessary flourishes
- Professional precision in every detail

---

## Typography

**Font System:** Via Google Fonts CDN
- **Primary:** Inter (400, 500, 600) - Interface text, questions, buttons
- **Accent:** Crimson Pro (400, 600) - Optional elegant headers for welcome/completion screens

**Hierarchy:**
- Question headings: text-2xl font-semibold (Inter 600)
- Body text/transcriptions: text-base font-normal (Inter 400)
- Button labels: text-sm font-medium (Inter 500)
- Helper text/metadata: text-sm font-normal (Inter 400)
- Section headers: text-3xl font-semibold (optional Crimson Pro for elegance)

---

## Layout System

**Spacing Primitives:** Tailwind units of 4, 6, 8, 12, 16 for consistency
- Component padding: p-6 or p-8
- Section spacing: space-y-8 or space-y-12
- Button spacing: px-6 py-3
- Container margins: mx-4 md:mx-auto

**Container Strategy:**
- Main content: max-w-3xl mx-auto (optimal reading width for questions)
- Full viewport sections: Use natural height, not forced vh units
- Responsive padding: px-4 md:px-8

---

## Component Library

### Navigation
- **Top Bar:** Fixed header with logo/title, progress indicator, session info
- Minimal, slim design (h-16) with subtle bottom border
- Contains: App title, question progress (e.g., "3 of 12"), optional save/exit

### Question Display
- **Card-based layout:** Each question in generous container with rounded corners
- Clear question text at top
- Recording controls centered below
- Transcription area appears below controls when active
- Visual feedback for recording state (subtle pulse, no aggressive animations)

### Voice Recording Interface
- **Primary button:** Large circular record button (w-20 h-20 minimum)
- States: Ready (outlined), Recording (filled with subtle pulse), Processing (spinner)
- **Secondary controls:** Playback, re-record, confirm buttons in horizontal row
- **Visual indicator:** Duration timer, waveform visualization (simple bars, not complex)
- **Transcription display:** Readonly text area with edit capability, appears smoothly below controls

### Forms & Inputs
- Minimal text inputs for client name/session metadata at start
- Rounded corners (rounded-lg), subtle borders
- Focus states with outline-2 outline-offset-2
- Clear labels above inputs

### Navigation Controls
- **Bottom navigation bar:** Previous/Next buttons, clear CTAs
- Primary action (Next/Submit) more prominent than secondary (Previous)
- Fixed or sticky positioning for easy access

### Progress Tracking
- Linear progress bar showing completion percentage
- Question counter (e.g., "Question 3 of 12")
- Section indicators if questions grouped by category

### Report Preview/Export
- Clean summary layout with sections clearly delineated
- Export buttons (PDF/Word) prominently placed
- Organized by categories: Design Preferences, Functional Needs, Lifestyle Elements, etc.

### Status & Feedback
- Toast notifications for saves, errors (top-right corner)
- Loading states with minimal spinners
- Confirmation modals with clear actions

---

## Key Interface Patterns

### Welcome Screen
- Elegant introduction with app purpose
- Client name input
- Session creation or continuation
- Begin button as primary CTA
- No complex hero imagery - clean, text-focused layout with subtle sophistication

### Question Flow
- One question per screen for focus
- Smooth transitions between questions (fade or slide)
- Auto-save indicators for reassurance
- Clear visual hierarchy: Question → Recording → Transcription → Navigation

### Completion Screen
- Summary of completed briefing
- Preview of generated insights
- Export options prominently featured
- Option to review/edit specific answers

### Mobile Considerations
- Full-screen question cards on mobile
- Large touch targets for record button (minimum 48px)
- Simplified navigation for small screens
- Responsive typography scaling

---

## Images

**Image Strategy:** Minimal, purposeful imagery

**Welcome Screen:** Optional elegant architectural detail or abstract luxury texture as subtle background accent (not full hero). If used: high-quality, muted, professional imagery that doesn't compete with content. Positioned as subtle visual accent, not dominant element.

**Question Screens:** No imagery - maintain focus on questions and recording interface

**Completion Screen:** Optional subtle celebratory visual or architectural line art as background accent

**Key Principle:** Images should enhance sophistication without distracting from core functionality. All images should be subtle, refined, and appropriate for ultra-luxury context.

---

## Visual Treatment Notes

- Generous whitespace throughout - luxury feels spacious
- Subtle shadows for depth (shadow-sm, shadow-md maximum)
- Rounded corners for softness (rounded-lg primarily)
- Restrained animations - smooth transitions only, no bouncing or aggressive motion
- Professional, calm aesthetic - avoid playful or casual design elements
- Accessibility: Maintain high contrast ratios, clear focus states, screen reader support