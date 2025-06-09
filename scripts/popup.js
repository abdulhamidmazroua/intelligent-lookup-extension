// State to store video information
let currentVideo = null;
let currentTranscript = null;
let selectedLanguage = '';

// RTL language codes
const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

function showError(message) {
  const results = document.getElementById('results');
  results.innerHTML = `<div class="error">${message}</div>`;
  console.error(message); // For debugging
}

function showLoading() {
  const results = document.getElementById('results');
  results.innerHTML = '<div class="no-results">Loading...</div>';
}

function showResults(results, query) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">No matches found for "' + query + '"</div>';
    return;
  }
  
  // Add results count
  const countDiv = document.createElement('div');
  countDiv.className = 'results-count';
  countDiv.textContent = `Found ${results.length} matches`;
  resultsContainer.appendChild(countDiv);
  
  results.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'result';
    
    const jumpButton = document.createElement('span');
    jumpButton.className = 'jump';
    jumpButton.textContent = '▶ Jump';
    jumpButton.addEventListener('click', () => jumpTo(entry.time));
    
    // Highlight the matching text
    const highlightedText = highlightText(entry.text, query);
    
    div.innerHTML = `<strong>${formatTime(entry.time)}</strong>: ${highlightedText} `;
    div.appendChild(jumpButton);
    resultsContainer.appendChild(div);
  });
}

function highlightText(text, query) {
  if (!query) return text;
  
  // Escape special regex characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function searchKeyword() {
  const query = document.getElementById('keyword').value.trim();
  if (!query) {
    showResults([], '');
    return;
  }
  
  if (!currentTranscript) {
    showLoading();
    fetchTranscript(query);
    return;
  }
  
  // For non-Latin script languages, don't convert to lowercase
  const isNonLatin = /[^\u0000-\u007F]/.test(query);
  const matches = currentTranscript.filter(entry => {
    if (isNonLatin) {
      return entry.text.includes(query);
    }
    return entry.text.toLowerCase().includes(query.toLowerCase());
  });
  
  showResults(matches, query);
}

function fetchTranscript(query) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      showError('Cannot access current tab');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'getTranscript',
      languageCode: selectedLanguage
    }, function(response) {
      if (chrome.runtime.lastError) {
        showError('Please navigate to a YouTube video page');
        console.error(chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success && response.transcript) {
        currentTranscript = response.transcript;
        searchKeyword(); // Perform search with current query
      } else {
        showError(response?.error || 'Failed to get video transcript');
      }
    });
  });
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function jumpTo(seconds) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      showError('Cannot access current tab');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'seekTo',
      time: seconds
    }, function(response) {
      if (chrome.runtime.lastError || !response || !response.success) {
        showError('Failed to jump to timestamp. Please try again.');
      }
    });
  });
}

function setRTL(languageCode) {
  const isRTL = rtlLanguages.some(code => languageCode.toLowerCase().startsWith(code));
  document.body.classList.toggle('rtl', isRTL);
  
  // Update input and select box text alignment
  const keyword = document.getElementById('keyword');
  const languageSelect = document.getElementById('languageSelect');
  
  keyword.style.textAlign = isRTL ? 'right' : 'left';
  languageSelect.style.textAlign = isRTL ? 'right' : 'left';
}

function loadLanguages() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      showError('Cannot access current tab');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'getAvailableLanguages'
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }

      const languageSelect = document.getElementById('languageSelect');
      if (response && response.success && response.languages) {
        languageSelect.innerHTML = `
          <option value="">Auto (Default)</option>
          ${response.languages.map(lang => 
            `<option value="${lang.code}" ${lang.code === selectedLanguage ? 'selected' : ''}>${lang.label}</option>`
          ).join('')}
        `;
      } else {
        languageSelect.innerHTML = '<option value="">Auto (Default)</option>';
      }
    });
  });
}

// Function to reset all state
function resetState() {
  currentVideo = null;
  currentTranscript = null;
  selectedLanguage = '';
  console.log('State reset'); // Debug log
}

// Modified initialization code
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup initialized'); // Debug log
  
  // Reset all state when popup opens
  resetState();
  
  // Add event listeners
  const searchInput = document.getElementById('keyword');
  const searchButton = document.getElementById('searchButton');
  const languageSelect = document.getElementById('languageSelect');
  
  // Use a shorter debounce time for better responsiveness
  searchInput.addEventListener('input', debounce(searchKeyword, 200));
  searchButton.addEventListener('click', searchKeyword);
  
  // Handle language change
  languageSelect.addEventListener('change', function(e) {
    selectedLanguage = e.target.value;
    setRTL(selectedLanguage);
    currentTranscript = null; // Clear cache to force reload with new language
    searchKeyword(); // Trigger new search with selected language
  });
  
  // Handle Enter key
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchKeyword();
    }
  });
  
  // Show initial loading state
  showLoading();
  
  // Initial load - always fetch fresh data
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      showError('Cannot access current tab');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'getVideoInfo'
    }, function(response) {
      if (chrome.runtime.lastError) {
        showError('Please navigate to a YouTube video page');
        console.error(chrome.runtime.lastError);
        return;
      }
      
      if (response && response.videoId) {
        currentVideo = response;
        console.log('Initial video load:', response); // Debug log
        loadLanguages();
        fetchTranscript();
      } else {
        showError('Unable to get video information. Please make sure you are on a YouTube video page.');
      }
    });
  });
});

// Utility function to debounce search input
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}