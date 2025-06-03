// Content script that runs on YouTube pages
console.log('Content script loaded on YouTube');

// Function to get the video element
function getVideoElement() {
  return document.querySelector('video.html5-main-video');
}

// Function to get video metadata
function getVideoMetadata() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');
  const video = getVideoElement();
  
  return {
    videoId,
    duration: video ? video.duration : 0,
    currentTime: video ? video.currentTime : 0,
    title: document.title.replace(' - YouTube', '')
  };
}

// Function to get available caption languages
async function getAvailableLanguages() {
  try {
    // First try to get languages from the transcript panel
    const transcriptButton = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent.includes('Show transcript'));
    
    if (transcriptButton) {
      transcriptButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));

      const languageSelector = document.querySelector('.dropdown-trigger[aria-label="Transcript language selector"]');
      if (languageSelector) {
        languageSelector.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const languages = Array.from(document.querySelectorAll('.ytd-menu-popup-renderer'))
          .map(item => ({
            code: item.getAttribute('data-value') || '',
            label: item.textContent.trim()
          }))
          .filter(lang => lang.label && !lang.label.includes('Off'));

        // Close the language selector and transcript panel
        languageSelector.click();
        transcriptButton.click();
        
        return languages;
      }
      
      // Close transcript panel if we couldn't get languages
      transcriptButton.click();
    }

    // Fallback to getting languages from video settings
    const settingsButton = document.querySelector('.ytp-settings-button');
    if (settingsButton) {
      settingsButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      const menuItems = Array.from(document.querySelectorAll('.ytp-menuitem'));
      const subtitlesMenuItem = menuItems.find(item => 
        item.textContent.includes('Subtitles/CC') || 
        item.textContent.includes('Captions')
      );

      if (subtitlesMenuItem) {
        subtitlesMenuItem.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const languages = Array.from(document.querySelectorAll('.ytp-menuitem'))
          .map(item => ({
            code: item.getAttribute('data-value') || '',
            label: item.textContent.trim()
          }))
          .filter(lang => lang.label && !lang.label.includes('Off'));

        // Close the menu
        settingsButton.click();
        return languages;
      }
      
      // Close settings if we couldn't get languages
      settingsButton.click();
    }

    return [];
  } catch (error) {
    console.error('Error getting languages:', error);
    return [];
  }
}

// Function to extract transcript data from YouTube's page
async function extractTranscript(languageCode = '') {
  try {
    // First, try to get transcript from the auto-generated captions
    const transcriptButton = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent.includes('Show transcript'));
    
    if (transcriptButton) {
      transcriptButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for transcript panel to open

      // If a specific language is requested, try to select it
      if (languageCode) {
        const languageSelector = document.querySelector('.dropdown-trigger[aria-label="Transcript language selector"]');
        if (languageSelector) {
          languageSelector.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Try to find the language option by both code and label
          const languageOptions = Array.from(document.querySelectorAll('.ytd-menu-popup-renderer'));
          let targetLanguage = languageOptions.find(option => 
            option.getAttribute('data-value') === languageCode ||
            option.textContent.trim().toLowerCase().includes(languageCode.toLowerCase())
          );

          if (targetLanguage) {
            targetLanguage.click();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Increased wait time for language switch
          } else {
            console.warn('Language not found:', languageCode);
          }
        }
      }
      
      // Wait for transcript segments to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const transcriptSegments = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
      if (transcriptSegments.length === 0) {
        // If no segments found, wait a bit longer and try again
        await new Promise(resolve => setTimeout(resolve, 1000));
        transcriptSegments = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
      }

      const transcript = transcriptSegments.map(segment => {
        const timestamp = segment.querySelector('.segment-timestamp');
        const text = segment.querySelector('.segment-text');
        
        if (timestamp && text) {
          const time = parseTimestamp(timestamp.textContent.trim());
          return {
            time,
            text: text.textContent.trim()
          };
        }
        return null;
      }).filter(Boolean);

      // Close transcript panel
      transcriptButton.click();
      
      if (transcript.length === 0) {
        throw new Error('No transcript segments found');
      }

      return transcript;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting transcript:', error);
    return null;
  }
}

// Helper function to parse YouTube timestamp (e.g., "1:23" or "1:23:45")
function parseTimestamp(timestamp) {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// Cache for transcript data
const transcriptCache = new Map(); // Use Map to cache multiple languages
let cachedLanguages = null;
const { YoutubeTranscript } = require('youtube-transcript');
// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const video = getVideoElement();
  

  YoutubeTranscript.fetchTranscript(video.id).then(transcript => {
    console.log(transcript);
  });
  switch (request.action) {
    case 'getVideoInfo':
      sendResponse(getVideoMetadata());
      break;
      
    case 'seekTo':
      if (video) {
        video.currentTime = request.time;
        video.play();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Video element not found' });
      }
      break;

    case 'getAvailableLanguages':
      if (cachedLanguages) {
        sendResponse({ success: true, languages: cachedLanguages });
        return true;
      }

      getAvailableLanguages().then(languages => {
        cachedLanguages = languages;
        sendResponse({ success: true, languages });
      }).catch(error => {
        console.error('Error getting languages:', error);
        sendResponse({ success: false, error: 'Failed to get available languages' });
      });
      return true;
      
    case 'getTranscript':
      const cacheKey = request.languageCode || 'default';
      
      // If we have cached transcript for this language
      if (transcriptCache.has(cacheKey)) {
        sendResponse({ success: true, transcript: transcriptCache.get(cacheKey) });
        return true;
      }

      // Otherwise fetch and cache it
      extractTranscript(request.languageCode).then(transcript => {
        if (transcript) {
          transcriptCache.set(cacheKey, transcript);
          sendResponse({ success: true, transcript });
        } else {
          sendResponse({ 
            success: false, 
            error: 'Could not find transcript. Please make sure captions are enabled for this video.'
          });
        }
      }).catch(error => {
        console.error('Error extracting transcript:', error);
        sendResponse({ 
          success: false, 
          error: 'Error extracting transcript. Please try again.'
        });
      });
      
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Required for async response
}); 