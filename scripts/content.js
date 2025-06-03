// Content script that runs on YouTube pages
console.log('Content script loaded on YouTube');

// Function to safely get ytInitialPlayerResponse from the page
function getYtPlayerResponse() {
  try {
    // Look for the script tag containing ytInitialPlayerResponse
    const scripts = document.body.getElementsByTagName('script');
    for (const script of scripts) {
      const text = script.text;
      if (text.includes('ytInitialPlayerResponse')) {
        const startIndex = text.indexOf('ytInitialPlayerResponse') + 'ytInitialPlayerResponse = '.length;
        const endIndex = text.indexOf('};', startIndex) + 1;
        if (startIndex > 0 && endIndex > 0) {
          const jsonStr = text.substring(startIndex, endIndex);
          return JSON.parse(jsonStr);
        }
      }
    }
    // Alternative method: check for window object in page context
    if (document.body.innerHTML.includes('window["ytInitialPlayerResponse"]')) {
      const element = document.createElement('div');
      element.id = 'tempDataHolder';
      element.style.display = 'none';
      document.body.appendChild(element);
      const scriptContent = `
        if (window.ytInitialPlayerResponse) {
          document.getElementById('tempDataHolder').setAttribute('data-response', JSON.stringify(window.ytInitialPlayerResponse));
        }
      `;
      const script = document.createElement('script');
      script.src = URL.createObjectURL(new Blob([scriptContent], { type: 'application/javascript' }));
      script.onload = () => script.remove();
      document.body.appendChild(script);
      const response = element.getAttribute('data-response');
      element.remove();
      if (response) {
        return JSON.parse(response);
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting player response:', error);
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
  const playerResponse = getYtPlayerResponse();
  console.log('Player response:', playerResponse); // Debug log
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  console.log('Caption tracks:', tracks); // Debug log
  return tracks.map(track => ({
    code: track.languageCode,
    label: track.name?.simpleText || track.languageCode,
    baseUrl: track.baseUrl
  }));
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
      text: decodeURIComponent(el.textContent || '')
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
      const languages = getAvailableLanguagesFromPlayer();
      console.log('Available languages:', languages); // Debug log
      sendResponse({ success: true, languages });
      return true;
    }
    
    case 'getTranscript': {
      const languages = getAvailableLanguagesFromPlayer();
      let track = null;
      if (request.languageCode) {
        track = languages.find(t => t.code === request.languageCode);
      }
      if (!track) {
        track = languages[0]; // Default to first track
      }
      if (!track) {
        console.log('No transcript track found'); // Debug log
        sendResponse({ success: false, error: 'No transcript available' });
        return true;
      }
      console.log('Fetching transcript for track:', track); // Debug log
      fetchTranscriptFromBaseUrl(track.baseUrl).then(transcript => {
        console.log('Transcript fetched:', transcript.length, 'segments'); // Debug log
        sendResponse({ success: true, transcript });
      }).catch((error) => {
        console.error('Transcript fetch error:', error); // Debug log
        sendResponse({ success: false, error: 'Failed to fetch transcript' });
      });
      return true;
    }
    
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  return true; // Required for async response
}); 