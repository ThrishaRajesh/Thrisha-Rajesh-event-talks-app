# BigQuery Release Pulse

An elegant, real-time developer dashboard that fetches official Google BigQuery release notes, parses consolidated updates into separate interactive cards, and offers a styled tweet preview manager to share notes instantly on Twitter/X.

Built using **Python Flask** on the backend, alongside plain vanilla **HTML5**, **CSS3 (Custom Variables)**, and **ES6 JavaScript** on the frontend.

---

## ✨ Features

* **Granular Release Note Decompositions**: Splits aggregated daily release summaries into individual update cards sorted by category (*Features, Issues & Fixes, Deprecations, Announcements*).
* **Double-Tier In-Memory Caching**: Caches XML responses for 5 minutes to minimize feed requests. Includes a manual force-refresh bypass query parameter (`?force=true`).
* **Twitter Composer Integration**: Automatically prepares formatted tweet drafts under 280 characters with relevant hashtags, featuring an interactive SVG circular progress indicator that displays warnings as you type.
* **Instant Client Search & Filtering**: Fast, debounced search keyword lookup and visual category pills for instant on-screen sorting.
* **Premium Dark Mode UI**: A responsive CSS grid layout built with a Slate/Indigo theme, glassmorphism design variables, skeleton loading indicators, and micro-interactions.

---

## 🛠️ Tech Stack

* **Backend**: Python 3.10+, Flask
* **Frontend**: HTML5, Vanilla CSS3, ES6 JavaScript
* **Feed Library**: Built-in XML parsing (`xml.etree.ElementTree`) & Regular Expressions (`re`)
* **Deployment Ready**: Standard `.gitignore` and git-ready configuration

---

## 📁 Directory Structure

```text
├── templates/
│   └── index.html      # App structure, modals, and statistics cards
├── static/
│   ├── css/
│   │   └── styles.css  # Dark mode theme variables, grids, and animations
│   └── js/
│   │   └── app.js      # App state, filters, counter widgets, and web intent
├── app.py              # Flask server routes, XML parsing, and cache controls
├── .gitignore          # Excludes python logs, bytecode, and IDE workspaces
└── README.md           # Project documentation and developer guides
```

---

## 🚀 Getting Started

Follow these simple steps to run the application locally on your computer.

### Prerequisites
Make sure you have Python installed on your system.

### 1. Install Dependencies
You only need to install `Flask` to run the server:
```bash
pip install Flask
```

### 2. Run the Application
Start the development server using:
```bash
python app.py
```

### 3. Open the Dashboard
Navigate to the following address in your browser:
```text
http://127.0.0.1:5000/
```

---

## 🐦 How to Share Updates on Twitter
1. Click **Tweet** on any card.
2. The Twitter modal will compose a draft summary of the release notes under 280 characters.
3. Make any changes in the editor. The progress circle will fill up as you type.
4. Click **Post Tweet** to open the official Twitter intent website in a new tab with your pre-populated message.
