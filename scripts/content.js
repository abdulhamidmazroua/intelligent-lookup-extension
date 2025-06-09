// Content script that runs on YouTube pages
console.log('Content script loaded on YouTube');

// Keep track of latest video data
let currentVideoData = null;

// Function to safely get ytInitialPlayerResponse from the page
function getYtPlayerResponse() {
  try {
    // Look for the script tag containing ytInitialPlayerResponse
    const scripts = document.getElementsByTagName('script');
    for (const script of scripts) {
      const content = script.textContent;
      if (content && content.includes('ytInitialPlayerResponse')) {
        const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match && match[1]) {
          const response = JSON.parse(match[1]);
          currentVideoData = response; // Store the latest video data
          return response;
        }
      }
    }
    console.error('Could not find ytInitialPlayerResponse');
    return null;
  } catch (err) {
    console.error('Error in getYtPlayerResponse:', err);
    return null;
  }
}

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

// Get available caption tracks (languages)
function getAvailableLanguagesFromPlayer() {
  try {
    const playerResponse = getYtPlayerResponse();
    console.log('Player response:', playerResponse); // Debug log
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    console.log('Caption tracks:', tracks); // Debug log
    return tracks.map(track => ({
      code: track.languageCode,
      label: track.name?.simpleText || track.languageCode,
      baseUrl: track.baseUrl
    }));
  } catch (err) {
    console.error('Error getting languages:', err);
    return [];
  }
}

// Fetch transcript for a given baseUrl
async function fetchTranscriptFromBaseUrl(baseUrl) {
  try {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error('Failed to fetch transcript');
    const xmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");
    return [...xml.getElementsByTagName("text")].map(el => ({
      time: parseFloat(el.getAttribute('start') || '0'),
      text: el.textContent || ''  // Remove decodeURIComponent since content is already decoded
    }));
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const video = getVideoElement();

  switch (request.action) {
    case 'getVideoInfo':
      // Always get fresh metadata
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

    case 'getAvailableLanguages': {
      try {
        const languages = getAvailableLanguagesFromPlayer();
        console.log('Fresh languages data:', languages);
        sendResponse({ success: true, languages });
      } catch (error) {
        console.error('Languages fetch error:', error);
        sendResponse({ success: false, error: 'Failed to fetch languages' });
      }
      break;
    }
    
    case 'getTranscript': {
      try {
        const languages = getAvailableLanguagesFromPlayer();
        let track = null;
        if (request.languageCode) {
          track = languages.find(t => t.code === request.languageCode);
        }
        if (!track) {
          track = languages[0]; // Default to first track
        }
        if (!track) {
          console.log('No transcript track found');
          sendResponse({ success: false, error: 'No transcript available' });
          return true;
        }
        console.log('Fetching fresh transcript for track:', track);
        fetchTranscriptFromBaseUrl(track.baseUrl)
          .then(transcript => {
            console.log('Fresh transcript fetched:', transcript.length, 'segments');
            sendResponse({ success: true, transcript });
          })
          .catch(error => {
            console.error('Transcript fetch error:', error);
            sendResponse({ success: false, error: 'Failed to fetch transcript' });
          });
      } catch (error) {
        console.error('Transcript fetch error:', error);
        sendResponse({ success: false, error: 'Failed to fetch transcript' });
      }
      return true;
    }
    
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  return true; // Required for async response
});

// Add URL change detection with improved video data handling
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('URL changed, waiting for new video data...'); 
    
    // Wait for the new page content to load
    setTimeout(() => {
      try {
        const response = getYtPlayerResponse();
        console.log('New video data loaded successfully');
        currentVideoData = response; // Update current video data
      } catch (err) {
        console.error('Failed to get new video data:', err);
        currentVideoData = null;
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true }); 