/* ----------------------------------------------------
   BIGQUERY RELEASE PULSE - APPLICATION JS
   ---------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        releases: [],
        filteredReleases: [],
        currentCategory: 'all',
        searchQuery: '',
        sortBy: 'newest',
        selectedRelease: null
    };

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const lastUpdatedText = document.getElementById('last-updated-text');
    
    const statsTotal = document.getElementById('stat-total');
    const statsFeatures = document.getElementById('stat-features');
    const statsIssues = document.getElementById('stat-issues');
    const statsDeprecations = document.getElementById('stat-deprecations');
    
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const categoryFilters = document.getElementById('category-filters');
    const sortSelect = document.getElementById('sort-select');
    
    const skeletonGrid = document.getElementById('skeleton-grid');
    const notesGrid = document.getElementById('notes-grid');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalSourceBadge = document.getElementById('modal-source-badge');
    const modalSourceDate = document.getElementById('modal-source-date');
    const modalSourceContent = document.getElementById('modal-source-content');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCountText = document.getElementById('char-count-text');
    const progressCircle = document.getElementById('progress-circle');
    const postTweetBtn = document.getElementById('post-tweet-btn');

    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // SVG Circle properties for character counter
    const CIRCUMFERENCE = 2 * Math.PI * 11; // Radius is 11, circumference is ~69.115
    if (progressCircle) {
        progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
        progressCircle.style.strokeDashoffset = CIRCUMFERENCE;
    }

    /* ----------------------------------------------------
       1. DATA FETCHING & STATE INITIALIZATION
       ---------------------------------------------------- */
    
    async function loadReleases(force = false) {
        setLoadingState(true);
        try {
            const url = `/api/releases${force ? '?force=true' : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'error') {
                throw new Error(result.message);
            }
            
            state.releases = result.data || [];
            
            // Show warnings if any (e.g. stale cache warnings)
            if (result.status === 'warning') {
                showToast(result.message, 'info');
            } else if (force) {
                showToast('Release notes successfully refreshed!', 'success');
            }

            // Update last updated text
            if (result.last_fetched) {
                const date = new Date(result.last_fetched);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                lastUpdatedText.textContent = `Updated: ${dateStr} at ${timeStr} (${result.source === 'cache' ? 'cached' : 'live'})`;
            }
            
            // Calculate and display statistics
            calculateStatistics();
            
            // Filter and Render
            applyFiltersAndRender();
            
        } catch (error) {
            console.error('Error loading release notes:', error);
            setErrorState(error.message || 'An error occurred while contacting the server.');
        } finally {
            setLoadingState(false);
        }
    }

    function calculateStatistics() {
        const total = state.releases.length;
        const features = state.releases.filter(item => getNormalizedCategory(item.category) === 'feature').length;
        const issues = state.releases.filter(item => getNormalizedCategory(item.category) === 'issue').length;
        const deprecations = state.releases.filter(item => getNormalizedCategory(item.category) === 'deprecated').length;

        // Animate counter values
        animateValue(statsTotal, total);
        animateValue(statsFeatures, features);
        animateValue(statsIssues, issues);
        animateValue(statsDeprecations, deprecations);
    }

    function animateValue(element, end, duration = 600) {
        if (!element) return;
        const start = parseInt(element.textContent) || 0;
        if (start === end) {
            element.textContent = end;
            return;
        }
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.textContent = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.textContent = end;
            }
        };
        window.requestAnimationFrame(step);
    }

    /* ----------------------------------------------------
       2. FILTERING, SEARCHING & SORTING LOGIC
       ---------------------------------------------------- */
    
    function getNormalizedCategory(category) {
        if (!category) return 'other';
        const cat = category.toLowerCase().trim();
        if (cat.includes('feature') || cat.includes('new') || cat.includes('addition')) {
            return 'feature';
        } else if (cat.includes('issue') || cat.includes('bug') || cat.includes('fix') || cat.includes('resolved') || cat.includes('workaround')) {
            return 'issue';
        } else if (cat.includes('deprecat') || cat.includes('remov') || cat.includes('decommission')) {
            return 'deprecated';
        }
        return 'other';
    }

    function applyFiltersAndRender() {
        // 1. Filter by category pill
        let temp = state.releases;
        if (state.currentCategory !== 'all') {
            temp = temp.filter(item => getNormalizedCategory(item.category) === state.currentCategory);
        }

        // 2. Filter by search query
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase().trim();
            temp = temp.filter(item => {
                const searchString = `${item.date} ${item.category} ${stripHtml(item.content)}`.toLowerCase();
                return searchString.includes(query);
            });
        }

        // 3. Sort
        temp.sort((a, b) => {
            const dateA = new Date(a.updated || a.date);
            const dateB = new Date(b.updated || b.date);
            return state.sortBy === 'newest' ? dateB - dateA : dateA - dateB;
        });

        state.filteredReleases = temp;
        
        // 4. Render results
        renderNotes();
    }

    function renderNotes() {
        notesGrid.innerHTML = '';
        
        if (state.filteredReleases.length === 0) {
            notesGrid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        notesGrid.style.display = 'grid';

        state.filteredReleases.forEach((note, index) => {
            const normalizedCat = getNormalizedCategory(note.category);
            const card = document.createElement('article');
            card.className = `note-card category-${normalizedCat}`;
            card.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;
            
            // Clean text content for copy operations
            const cleanText = stripHtml(note.content);

            card.innerHTML = `
                <div class="note-header">
                    <span class="badge badge-${normalizedCat}">${note.category}</span>
                    <time class="note-date" datetime="${note.updated || ''}">${note.date}</time>
                </div>
                <div class="note-body">
                    ${note.content}
                </div>
                <div class="note-footer">
                    <button class="btn-card-action btn-copy" data-id="${note.id}" title="Copy description to clipboard">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        <span>Copy</span>
                    </button>
                    <button class="btn-card-action btn-card-tweet" data-id="${note.id}" title="Compose a Tweet about this update">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;
            
            // Attach event listeners to card action buttons
            card.querySelector('.btn-copy').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(cleanText);
            });

            card.querySelector('.btn-card-tweet').addEventListener('click', (e) => {
                e.stopPropagation();
                openTweetModal(note);
            });

            notesGrid.appendChild(card);
        });
    }

    /* ----------------------------------------------------
       3. TWITTER MODAL & PREVIEW GENERATION
       ---------------------------------------------------- */
    
    function generateTweetDraft(note) {
        const category = note.category;
        const date = note.date;
        const cleanContent = stripHtml(note.content).replace(/\s+/g, ' ').trim();
        
        // Structure: "BigQuery [Category] ([Date]): [Content] #BigQuery #GCP"
        const prefix = `BigQuery ${category} (${date}): `;
        const hashtags = ` #BigQuery #GCP #GoogleCloud`;
        
        const maxContentLength = 280 - prefix.length - hashtags.length;
        
        let contentDraft = cleanContent;
        if (cleanContent.length > maxContentLength) {
            contentDraft = cleanContent.substring(0, maxContentLength - 3) + '...';
        }
        
        return `${prefix}${contentDraft}${hashtags}`;
    }

    function openTweetModal(note) {
        state.selectedRelease = note;
        
        // Setup Modal Source Header details
        const normalizedCat = getNormalizedCategory(note.category);
        modalSourceBadge.className = `badge badge-${normalizedCat}`;
        modalSourceBadge.textContent = note.category;
        modalSourceDate.textContent = note.date;
        modalSourceContent.innerHTML = note.content;
        
        // Generate and set default tweet text
        const tweetDraft = generateTweetDraft(note);
        tweetTextarea.value = tweetDraft;
        
        // Update character counter and UI styling
        updateCharCount(tweetDraft.length);
        
        // Show modal
        tweetModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background scrolling
        tweetTextarea.focus();
    }

    function closeTweetModal() {
        tweetModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore background scrolling
        state.selectedRelease = null;
    }

    function updateCharCount(length) {
        const remaining = 280 - length;
        charCountText.textContent = remaining;
        
        // Update Circular Progress
        const percent = Math.min((length / 280) * 100, 100);
        const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
        
        if (progressCircle) {
            progressCircle.style.strokeDashoffset = offset;
            
            // Change colors based on length warning levels
            if (remaining < 0) {
                progressCircle.style.stroke = 'var(--color-deprecated)';
                charCountText.className = 'char-count-text error';
            } else if (remaining <= 20) {
                progressCircle.style.stroke = 'var(--color-issue)';
                charCountText.className = 'char-count-text warning';
            } else {
                progressCircle.style.stroke = 'var(--primary)';
                charCountText.className = 'char-count-text';
            }
        }

        // Enable/Disable Tweet Button
        postTweetBtn.disabled = (length === 0 || remaining < 0);
    }

    function triggerTwitterIntent() {
        const text = tweetTextarea.value.trim();
        if (!text) return;
        
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        
        closeTweetModal();
        showToast('Redirected to Twitter to share your post!', 'success');
    }

    /* ----------------------------------------------------
       4. INTERACTION LISTENERS & APP STATE CONTROLS
       ---------------------------------------------------- */
    
    // Refresh Button Click
    refreshBtn.addEventListener('click', () => {
        // Toggle rotation animation
        const icon = refreshBtn.querySelector('.spinner-icon');
        icon.classList.add('spin');
        loadReleases(true).finally(() => {
            icon.classList.remove('spin');
        });
    });

    // Retry Button (Error State)
    retryBtn.addEventListener('click', () => {
        loadReleases(true);
    });

    // Reset Filters Button (Empty State)
    resetFiltersBtn.addEventListener('click', () => {
        state.currentCategory = 'all';
        state.searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        
        // Reset Category filter pills
        document.querySelectorAll('.filter-pill').forEach(pill => {
            if (pill.getAttribute('data-category') === 'all') {
                pill.classList.add('active');
                pill.setAttribute('aria-selected', 'true');
            } else {
                pill.classList.remove('active');
                pill.setAttribute('aria-selected', 'false');
            }
        });
        
        applyFiltersAndRender();
    });

    // Category Filter Selection
    categoryFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        
        document.querySelectorAll('.filter-pill').forEach(p => {
            p.classList.remove('active');
            p.setAttribute('aria-selected', 'false');
        });
        
        pill.classList.add('active');
        pill.setAttribute('aria-selected', 'true');
        
        state.currentCategory = pill.getAttribute('data-category');
        applyFiltersAndRender();
    });

    // Search Input text listener (with debounce)
    let searchDebounceTimeout;
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        
        if (value.trim()) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            state.searchQuery = value;
            applyFiltersAndRender();
        }, 200);
    });

    // Clear Search Input Button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndRender();
        searchInput.focus();
    });

    // Sort Dropdown Selector
    sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        applyFiltersAndRender();
    });

    // Textarea typings inside Tweet Modal
    tweetTextarea.addEventListener('input', (e) => {
        updateCharCount(e.target.value.length);
    });

    // Modal Close Button
    closeModalBtn.addEventListener('click', closeTweetModal);
    
    // Modal Overlay backdrop click
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Escape key press to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tweetModal.style.display === 'flex') {
            closeTweetModal();
        }
    });

    // Post Tweet Intent triggering
    postTweetBtn.addEventListener('click', triggerTwitterIntent);

    /* ----------------------------------------------------
       5. UTILITY FUNCTIONS (TOASTS, COPY, UI STATES)
       ---------------------------------------------------- */
    
    function setLoadingState(isLoading) {
        if (isLoading) {
            skeletonGrid.style.display = 'grid';
            notesGrid.style.display = 'none';
            emptyState.style.display = 'none';
            errorState.style.display = 'none';
            refreshBtn.disabled = true;
            
            // Set indicator
            const statusInd = document.querySelector('.status-indicator');
            if (statusInd) {
                statusInd.className = 'status-indicator loading';
                lastUpdatedText.textContent = 'Fetching feed...';
            }
        } else {
            skeletonGrid.style.display = 'none';
            refreshBtn.disabled = false;
            
            const statusInd = document.querySelector('.status-indicator');
            if (statusInd) {
                statusInd.className = 'status-indicator online';
            }
        }
    }

    function setErrorState(msg) {
        skeletonGrid.style.display = 'none';
        notesGrid.style.display = 'none';
        emptyState.style.display = 'none';
        errorState.style.display = 'flex';
        errorMessage.textContent = msg;
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Text copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy text. Please select and copy manually.', 'error');
        });
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconMarkup = '';
        if (type === 'success') {
            iconMarkup = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-feature)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (type === 'error') {
            iconMarkup = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-deprecated)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        } else {
            iconMarkup = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--primary)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }
        
        toast.innerHTML = `
            ${iconMarkup}
            <span>${message}</span>
            <button class="toast-close" aria-label="Close message">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove toast
        const timeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
        
        // Manual close click
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(timeout);
            toast.remove();
        });
    }

    function stripHtml(html) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || "";
    }

    // Initial load
    loadReleases();
});
