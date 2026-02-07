# PackKit Frontend - Admin Dashboard & AI Chatbot

## Design Overview

This frontend features a **professional dark theme** inspired by the Navy Mirage color palette with the following characteristics:

### Color Scheme
- **Primary Background**: Deep navy (#0F1419, #141E30)
- **Accent Colors**: Professional blues (#35577D, #4A6FA5, #5B8BBF)
- **Text**: Crisp white and gray tones for excellent readability
- **Status Indicators**: Green (success), Orange (warning), Red (error), Blue (info)

### Design Principles
- **Modern & Professional**: Clean, corporate-friendly aesthetic
- **Navy Mirage Theme**: Deep ocean blues with gradient accents
- **User-Friendly**: High contrast, readable typography (Inter font)
- **Responsive**: Works perfectly on desktop, tablet, and mobile
- **Animated**: Smooth transitions and micro-interactions

## Features

### 1. Admin Dashboard (`/dashboard`)
Displays comprehensive system statistics from multiple API endpoints:

#### RAG Statistics Section
- Total Documents
- Total Embeddings
- Cached Responses
- Unique Packages

#### Vector Optimization Section
- Index Status (Active/Inactive)
- Average Query Time
- Cache Hit Rate
- Top 5 Most Documented Packages

#### Security Status Section
- Total Packages
- Verified Packages Count & Percentage
- Unverified Packages Count
- Overall Verification Rate
- Recently Verified Packages List

#### System Health Indicators
- Database Connection Status
- API Server Status
- Vector Search Status

**Features:**
- Auto-refresh every 30 seconds
- Real-time statistics display
- Animated stat cards with hover effects
- Color-coded status indicators
- Live health monitoring

### 2. AI Chatbot (`/chat`)
Interactive chatbot interface using the `/api/chat` endpoint:

**Features:**
- 💬 Real-time messaging interface
- 🤖 AI-powered responses from PackKit
- ⚡ Cache indicators for fast responses
- 📦 Source package display
- ⏱️ Response time tracking
- 💡 Suggested questions for new users
- 🔄 Chat history with timestamps
- ⌨️ Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- 🗑️ Clear chat functionality
- 📱 Mobile-optimized message bubbles

## 🚀 Getting Started

### Prerequisites
- Node.js installed
- Backend server running on port 4873
- MongoDB running locally

### Installation

Already installed! The dependencies include:
- react-router-dom (for navigation)
- All standard React/Vite dependencies

### Running the Application

The frontend is currently running on:
```
http://localhost:5173/
```

To start it manually:
```bash
cd frontend
npm run dev
```

## 📁 File Structure

```
frontend/src/
├── App.jsx                 # Main app with routing
├── App.css                 # App wrapper styles
├── Navigation.jsx          # Navigation bar component
├── Navigation.css          # Navigation styles
├── AdminDashboard.jsx      # Admin dashboard page
├── AdminDashboard.css      # Dashboard styles
├── Chatbot.jsx            # AI chatbot page
├── Chatbot.css            # Chatbot styles
├── index.css              # Global styles & design system
└── main.jsx               # App entry point
```

## 🎯 API Endpoints Used

### Admin Dashboard
- `GET http://localhost:4873/api/stats` - RAG statistics
- `GET http://localhost:4873/api/vector-stats` - Vector optimization stats
- `GET http://localhost:4873/api/security-stats` - Security statistics

### Chatbot
- `POST http://localhost:4873/api/chat` - Send questions and receive AI responses
  - Request body: `{ "question": "your question here" }`
  - Response: `{ "answer": "...", "source": "package-name", "responseTime": 123 }`

## 🎨 Design System

### Typography
- Font Family: Inter (Google Fonts)
- Headings: Bold, gradient text effects
- Body: Clean, high-contrast text

### Colors (CSS Variables)
```css
--color-dark-primary: #0F1419
--color-dark-secondary: #141E30
--color-accent-blue: #35577D
--color-accent-light: #4A6FA5
--color-text-primary: #E8EDF2
--color-text-secondary: #B0BEC5
```

### Components
- **Cards**: Glass morphism effect with gradients
- **Buttons**: Gradient backgrounds with hover animations
- **Inputs**: Bordered with focus states
- **Animations**: Fade-in, pulse, typing indicators

## 📱 Responsive Breakpoints

- Desktop: Default styles
- Tablet: < 1024px
- Mobile: < 768px

## ✨ Special Features

### Admin Dashboard
- **Live Updates**: Stats refresh every 30 seconds automatically
- **Hover Effects**: Cards lift and glow on hover
- **Status Indicators**: Pulsing dots for active services
- **Grid Layouts**: Responsive stat cards that adapt to screen size

### Chatbot
- **Message Animations**: Smooth fade-in for new messages
- **Typing Indicator**: Animated dots while AI is thinking
- **Smart Scrolling**: Auto-scroll to latest message
- **Metadata Display**: Shows response time, cache status, and source package
- **Suggested Questions**: Quick-start prompts for users
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for multiline

## 🔧 Customization

To change the color theme, edit the CSS variables in `src/index.css`:

```css
:root {
  --color-dark-primary: #0F1419;
  --color-accent-blue: #35577D;
  /* ... other variables */
}
```

## 🐛 Troubleshooting

### Stats not loading on Dashboard
- Ensure backend server is running on port 4873
- Check browser console for CORS errors
- Verify MongoDB is connected

### Chatbot not responding
- Confirm `/api/chat` endpoint is accessible
- Check that Ollama AI service is running
- Verify documentation has been scraped for packages

### Styles not applying
- Clear browser cache
- Restart Vite dev server
- Check that `index.css` is imported in `main.jsx`

## 🎯 Usage Guide

### Navigation
1. Click "Dashboard" to view system statistics
2. Click "AI Chat" to interact with the chatbot
3. Use the refresh button on dashboard to manually update stats

### Using the Chatbot
1. Navigate to the AI Chat page
2. Type your question about npm packages
3. Press Enter or click "Send"
4. View the AI response with metadata
5. Click suggested questions for quick starts
6. Use "Clear Chat" to start fresh

## 📊 Performance

- **Initial Load**: Fast with Vite's optimized bundling
- **Navigation**: Instant with React Router
- **API Calls**: Async with loading states
- **Animations**: GPU-accelerated CSS transforms
- **Responsive**: Mobile-first approach

## 🎉 Features Highlight

✅ Professional Navy Mirage dark theme (not purple!)
✅ Fully functional admin dashboard with real-time stats
✅ Interactive AI chatbot with metadata display
✅ Responsive design for all devices
✅ Smooth animations and transitions
✅ Accessible and user-friendly interface
✅ Integration with all backend endpoints
✅ Auto-refresh capabilities
✅ Error handling and loading states
✅ Keyboard shortcuts and UX enhancements

---

**Built with ❤️ using React, Vite, and modern web technologies**
